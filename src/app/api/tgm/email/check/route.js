import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { checkNewEmails } from '../../../../../lib/emailService';

const CONFIG_FILE = path.join(process.cwd(), 'configuration', 'config.json');
const TMP_UPLOAD_DIR = path.join(process.cwd(), 'tmp_uploads', 'email_queue');

async function getEmailConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    const config = JSON.parse(data);
    return config.emailConfig || null;
  } catch (err) {
    return null;
  }
}

// GET lists the current files in the queue
export async function GET(request) {
  try {
    await fs.mkdir(TMP_UPLOAD_DIR, { recursive: true });
    const files = await fs.readdir(TMP_UPLOAD_DIR);
    
    // We only care about actual files
    const fileStats = await Promise.all(
      files.map(async (file) => {
        const stat = await fs.stat(path.join(TMP_UPLOAD_DIR, file));
        return { name: file, size: stat.size, time: stat.mtimeMs };
      })
    );
    
    // Sort by oldest first
    fileStats.sort((a, b) => a.time - b.time);

    return NextResponse.json({
      success: true,
      files: fileStats.map(f => f.name),
      count: fileStats.length
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST triggers a manual or scheduled check via IMAP
export async function POST(request) {
  const emailConfig = await getEmailConfig();
  
  if (!emailConfig || !emailConfig.email || !emailConfig.password) {
    return NextResponse.json({ success: false, error: 'Email configuration is missing or incomplete.' }, { status: 400 });
  }

  const result = await checkNewEmails(emailConfig);
  
  if (!result.success) {
    return NextResponse.json(result, { status: 500 });
  }
  
  // Return updated file list
  const currentFiles = await GET(request).then(res => res.json());

  return NextResponse.json({
    success: true,
    newFilesDownloaded: result.count,
    queueCount: currentFiles.count,
    files: currentFiles.files
  });
}
