import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import Papa from 'papaparse';

export async function GET(request, context) {
  const params = await context.params;
  const sessionId = params.id;
  
  const { searchParams } = new URL(request.url);
  const targetPath = searchParams.get('path');
  const fileName = searchParams.get('file'); // expecting 軌道參數報表.csv
  const sampleSize = parseInt(searchParams.get('sampleSize') || '2000', 10);

  if (!targetPath || !fileName) {
    return NextResponse.json({ error: 'Path and file parameters are required' }, { status: 400 });
  }

  try {
    const fullPath = path.normalize(targetPath);
    const sessionFolderPath = path.join(fullPath, sessionId);
    
    // Check for cached downsampled file
    const cachedFileName = `.downsampled_${sampleSize}.json`;
    const cachedFilePath = path.join(sessionFolderPath, cachedFileName);
    
    if (fs.existsSync(cachedFilePath)) {
      const cachedData = fs.readFileSync(cachedFilePath, 'utf-8');
      return NextResponse.json(JSON.parse(cachedData));
    }

    // Find actual raw file since it might have a timestamp prefix
    let actualFileName = fileName;
    if (fs.existsSync(sessionFolderPath)) {
      const files = fs.readdirSync(sessionFolderPath);
      const match = files.find(f => f.includes(fileName));
      if (match) actualFileName = match;
    }
    const rawFilePath = path.join(sessionFolderPath, actualFileName);

    if (!fs.existsSync(rawFilePath)) {
      return NextResponse.json({ error: 'Raw file not found: ' + fileName }, { status: 404 });
    }

    const fileContent = fs.readFileSync(rawFilePath, 'utf-8');

    // Two-pass parsing in memory
    let totalDataRows = 0;
    let headerFound = false;
    let headers = [];
    let metadataLines = [];

    // Pass 1: count and find header
    Papa.parse(fileContent, {
      skipEmptyLines: true,
      step: (results) => {
        const row = results.data;
        if (!headerFound) {
          const lower = row.map(c => (c || '').toString().trim().toLowerCase());
          if (lower.some(c => c === 'km' || c.includes('km'))) {
            headerFound = true;
            headers = row.map(c => (c || '').toString().replace(/[^\x20-\x7E]/g, '').trim());
          } else {
            metadataLines.push(row.join(';'));
          }
          return;
        }
        totalDataRows++;
      }
    });

    // Determine target indices for downsampling
    const targets = new Set();
    if (totalDataRows > sampleSize) {
      const step = totalDataRows / sampleSize;
      for (let i = 0; i < sampleSize; i++) {
        targets.add(Math.floor(i * step));
      }
    } else {
      for (let i = 0; i < totalDataRows; i++) targets.add(i);
    }

    // Pass 2: collect sampled rows
    const sampledRows = [];
    let dataIndex = -1;
    let headerFound2 = false;

    Papa.parse(fileContent, {
      skipEmptyLines: true,
      step: (results) => {
        const row = results.data;
        if (!headerFound2) {
          const lower = row.map(c => (c || '').toString().trim().toLowerCase());
          if (lower.some(c => c === 'km' || c.includes('km'))) {
            headerFound2 = true;
          }
          return;
        }
        dataIndex++;
        if (targets.has(dataIndex)) {
          const obj = {};
          for (let i = 0; i < headers.length; i++) {
            obj[headers[i]] = row[i];
          }
          sampledRows.push(obj);
        }
      }
    });

    const responsePayload = {
      metadataLines,
      headers,
      sampledRows,
      totalDataRows,
      sampleSize
    };

    // Save to cache
    fs.writeFileSync(cachedFilePath, JSON.stringify(responsePayload), 'utf-8');

    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error(`API TGM Downsample GET error for ${sessionId}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
