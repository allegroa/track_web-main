import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import path from 'path';
import mime from 'mime-types';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetPath = searchParams.get('path');
  const action = searchParams.get('action'); // 'list', 'download', 'get-tolerances', 'get-singularities'
  const fileName = searchParams.get('file');

  if (!targetPath) {
    return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
  }

  try {
    const fullPath = path.normalize(targetPath);

    if (action === 'download' && fileName) {
      const filePath = path.join(fullPath, fileName);
      
      try {
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) {
          return NextResponse.json({ error: 'Not a file' }, { status: 400 });
        }

        const stream = createReadStream(filePath);
        const contentType = mime.lookup(filePath) || 'application/octet-stream';
        
        return new NextResponse(stream, {
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`
          }
        });
      } catch (err) {
        return NextResponse.json({ error: 'File not found or cannot be read' }, { status: 404 });
      }
    } else if (action === 'get-tolerances') {
      const dbPath = path.join(fullPath, 'tolerances_db.json');
      if (existsSync(dbPath)) {
        const data = await fs.readFile(dbPath, 'utf-8');
        return NextResponse.json(data.trim() ? JSON.parse(data) : {});
      }
      return NextResponse.json({});
    } else if (action === 'get-singularities') {
      if (!fileName) return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
      const parsed = path.parse(fileName);
      const dbPath = path.join(fullPath, `${parsed.name}_db.json`);
      if (existsSync(dbPath)) {
        const data = await fs.readFile(dbPath, 'utf-8');
        return NextResponse.json(data.trim() ? JSON.parse(data) : []);
      }
      return NextResponse.json([]);
    } else {
      // List files action
      const files = await fs.readdir(fullPath, { withFileTypes: true });
      const fileDetails = [];
      
      for (const dirent of files) {
        if (dirent.isFile() && (dirent.name.toLowerCase().endsWith('.csv') || dirent.name.toLowerCase().endsWith('.geo'))) {
          try {
            const stat = await fs.stat(path.join(fullPath, dirent.name));
            fileDetails.push({
              name: dirent.name,
              size: stat.size,
              createdAt: stat.birthtime || stat.mtime
            });
          } catch (e) {
            console.error('Error reading stat for', dirent.name);
          }
        }
      }

      return NextResponse.json({ files: fileDetails });
    }
  } catch (error) {
    console.error('API local-files GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, path: targetPath, file, data } = body;

    if (!targetPath) {
      return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
    }

    const fullPath = path.normalize(targetPath);
    if (!existsSync(fullPath)) {
      await fs.mkdir(fullPath, { recursive: true });
    }

    if (action === 'save-tolerances') {
      const dbPath = path.join(fullPath, 'tolerances_db.json');
      await fs.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf-8');
      return NextResponse.json({ message: 'Success' });
    } else if (action === 'save-singularities') {
      if (!file) return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
      const parsed = path.parse(file);
      const dbPath = path.join(fullPath, `${parsed.name}_db.json`);
      await fs.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf-8');
      return NextResponse.json({ message: 'Success' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('API local-files POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
