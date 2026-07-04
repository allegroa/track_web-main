import { NextResponse } from 'next/server';
import imaps from 'imap-simple';

export async function POST(request) {
  try {
    const emailConfig = await request.json();
    const { email, password, imapHost, imapPort, imapSecure } = emailConfig;

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Indirizzo email o password mancanti.' }, { status: 400 });
    }

    const domain = email.split('@')[1];
    const host = imapHost || `mail.${domain}`;
    const port = imapPort || 993;
    const isTls = imapSecure !== undefined ? imapSecure : true;

    const config = {
      imap: {
        user: email,
        password: password,
        host: host,
        port: port,
        tls: isTls,
        authTimeout: 5000, // Short timeout for testing
        tlsOptions: { rejectUnauthorized: false }
      }
    };

    const connection = await imaps.connect(config);
    // If it connects successfully, we close it and return success
    connection.end();

    return NextResponse.json({ success: true, message: 'Connessione IMAP stabilita con successo!' });
  } catch (error) {
    console.error('Email test error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
