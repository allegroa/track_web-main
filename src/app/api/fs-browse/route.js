import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetPath = searchParams.get('path');

  try {
    if (!targetPath) {
      // Se non viene specificato il path, elenca i drive su Windows
      if (process.platform === 'win32') {
        const { stdout } = await execAsync('wmic logicaldisk get caption');
        const drives = stdout
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length === 2 && line.endsWith(':'))
          .map(drive => ({
            name: drive + '\\',
            path: drive + '\\',
            isDirectory: true
          }));
        return NextResponse.json({ path: '', items: drives });
      } else {
        // Fallback Unix
        return NextResponse.json({ path: '/', items: [{ name: '/', path: '/', isDirectory: true }] });
      }
    }

    // Se c'è un path, elenca le directory al suo interno
    const fullPath = path.normalize(targetPath);
    const files = await fs.readdir(fullPath, { withFileTypes: true });
    
    const directories = files
      .filter(dirent => dirent.isDirectory())
      .map(dirent => ({
        name: dirent.name,
        path: path.join(fullPath, dirent.name),
        isDirectory: true
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ path: fullPath, items: directories });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
