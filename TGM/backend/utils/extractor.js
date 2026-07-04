import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Estrae un archivio ZIP o RAR nella cartella specificata.
 * Utilizza adm-zip per i file ZIP e comandi di sistema per RAR.
 * 
 * @param {string} filePath - Il percorso del file compresso.
 * @param {string} outputDir - La cartella di destinazione.
 */
export async function extractArchive(filePath, outputDir) {
  await fs.mkdir(outputDir, { recursive: true });
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.zip') {
    try {
      // Usiamo adm-zip importato dinamicamente per evitare blocchi se non ancora installato
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(filePath);
      zip.extractAllTo(outputDir, true);
    } catch (err) {
      console.warn('Estrazione adm-zip fallita, tentativo con comando tar di sistema:', err);
      try {
        await execAsync(`tar -xf "${filePath}" -C "${outputDir}"`);
      } catch (tarErr) {
        throw new Error('Estrazione del file ZIP fallita sia con adm-zip che con tar: ' + tarErr.message);
      }
    }
  } else if (ext === '.rar') {
    // Su Windows 10/11 il comando tar (basato su libarchive) supporta spesso nativamente i RAR.
    // In caso di errore proviamo unrar e 7-Zip.
    try {
      await execAsync(`tar -xf "${filePath}" -C "${outputDir}"`);
    } catch (tarErr) {
      console.warn('Comando tar fallito per il file RAR, tentativo con unrar:', tarErr);
      try {
        await execAsync(`unrar x -o+ "${filePath}" "${outputDir}"`);
      } catch (unrarErr) {
        console.warn('Comando unrar fallito, tentativo con percorso assoluto WinRAR:', unrarErr);
        try {
          // Fallback con percorso predefinito di WinRAR
          await execAsync(`"C:\\Program Files\\WinRAR\\UnRAR.exe" x -o+ "${filePath}" "${outputDir}"`);
        } catch (absUnrarErr) {
          console.warn('Comando UnRAR assoluto fallito, tentativo con 7-Zip:', absUnrarErr);
          try {
            await execAsync(`7z x -y -o"${outputDir}" "${filePath}"`);
          } catch (sevenZipErr) {
            throw new Error('Extraction failed: Unable to extract RAR file. Please ensure tar (Windows 11+), unrar, or 7-Zip is configured in your system PATH.');
          }
        }
      }
    }
  } else {
    throw new Error(`Estensione file non supportata per l'estrazione: ${ext}`);
  }
}
