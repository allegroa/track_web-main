import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const CONFIG_DIR = path.join(process.cwd(), 'configuration');
const TOLERANCES_FILE = path.join(CONFIG_DIR, 'tolerances.json');

async function ensureDir() {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch (err) {
    // Ignorato se esiste già
  }
}

export async function GET(request) {
  await ensureDir();
  try {
    if (existsSync(TOLERANCES_FILE)) {
      const data = await fs.readFile(TOLERANCES_FILE, 'utf8');
      return NextResponse.json(data.trim() ? JSON.parse(data) : {});
    }
    return NextResponse.json({});
  } catch (err) {
    console.error('Error reading tolerances:', err);
    return NextResponse.json({});
  }
}

export async function POST(request) {
  await ensureDir();
  try {
    const data = await request.json();
    await fs.writeFile(TOLERANCES_FILE, JSON.stringify(data, null, 2), 'utf8');
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error saving tolerances:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
