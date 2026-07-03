import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(request, context) {
  // In Next.js 15, `context.params` is a Promise
  const params = await context.params;
  const sessionId = params.id;
  
  const { searchParams } = new URL(request.url);
  const targetPath = searchParams.get('path');
  const fileName = searchParams.get('file');

  if (!targetPath) {
    return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
  }

  if (!fileName) {
    return NextResponse.json({ error: 'File parameter is required' }, { status: 400 });
  }

  try {
    const fullPath = path.normalize(targetPath);
    const sessionFolderPath = path.join(fullPath, sessionId);
    
    // Find actual file in directory since it might have a timestamp prefix
    let actualFileName = fileName;
    if (fs.existsSync(sessionFolderPath)) {
      const files = fs.readdirSync(sessionFolderPath);
      const match = files.find(f => f.includes(fileName));
      if (match) actualFileName = match;
    }
    const filePath = path.join(sessionFolderPath, actualFileName);

    // Verify file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File non trovato: ' + fileName }, { status: 404 });
    }

    // Read file as buffer
    const fileBuffer = fs.readFileSync(filePath);

    // Return as Blob/Text
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });

  } catch (error) {
    console.error(`API TGM Session Raw Data GET error for ${sessionId}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
