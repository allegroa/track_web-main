import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('file');

    if (!fileName) {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 });
    }

    // Security check to prevent path traversal
    const safeName = path.basename(fileName);
    const emailQueueDir = path.join(process.cwd(), 'tmp_uploads', 'email_queue');
    const filePath = path.join(emailQueueDir, safeName);

    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
    } catch (e) {
      // Ignore if file doesn't exist
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
