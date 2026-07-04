import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const CONFIG_DIR = path.join(process.cwd(), 'configuration');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

async function ensureDir() {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch (err) {
    // Ignorato se esiste già
  }
}

async function readConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {
      activeOperator: '',
      operators: {},
      emailConfig: {
        email: 'railpulse@adts.it',
        password: 'RaIlpul1!26',
        pollingInterval: 15,
        imapHost: 'imap.adts.it',
        imapPort: 993,
        imapSecure: true,
        smtpHost: 'smtp.adts.it',
        smtpPort: 465,
        smtpSecure: true
      }
    };
  }
}

export async function GET(request) {
  await ensureDir();
  const config = await readConfig();
  return NextResponse.json(config);
}

export async function POST(request) {
  await ensureDir();
  try {
    const body = await request.json();
    const { activeOperator, operators, emailConfig } = body;

    const currentConfig = await readConfig();

    const newConfig = {
      activeOperator: activeOperator !== undefined ? activeOperator : currentConfig.activeOperator,
      operators: operators || currentConfig.operators || {},
      emailConfig: emailConfig !== undefined ? emailConfig : (currentConfig.emailConfig || {
        email: 'railpulse@adts.it',
        password: 'RaIlpul1!26',
        pollingInterval: 15,
        imapHost: 'imap.adts.it',
        imapPort: 993,
        imapSecure: true,
        smtpHost: 'smtp.adts.it',
        smtpPort: 465,
        smtpSecure: true
      })
    };

    await fs.writeFile(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf8');
    return NextResponse.json({ success: true, config: newConfig });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
