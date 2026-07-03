const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const webone = path.join(root, '..', 'frontend_webbone');

const copies = [
  ['src/utils/geoParser.js', 'src/lib/geoParser.js'],
  ['src/components/DefectTable.jsx', 'src/components/DefectTable.jsx'],
  ['src/pages/DataVizualizer.jsx', 'src/components/DataVisualizer.jsx'],
];

for (const [src, dest] of copies) {
  const srcPath = path.join(webone, src);
  const destPath = path.join(root, dest);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  let content = fs.readFileSync(srcPath, 'utf8');
  if (dest.endsWith('DefectTable.jsx')) {
    content = `'use client';\n\n${content}`;
  }
  if (dest.endsWith('DataVisualizer.jsx')) {
    content = content
      .replace(
        /^import \{ useEffect, useState, useMemo, useRef \} from "react";/,
        `'use client';\n\nimport { useEffect, useState, useMemo, useRef } from "react";`
      )
      .replace(
        "import axios from 'axios';\nimport React from 'react';\nimport { useTranslation } from 'react-i18next';\nimport { useSearchParams } from 'react-router-dom';\nimport { parseGeoBuffer } from '../utils/geoParser';",
        "import React from 'react';\nimport { useTranslation } from 'react-i18next';\nimport { useSearchParams } from 'next/navigation';\nimport { api, authHeaders } from '../lib/api';\nimport { useAuthToken } from '../lib/auth';\nimport '../lib/i18n';\nimport { parseGeoBuffer } from '../lib/geoParser';"
      )
      .replace(
        "import DefectTable from '../components/DefectTable';",
        "import DefectTable from './DefectTable';"
      )
      .replace(
        'const [searchParams] = useSearchParams();',
        'const searchParams = useSearchParams();'
      )
      .replace(
        'const token = localStorage.getItem(\'token\');',
        'const token = useAuthToken();'
      )
      .replace(/\baxios\.(get|post|patch|delete)\(/g, 'api.$1(')
      .replace(
        /\{ headers: \{ Authorization: `Bearer \$\{token\}` \} \}/g,
        '{ headers: authHeaders(token) }'
      )
      .replace(
        /\{ headers: \{ Authorization: `Bearer \$\{token\}`, 'Content-Type': 'multipart\/form-data' \} \}/g,
        "{ headers: { ...authHeaders(token), 'Content-Type': 'multipart/form-data' } }"
      )
      .replace(
        /\{ headers: \{ Authorization: `Bearer \$\{token\}` \}, responseType: 'blob' \}/g,
        "{ headers: authHeaders(token), responseType: 'blob' }"
      );
  }
  fs.writeFileSync(destPath, content, 'utf8');
  console.log('Wrote', dest);
}
