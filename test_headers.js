import fs from 'fs';
import path from 'path';
const csvFile = 'E:/Software/track_web-main/database/20260226/軌道參數報表.csv';
const buffer = fs.readFileSync(csvFile);
const text = buffer.toString('utf-8');
const firstLine = text.split('\n').find(l => l.includes('(mm)'));
console.log(firstLine);
const headers = firstLine.split(',');
headers.forEach(h => console.log(h, Buffer.from(h).toString('hex')));
