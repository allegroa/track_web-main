import fs from 'fs/promises';
import path from 'path';
import { parseSessionFolderName, findSessionFiles, parseCSVFile, extractLineNameData } from '../utils/tgmParser.js';

/**
 * Ottiene la lista di tutte le sessioni TGM disponibili nella cartella del database
 */
export async function getSessions(databasePath) {
  try {
    const files = await fs.readdir(databasePath, { withFileTypes: true });
    const sessions = [];

    for (const dirent of files) {
      if (dirent.isDirectory()) {
        const sessionInfo = parseSessionFolderName(dirent.name);
        if (sessionInfo) {
          // Aggiungiamo informazioni sui file disponibili all'interno
          const sessionFolderPath = path.join(databasePath, dirent.name);
          const sessionFiles = await findSessionFiles(sessionFolderPath);
          
          
          // Estrai Line Name per i campi extra (Stazione Partenza, Arrivo, Direzione)
          let lineInfo = null;
          if (sessionFiles) {
             const targetFile = sessionFiles.parameters || sessionFiles.exceedances || sessionFiles.tqi;
             if (targetFile) {
               lineInfo = await extractLineNameData(targetFile);
             }
          }

          // Controlla se c'è un file di metadati salvato manualmente (_db.json)
          let customDbData = {};
          try {
             const dirFiles = await fs.readdir(sessionFolderPath);
             const dbFile = dirFiles.find(f => f.endsWith('_db.json'));
             if (dbFile) {
                const dbContent = await fs.readFile(path.join(sessionFolderPath, dbFile), 'utf8');
                customDbData = JSON.parse(dbContent);
             }
          } catch (e) {
             console.warn('No custom db data or parse error:', e);
          }

          sessions.push({
            ...sessionInfo,
            isSession: true,
            hasExceedances: !!sessionFiles?.exceedances,
            hasTqi: !!sessionFiles?.tqi,
            hasParameters: !!sessionFiles?.parameters,
            stazionePartenza: customDbData.stazionePartenza || lineInfo?.stazionePartenza || '',
            stazioneArrivo: customDbData.stazioneArrivo || lineInfo?.stazioneArrivo || '',
            direction: customDbData.direction || lineInfo?.direction || ''
          });
        } else {
          // Aggiungiamo anche le cartelle normali
          sessions.push({
            id: dirent.name,
            folderName: dirent.name,
            isSession: false,
            date: '',
            time: '',
            startKm: 0,
            endKm: 0,
            label: dirent.name
          });
        }
      }
    }

    // Ordina per data e ora decrescente
    return sessions.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Errore nel recupero delle sessioni TGM:', error);
    throw error;
  }
}

/**
 * Recupera i dati parametrici di una specifica sessione
 */
export async function getSessionData(databasePath, sessionId) {
  try {
    const sessionFolderPath = path.join(databasePath, sessionId);
    const sessionFiles = await findSessionFiles(sessionFolderPath);
    
    if (!sessionFiles || !sessionFiles.parameters) {
      throw new Error('File dei parametri non trovato per la sessione specificata.');
    }

    return await parseCSVFile(sessionFiles.parameters);
  } catch (error) {
    console.error(`Errore nel recupero dei dati per la sessione ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Recupera le eccedenze di una specifica sessione
 */
export async function getSessionExceedances(databasePath, sessionId) {
  try {
    const sessionFolderPath = path.join(databasePath, sessionId);
    const sessionFiles = await findSessionFiles(sessionFolderPath);
    
    if (!sessionFiles || !sessionFiles.exceedances) {
      throw new Error('File delle eccedenze non trovato per la sessione specificata.');
    }

    return await parseCSVFile(sessionFiles.exceedances);
  } catch (error) {
    console.error(`Errore nel recupero delle eccedenze per la sessione ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Recupera il TQI di una specifica sessione
 */
export async function getSessionTQI(databasePath, sessionId) {
  try {
    const sessionFolderPath = path.join(databasePath, sessionId);
    const sessionFiles = await findSessionFiles(sessionFolderPath);
    
    if (!sessionFiles || !sessionFiles.tqi) {
      throw new Error('File TQI non trovato per la sessione specificata.');
    }

    return await parseCSVFile(sessionFiles.tqi);
  } catch (error) {
    console.error(`Errore nel recupero del TQI per la sessione ${sessionId}:`, error);
    throw error;
  }
}
