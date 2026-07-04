const imaps = require('imap-simple');

async function testDelete() {
  const config = {
    imap: {
      user: 'railpulse@adts.it',
      password: 'RaIlpul1!26',
      host: 'imap.adts.it',
      port: 993,
      tls: true,
      authTimeout: 5000,
      tlsOptions: { rejectUnauthorized: false }
    }
  };

  try {
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    const searchCriteria = ['ALL'];
    const fetchOptions = {
      bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
      struct: true,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    console.log(`Found ${messages.length} messages in INBOX`);

    for (const message of messages) {
      const parts = imaps.getParts(message.attributes.struct);
      const attachments = parts.filter(part => 
        part.disposition && part.disposition.type.toUpperCase() === 'ATTACHMENT'
      );
      
      console.log(`- MSG UID ${message.attributes.uid}: Attachments: ${attachments.length}`);
      // Let's check flags
      console.log(`  Flags:`, message.attributes.flags);
    }

    // Try expunge anyway
    await new Promise((resolve, reject) => {
      connection.imap.expunge((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Expunge completed');
    
    connection.end();
  } catch (err) {
    console.error(err);
  }
}

testDelete();
