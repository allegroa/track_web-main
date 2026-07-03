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
