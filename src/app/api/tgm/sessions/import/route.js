import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { extractArchive } from '../../../../../../TGM/backend/utils/extractor.js';
import { parseCSVFile, extractLineNameData } from '../../../../../../TGM/backend/utils/tgmParser.js';
import { addStation } from '../../../../../../TGM/backend/utils/stationManager.js';

// Regex per convalidare il nome standard della cartella
const SESSION_FOLDER_REGEX = /^(\d{4}\.\d{2}\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})K(\d+)\+(\d{3})~K(\d+)\+(\d{3})$/;

async function deleteFolder(folderPath) {
  try {
    await fs.rm(folderPath, { recursive: true, force: true });
  } catch (err) {
    console.error(`Errore durante la rimozione della cartella ${folderPath}:`, err);
  }
}

async function cleanupEmailFile(emailQueueDir, emailFileName) {
  if (emailFileName) {
    try {
      await fs.unlink(path.join(emailQueueDir, emailFileName));
    } catch (err) {
      console.warn('Impossibile eliminare il file dalla coda email:', err);
    }
  }
}

export async function POST(request) {
  const tempDirName = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const tempUploadDir = path.join(process.cwd(), 'tmp_uploads', tempDirName);
  const emailQueueDir = path.join(process.cwd(), 'tmp_uploads', 'email_queue');
  
  try {
    // 1. Parsing dei dati in ingresso
    const formData = await request.formData();
    const targetPath = formData.get('path'); // es. E:/Software/track_web-main/database
    const overwrite = formData.get('overwrite') === 'true';

    if (!targetPath) {
      return NextResponse.json({ error: 'The path parameter is required' }, { status: 400 });
    }

    const basePath = path.normalize(targetPath);
    await fs.mkdir(tempUploadDir, { recursive: true });

    let isArchive = false;
    let archiveFilePath = '';
    let archiveOriginalName = '';
    
    const serverFiles = formData.getAll('serverFiles');
    let emailFileName = null;

    if (serverFiles && serverFiles.length > 0) {
      // Importazione da Email Queue
      const fileName = serverFiles[0];
      emailFileName = fileName;
      const sourcePath = path.join(emailQueueDir, fileName);
      
      const ext = path.extname(fileName).toLowerCase();
      if (ext === '.zip' || ext === '.rar') {
        isArchive = true;
        archiveOriginalName = path.basename(fileName, ext);
        archiveFilePath = path.join(tempUploadDir, fileName);
        
        // Copiamo il file dalla coda alla cartella temporanea di importazione
        await fs.copyFile(sourcePath, archiveFilePath);
      } else {
        return NextResponse.json({ error: 'Unsupported file type in email queue' }, { status: 400 });
      }
    } else {
      // Importazione standard da Browser (Drag&Drop)
      const files = formData.getAll('files');
      if (files.length === 0) {
        return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
      }

      // Verifica se l'input contiene un archivio compressi ZIP/RAR
      if (files.length === 1) {
        const file = files[0];
        const ext = path.extname(file.name).toLowerCase();
        if (ext === '.zip' || ext === '.rar') {
          isArchive = true;
          archiveOriginalName = path.basename(file.name, ext);
          archiveFilePath = path.join(tempUploadDir, file.name);
          
          // Salvataggio temporaneo dell'archivio
          const buffer = Buffer.from(await file.arrayBuffer());
          await fs.writeFile(archiveFilePath, buffer);
        }
      }
    }

    const tempExtractDir = path.join(tempUploadDir, 'extracted');
    await fs.mkdir(tempExtractDir, { recursive: true });

    // 2. Estrazione o scrittura temporanea dei file
    if (isArchive) {
      try {
        await extractArchive(archiveFilePath, tempExtractDir);
      } catch (err) {
        // Rimozione immediata in caso di fallimento estrazione (Requisito di specifica)
        await deleteFolder(tempUploadDir);
        await cleanupEmailFile(emailQueueDir, emailFileName);
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    } else if (!emailFileName) {
      // Scrittura dei file sfusi ricreando la struttura relativa (solo per Drag&Drop)
      const files = formData.getAll('files');
      for (const file of files) {
        // Se caricato tramite directory, file.name contiene il percorso relativo
        const relativePath = file.name;
        const filePath = path.join(tempExtractDir, relativePath);
        
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(filePath, buffer);
      }
    }

    // 3. Validazione Strutturale e Naming Standard
    // Cerchiamo ricorsivamente se c'è una cartella che rispetta la convenzione
    let foundSessionFolder = '';
    let foundSessionName = '';

    async function scanForSession(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      // Controlliamo se la directory corrente stessa corrisponde al pattern
      const currentName = path.basename(dir);
      if (SESSION_FOLDER_REGEX.test(currentName)) {
        const filesInDir = entries.filter(e => e.isFile()).map(e => e.name);
        const hasExceedances = filesInDir.some(f => f.includes('超限報表.csv'));
        const hasTqi = filesInDir.some(f => f.includes('軌道TQI報表.csv'));
        const hasParams = filesInDir.some(f => f.includes('軌道參數報表.csv'));

        if (hasExceedances && hasTqi && hasParams) {
          foundSessionFolder = dir;
          foundSessionName = currentName;
          return;
        }
      }

      // Altrimenti cerchiamo nelle sottocartelle
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await scanForSession(path.join(dir, entry.name));
          if (foundSessionFolder) return;
        }
      }
    }

    await scanForSession(tempExtractDir);

    // Se non troviamo una cartella strutturata, ma il nome del file ZIP originale corrisponde al pattern,
    // e all'interno del tempExtractDir ci sono i 3 file CSV, consideriamo la radice come cartella della sessione.
    if (!foundSessionFolder && SESSION_FOLDER_REGEX.test(archiveOriginalName)) {
      const rootEntries = await fs.readdir(tempExtractDir, { withFileTypes: true });
      const filesInDir = rootEntries.filter(e => e.isFile()).map(e => e.name);
      const hasExceedances = filesInDir.some(f => f.includes('超限報表.csv'));
      const hasTqi = filesInDir.some(f => f.includes('軌道TQI報表.csv'));
      const hasParams = filesInDir.some(f => f.includes('軌道參數報表.csv'));

      if (hasExceedances && hasTqi && hasParams) {
        foundSessionFolder = tempExtractDir;
        foundSessionName = archiveOriginalName;
      }
    }

    if (!foundSessionFolder) {
      await deleteFolder(tempUploadDir);
      await cleanupEmailFile(emailQueueDir, emailFileName);
      return NextResponse.json({ 
        error: 'Non-standard directory format or incomplete acquisition. Ensure the folder is named in the standard format and contains the three CSV files (*超限報表.csv, *軌道TQI報表.csv, *軌道參數報表.csv).' 
      }, { status: 400 });
    }

    // 4. Controllo Duplicati
    const targetSessionPath = path.join(basePath, foundSessionName);
    let isDuplicate = false;
    try {
      await fs.access(targetSessionPath);
      isDuplicate = true;
    } catch {
      // Non esiste, procediamo
    }

    if (isDuplicate && !overwrite) {
      // Trovato un duplicato e l'utente non ha ancora autorizzato la sovrascrittura
      // Inviamo un codice di conflitto per chiedere conferma all'utente
      await deleteFolder(tempUploadDir);
      return NextResponse.json({ 
        duplicate: true, 
        folderName: foundSessionName,
        message: `The session ${foundSessionName} already exists.` 
      });
    }

    // 5. Convalida del Contenuto (Parsing CSV)
    // Troviamo i tre file
    const entries = await fs.readdir(foundSessionFolder);
    let exceedancesFile = '';
    let tqiFile = '';
    let parametersFile = '';

    for (const file of entries) {
      if (file.includes('超限報表.csv')) {
        exceedancesFile = path.join(foundSessionFolder, file);
      } else if (file.includes('軌道TQI報表.csv')) {
        tqiFile = path.join(foundSessionFolder, file);
      } else if (file.includes('軌道參數報表.csv')) {
        parametersFile = path.join(foundSessionFolder, file);
      }
    }

    try {
      // Proviamo a fare il parsing per verificare la correttezza del formato dei CSV
      await parseCSVFile(exceedancesFile);
      await parseCSVFile(tqiFile);
      await parseCSVFile(parametersFile);
    } catch (parseErr) {
      await deleteFolder(tempUploadDir);
      await cleanupEmailFile(emailQueueDir, emailFileName);
      return NextResponse.json({ error: `Corrupted CSV files or invalid headers: ${parseErr.message}` }, { status: 400 });
    }

    // 6. Scrittura a filesystem e Registrazione
    // Se c'è sovrascrittura, eliminiamo la cartella precedente ed eventuale file annotazioni db.json
    if (isDuplicate && overwrite) {
      await deleteFolder(targetSessionPath);
      const targetDbJsonPath = path.join(basePath, `${foundSessionName}_db.json`);
      try {
        await fs.unlink(targetDbJsonPath);
      } catch {
        // Ignorato se non esiste
      }
    }

    // Copiamo la sessione validata nella cartella del database
    await fs.mkdir(targetSessionPath, { recursive: true });
    await fs.copyFile(exceedancesFile, path.join(targetSessionPath, path.basename(exceedancesFile)));
    await fs.copyFile(tqiFile, path.join(targetSessionPath, path.basename(tqiFile)));
    await fs.copyFile(parametersFile, path.join(targetSessionPath, path.basename(parametersFile)));

    // Creiamo il file JSON vuoto associato per le annotazioni/singolarità
    const dbJsonPath = path.join(basePath, `${foundSessionName}_db.json`);
    await fs.writeFile(dbJsonPath, JSON.stringify([], null, 2), 'utf-8');

    // Estraiamo la stazione e aggiorniamo station.json
    try {
      const lineData = await extractLineNameData(path.join(targetSessionPath, path.basename(parametersFile)));
      if (lineData && lineData.stazionePartenza) {
        await addStation(basePath, lineData.stazionePartenza);
      }
    } catch (stationErr) {
      console.warn('Impossibile aggiornare station.json:', stationErr);
    }

    // Se stiamo importando da email, eliminiamo il file dalla coda originale
    if (emailFileName) {
      try {
        await fs.unlink(path.join(emailQueueDir, emailFileName));
      } catch (err) {
        console.warn('Impossibile eliminare il file dalla coda email:', err);
      }
    }

    // 7. Pulizia finale temporanei
    await deleteFolder(tempUploadDir);

    return NextResponse.json({ success: true, folderName: foundSessionName });

  } catch (error) {
    console.error('Import error:', error);
    await deleteFolder(tempUploadDir);
    // Nota: in caso di eccezione imprevista, NON eliminiamo il file dalla coda per permettere debug/retry
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
