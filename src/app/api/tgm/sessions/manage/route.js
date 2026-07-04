import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, targetPath, folderName, sourceFolder, destinationFolder } = body;

    if (!targetPath) {
      return NextResponse.json({ error: 'targetPath is required' }, { status: 400 });
    }

    const basePath = path.normalize(targetPath);

    if (action === 'create') {
      if (!folderName) return NextResponse.json({ error: 'folderName is required' }, { status: 400 });
      const newFolderPath = path.join(basePath, folderName);
      await fs.mkdir(newFolderPath, { recursive: true });
      return NextResponse.json({ success: true, message: 'Folder created successfully' });
    }

    if (action === 'update-metadata') {
      const { sessionId, updates } = body;
      if (!sessionId || !updates) {
        return NextResponse.json({ error: 'sessionId and updates are required' }, { status: 400 });
      }
      
      const sessionPath = path.join(basePath, sessionId);
      
      try {
        const files = await fs.readdir(sessionPath);
        let dbFile = files.find(f => f.endsWith('_db.json'));
        let dbFilePath;
        let dbData = {};
        
        if (!dbFile) {
           // Se non esiste, lo creiamo
           dbFile = `${sessionId}_db.json`;
           dbFilePath = path.join(sessionPath, dbFile);
        } else {
           dbFilePath = path.join(sessionPath, dbFile);
           try {
             const fileContent = await fs.readFile(dbFilePath, 'utf8');
             dbData = JSON.parse(fileContent);
           } catch (e) {
             console.warn('Error reading db.json, starting fresh', e);
           }
        }
        
        // Applica gli update ai metadati
        Object.assign(dbData, updates);
        
        await fs.writeFile(dbFilePath, JSON.stringify(dbData, null, 2), 'utf8');

        // Se è stata aggiornata la stazione di partenza, salviamola in station.json
        if (updates.stazionePartenza) {
          try {
            const { addStation } = await import('../../../../../../TGM/backend/utils/stationManager.js');
            await addStation(basePath, updates.stazionePartenza);
          } catch (e) {
            console.warn('Errore aggiornamento station.json da manage:', e);
          }
        }
        
        return NextResponse.json({ success: true, message: 'Metadata updated successfully', data: dbData });
      } catch (err) {
        return NextResponse.json({ error: 'Failed to update metadata: ' + err.message }, { status: 500 });
      }
    }

    if (action === 'move') {
      if (!sourceFolder || !destinationFolder) {
        return NextResponse.json({ error: 'sourceFolder and destinationFolder are required' }, { status: 400 });
      }
      
      const sourcePath = path.join(basePath, sourceFolder);
      // Se destinationFolder è 'root', sposta nella basePath
      const destPath = destinationFolder === 'root' 
        ? path.join(basePath, path.basename(sourceFolder))
        : path.join(basePath, destinationFolder, path.basename(sourceFolder));

      await fs.rename(sourcePath, destPath);
      return NextResponse.json({ success: true, message: 'Folder moved successfully' });
    }

    if (action === 'delete') {
      const { sessionId } = body;
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
      }
      const sessionPath = path.join(basePath, sessionId);
      try {
        await fs.rm(sessionPath, { recursive: true, force: true });
        return NextResponse.json({ success: true, message: 'Session deleted successfully' });
      } catch (err) {
        return NextResponse.json({ error: 'Failed to delete session: ' + err.message }, { status: 500 });
      }
    }

    if (action === 'clear-database') {
      try {
        const files = await fs.readdir(basePath);
        for (const file of files) {
          await fs.rm(path.join(basePath, file), { recursive: true, force: true });
        }
        return NextResponse.json({ success: true, message: 'Database cleared successfully' });
      } catch (err) {
        return NextResponse.json({ error: 'Failed to clear database: ' + err.message }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('API TGM Sessions Manage error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
