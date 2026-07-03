import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    let currentPath = body.currentPath || '';
    
    // Se nessun path fornito su Windows, lista i dischi
    if (!currentPath && process.platform === 'win32') {
      const drives = [];
      const driveLetters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      await Promise.all(
        driveLetters.map(async (char) => {
          const root = char + ':\\';
          try {
            await fs.stat(root);
            drives.push({ name: root, isDir: true, path: root });
          } catch (e) {
            // Disco inesistente o inaccessibile
          }
        })
      );
      
      if (drives.length === 0) {
        drives.push({ name: 'C:\\', isDir: true, path: 'C:\\' });
      }
      
      drives.sort((a, b) => a.name.localeCompare(b.name));
      return NextResponse.json({ files: drives, currentPath: '' });
    }

    if (!currentPath) {
      currentPath = '/';
    }

    try {
      const items = await fs.readdir(currentPath, { withFileTypes: true });
      
      const files = items
        .filter(dirent => dirent.isDirectory())
        .map(dirent => ({
          name: dirent.name,
          isDir: true,
          path: path.join(currentPath, dirent.name)
        }));

      // Ordina in ordine alfabetico
      files.sort((a, b) => a.name.localeCompare(b.name));

      return NextResponse.json({ files, currentPath });
    } catch (fsError) {
      return NextResponse.json({ error: 'Impossibile leggere la directory: ' + fsError.message }, { status: 403 });
    }
    
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
