import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import fs from 'fs/promises';
import path from 'path';

const TMP_UPLOAD_DIR = path.join(process.cwd(), 'tmp_uploads', 'email_queue');
const LOG_FILE = path.join(process.cwd(), 'configuration', 'email_receipts.log');

export async function checkNewEmails(emailConfig) {
  const { email, password, imapHost, imapPort, imapSecure } = emailConfig;

  // Use configured host and port, fallback to generic guess if not provided
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
      authTimeout: 10000,
      tlsOptions: { rejectUnauthorized: false } // For self-signed certs just in case
    }
  };

  await fs.mkdir(TMP_UPLOAD_DIR, { recursive: true });
  
  let connection;
  const downloadedFiles = [];

  try {
    connection = await imaps.connect(config);
    await connection.openBox('INBOX');
    let deletedEmailsCount = 0;

    // Search for all emails
    const searchCriteria = ['ALL'];
    const fetchOptions = {
      bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
      struct: true,
      markSeen: false // We will delete manually after successful processing
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    for (const message of messages) {
      const parts = imaps.getParts(message.attributes.struct);
      const attachments = parts.filter(part => 
        part.disposition && part.disposition.type.toUpperCase() === 'ATTACHMENT'
      );

      let hasValidAttachment = false;

      for (const attachment of attachments) {
        const filename = attachment.params?.name || attachment.disposition?.params?.filename;
        if (filename && (filename.toLowerCase().endsWith('.zip') || filename.toLowerCase().endsWith('.rar'))) {
          // Fetch the attachment part
          const partData = await connection.getPartData(message, attachment);
          
          // Save the attachment
          const safeFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
          const filepath = path.join(TMP_UPLOAD_DIR, safeFilename);
          
          await fs.writeFile(filepath, partData);
          downloadedFiles.push({
            originalName: filename,
            savedPath: filepath,
            date: message.attributes.date,
            messageUid: message.attributes.uid
          });
          
          hasValidAttachment = true;
        }
      }

      // If we processed this email and it had what we wanted, mark it as deleted and log it
      if (hasValidAttachment) {
        await connection.addFlags(message.attributes.uid, '\\Deleted');
        deletedEmailsCount++;
        
        // Try to get sender from headers
        let sender = 'Sconosciuto';
        try {
          const headerPart = message.parts?.find(part => part.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)');
          if (headerPart && headerPart.body) {
            const parsedHeader = await simpleParser(headerPart.body);
            sender = parsedHeader.from?.text || parsedHeader.from?.value?.[0]?.address || 'Sconosciuto';
          }
        } catch (err) {
          console.error('Error parsing email header for log:', err);
        }

        const justDownloaded = downloadedFiles.filter(f => f.messageUid === message.attributes.uid);
        const fileNames = justDownloaded.map(f => f.originalName).join(', ');
        
        const logEntry = `[${new Date().toISOString()}] Ricevuto da: ${sender} | File scaricati: ${fileNames}\n`;
        try {
          await fs.appendFile(LOG_FILE, logEntry, 'utf8');
        } catch (err) {
          console.error('Error writing to email log:', err);
        }
      }
    }

    // Expunge the mailbox to permanently remove messages flagged as \Deleted
    if (deletedEmailsCount > 0) {
      await new Promise((resolve, reject) => {
        connection.imap.expunge((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    return { success: true, downloadedFiles, count: downloadedFiles.length };

  } catch (error) {
    console.error('Error checking emails:', error);
    return { success: false, error: error.message };
  } finally {
    if (connection) {
      connection.end();
    }
  }
}
