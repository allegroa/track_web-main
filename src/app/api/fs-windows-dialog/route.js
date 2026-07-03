import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function POST() {
  if (process.platform !== 'win32') {
    return NextResponse.json({ error: 'Operazione non supportata su questo sistema operativo. Usa Windows.' }, { status: 400 });
  }

  // Passiamo a VBScript per evitare policy, STA, shell issues o blocchi di PowerShell su Windows
  const vbsScript = `
Dim objShell, objFolder
Set objShell = CreateObject("Shell.Application")
' Il parametro 0 = handle, "Testo" = titolo, 0 = opzioni, 0 = root cartella
Set objFolder = objShell.BrowseForFolder(0, "Seleziona la Cartella Dati", 0, 0)
If TypeName(objFolder) <> "Nothing" Then
    WScript.Echo objFolder.Self.Path
End If
  `;

  const tempFilePath = path.join(os.tmpdir(), `browse_${Date.now()}.vbs`);
  
  try {
    await fs.writeFile(tempFilePath, vbsScript, 'utf8');
  } catch (err) {
    return NextResponse.json({ error: 'Failed to write temp file' }, { status: 500 });
  }

  return new Promise((resolve) => {
    // Usiamo cscript per eseguire VBScript (invisibile ed esente da ExecutionPolicy)
    execFile('cscript.exe', ['//Nologo', tempFilePath], async (error, stdout, stderr) => {
      // Pulisci il file temporaneo
      try { await fs.unlink(tempFilePath); } catch (e) {}

      if (error) {
        console.error('Errore esecuzione cscript', error);
        resolve(NextResponse.json({ error: error.message }, { status: 500 }));
        return;
      }
      
      const p = stdout.trim();
      resolve(NextResponse.json({ path: p }));
    });
  });
}
