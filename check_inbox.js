const imaps = require('imap-simple');

async function test() {
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
      markSeen: false
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    console.log(`Found ${messages.length} unseen messages`);

    for (const message of messages) {
      const parts = imaps.getParts(message.attributes.struct);
      const attachments = parts.filter(part => 
        part.disposition && part.disposition.type.toUpperCase() === 'ATTACHMENT'
      );
      
      console.log(`  Attachments count: ${attachments.length}`);
      for (const att of attachments) {
        const filename = att.params?.name || att.disposition?.params?.filename;
        console.log(`  - Attachment: ${filename}`);
      }
    }
    
    connection.end();
  } catch (err) {
    console.error(err);
  }
}

test();
