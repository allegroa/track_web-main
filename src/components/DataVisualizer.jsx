'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import TGMDatabaseContainer from '../../TGM/frontend/components/TGMDatabaseContainer';
import Papa from "papaparse";
import { Line } from "react-chartjs-2";
// Chart.js v4 requires explicit registration of scales/controllers/elements/plugins
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';


import { useTranslation } from 'react-i18next';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, authHeaders } from '../lib/api';
import { useAuthToken } from '../lib/auth';
import '../lib/i18n';
import { parseGeoBuffer } from '../lib/geoParser';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import DefectTable from './DefectTable';

// Register commonly used components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, zoomPlugin, annotationPlugin);

const formatRailwayKm = (metersValue) => {
  const num = Number(metersValue);
  if (isNaN(num)) return String(metersValue);
  const isNeg = num < 0;
  const absNum = Math.abs(num);
  const km = Math.floor(absNum / 1000);
  const meters = Math.round(absNum % 1000);
  return (isNeg ? '-' : '') + km + '+' + meters.toString().padStart(3, '0');
};

// Fix leaflet icon paths
try {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
} catch(e) { console.error('Leaflet icon config error', e); }

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.panTo(center); // panTo preserves user zoom level
    }
  }, [center, map]);
  return null;
}

// Simple error boundary to prevent a chart error from blanking the whole page
class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('Chart render error', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <div className="text-red-600 font-medium">Unable to render chart</div>
          <div className="text-sm text-slate-600 mt-2">{String(this.state.error)}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

function DataVisualizer() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAuthToken();
  const chartRef = useRef(null);
  const hoverThrottleRef = useRef(0); // throttle map updates to ~30fps
  const [hoveredCoords, setHoveredCoords] = useState(null);
  const [singularities, setSingularities] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [defectStats, setDefectStats] = useState({});
  const [tolerances, setTolerances] = useState({});
  const [sectionLength, setSectionLength] = useState(200);

  const loadTolerances = async () => {
    try {
      const res = await fetch('/api/configuration/tolerances');
      const data = await res.json();
      if (data) {
        setTolerances(data);
      } else {
        setTolerances({});
      }
    } catch (e) {
      console.error("Error loading tolerances", e);
      setTolerances({});
    }
  };

  const saveTolerances = async (nextTolerances) => {
    try {
      await fetch('/api/configuration/tolerances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextTolerances)
      });
    } catch (e) {
      console.error("Error saving tolerances", e);
    }
  };

  useEffect(() => {
    // Non carichiamo le tolleranze qui per evitare "Network error" asincroni. 
    // Vengono caricate in loadServerCsv quando apriamo un file.
  }, [token, searchParams]);

  const updateTolerance = (col, val) => {
    setTolerances(prev => {
      const next = { ...prev, [col]: val };
      saveTolerances(next);
      return next;
    });
  };

  const [csvData, setCsvData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [selectedX, setSelectedX] = useState("");
  const [selectedYs, setSelectedYs] = useState([]); // allow multiple Y series
  const [availableFiles, setAvailableFiles] = useState([]);
  const [metadata, setMetadata] = useState([]);
  // parsed metadata key/value pairs derived from metadata lines
  const [infoPairs, setInfoPairs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [parseProgress, setParseProgress] = useState(null);
  const [isFullLoad, setIsFullLoad] = useState(false);
  const [sampledRows, setSampledRows] = useState([]);
  const [sampleSize, setSampleSize] = useState(2000); // reservoir size for sampling large files
  const [useSampling, setUseSampling] = useState(true);
  const [lastLocalFile, setLastLocalFile] = useState(null);
  const [lastServerFile, setLastServerFile] = useState(null);
  const [uploadCandidate, setUploadCandidate] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // { type: 'success'|'error', msg }
  const [parseError, setParseError] = useState(null);
  const [uploadInProgress, setUploadInProgress] = useState(false);
  // paging removed: sampling is controlled by sampleSize and kmRange
  const [kmMinInput, setKmMinInput] = useState('');
  const [kmMaxInput, setKmMaxInput] = useState('');
  const [kmRange, setKmRange] = useState(null); // { min, max } applied
  const [showYMenu, setShowYMenu] = useState(false);
  const [geoDatasets, setGeoDatasets] = useState([]);
  const [showGeoModal, setShowGeoModal] = useState(false);
  const [opConfig, setOpConfig] = useState(null);

  const loadActiveOperatorConfig = async () => {
    try {
      const res = await fetch('/api/configuration');
      const data = await res.json();
      const activeOp = data.activeOperator;
      if (activeOp && data.operators && data.operators[activeOp]) {
        const conf = data.operators[activeOp];
        if (conf.language) {
          i18n.changeLanguage(conf.language);
        } else {
          i18n.changeLanguage('en');
        }
        if (conf.sampleSize !== undefined) {
          setSampleSize(conf.sampleSize);
        }
        if (conf.sectionLength !== undefined) {
          setSectionLength(conf.sectionLength);
        }
        if (conf.useSampling !== undefined) {
          setUseSampling(conf.useSampling);
        }
        if (conf.selectedX) {
          setSelectedX(conf.selectedX);
        }
        setOpConfig(conf);
        fetchFiles(conf);
      } else {
        i18n.changeLanguage('en'); // fallback
        fetchFiles(null);
      }
    } catch (e) {
      console.error("Errore nel caricamento della configurazione", e);
      i18n.changeLanguage('en');
      fetchFiles(null);
    }
  };

  useEffect(() => {
    loadActiveOperatorConfig();
  }, []);

  // AutoAlign function
  const autoAlign = (targetGeoId) => {
    if (geoDatasets.length < 2) return;
    const refGeo = geoDatasets[0];
    const targetGeo = geoDatasets.find(g => g.id === targetGeoId);
    if (!refGeo || !targetGeo || !selectedX || selectedYs.length === 0) return;

    const col = selectedYs[0];
    let bestOffset = 0;
    let minError = Infinity;

    const refPts = [];
    const step = Math.max(1, Math.floor(refGeo.data.length / 100));
    for (let i = 0; i < refGeo.data.length; i += step) {
      const x = parseNumberCell(refGeo.data[i][selectedX]);
      const y = Number(String(refGeo.data[i][col]).replace(',', '.'));
      if (!isNaN(x) && !isNaN(y)) refPts.push({ x, y });
    }

    const getTargetY = (x) => {
      let left = null, right = null;
      for (let i = 0; i < targetGeo.data.length; i += Math.max(1, Math.floor(targetGeo.data.length / 1000))) {
        const tx = parseNumberCell(targetGeo.data[i][selectedX]);
        if (isNaN(tx)) continue;
        if (tx <= x) {
           if (!left || tx > left.x) left = { x: tx, y: Number(String(targetGeo.data[i][col]).replace(',', '.')) };
        }
        if (tx >= x) {
           if (!right || tx < right.x) right = { x: tx, y: Number(String(targetGeo.data[i][col]).replace(',', '.')) };
        }
      }
      if (left && right) {
        if (left.x === right.x) return left.y;
        return left.y + (right.y - left.y) * (x - left.x) / (right.x - left.x);
      }
      return null;
    };

    for (let offset = -0.100; offset <= 0.100; offset += 0.001) {
      let error = 0;
      let count = 0;
      for (const p of refPts) {
        const ty = getTargetY(p.x - offset);
        if (ty !== null && !isNaN(ty)) {
          error += Math.pow(p.y - ty, 2);
          count++;
        }
      }
      if (count > 0) {
        const meanError = error / count;
        if (meanError < minError) {
          minError = meanError;
          bestOffset = offset;
        }
      }
    }
    // Set fixed precision to avoid floating point issues
    bestOffset = parseFloat(bestOffset.toFixed(3));
    setGeoDatasets(prev => prev.map(g => g.id === targetGeoId ? { ...g, offset: bestOffset } : g));
  };


  // Resample: re-run parsing to obtain a fresh reservoir. We keep memory O(sampleSize) by
  // discarding previous reservoir and building a new one. For server files we re-download,
  // for local files we need the File object to re-parse.
  const resample = async () => {
    setParseProgress({ parsed: 0 });
    setSampledRows([]);
    // Re-run parse on last source, passing current sampleSize and respecting useSampling
    if (lastLocalFile) {
      handleLocalFile(lastLocalFile, sampleSize, !useSampling);
    } else if (lastServerFile) {
      loadServerCsv(lastServerFile.file, lastServerFile.folder, sampleSize, !useSampling);
    }
  };

  // Helper to parse semicolon-delimited CSVs and convert comma decimals to dot
  function parseCsvText(text) {
    // We'll try to detect a header row by looking for common field names like ID or km
    // Split into lines and find the first line that, when split by ';', contains 'ID' or 'km' (case-insensitive)
    const allLines = text.split(/\r?\n/);
    const lines = allLines.filter(l => l.trim() !== '');
    let headerLineIndex = -1;
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const parts = lines[i].split(/[,;\t|]/).map(p => p.trim().toLowerCase());
      if (parts.includes('id') || parts.includes('km')) {
        headerLineIndex = i;
        break;
      }
    }
    // If not found, fallback to first non-empty line
    if (headerLineIndex === -1) headerLineIndex = 0;

    // We need to find the corresponding index in the original allLines array to capture metadata accurately
    // Find the Nth non-empty line position
    let nonEmptyCount = 0;
    let headerGlobalIndex = 0;
    for (let i = 0; i < allLines.length; i++) {
      if (allLines[i].trim() === '') continue;
      if (nonEmptyCount === headerLineIndex) { headerGlobalIndex = i; break; }
      nonEmptyCount++;
    }

    // Build a substring starting from the header global index so Papa parses header correctly
    const relevantText = allLines.slice(headerGlobalIndex).join('\n');

    // Capture metadata lines: those before headerGlobalIndex
    const metadataLines = allLines.slice(0, headerGlobalIndex).filter(l => l.trim() !== '');

    const parsed = Papa.parse(relevantText, { header: true, skipEmptyLines: true });
    const data = parsed.data.map(row => {
      const out = {};
      Object.keys(row).forEach(k => {
        const cleanKey = k.replace(/[^\x20-\x7E]/g, '').trim();
        let v = row[k];
        if (typeof v === 'string') {
          // convert european decimals: '1,234' -> '1.234' only if it looks like a number
          const numericLike = v.match(/^\s*-?\d+[,\.]\d+\s*$/);
          if (numericLike) v = v.replace(',', '.');
          v = v.trim();
        }
        out[cleanKey] = v;
      });
      return out;
    });
    const hdrs = (parsed.meta.fields || (data[0] ? Object.keys(data[0]) : [])).map(h => h.replace(/[^\x20-\x7E]/g, '').trim());

    // Auto-guess defaults: if there's a header 'km', set it as default X and select numeric columns as Y
    const lower = hdrs.map(h => (h || '').toLowerCase());
    const hasKm = lower.includes('km');
    return { data, hdrs, headerLineIndex, hasKm, metadataLines };
  
  }

  // Transform metadata lines (each a semicolon-separated string) into key/value pairs
  // Decodifica i metadati "sporchi" dal Big5
  function translateMangled(text, isKey) {
    if (!text) return text;
    // Rimuove i caratteri "Replacement Character" () causati dalla cattiva decodifica UTF-8
    const clean = String(text).replace(/\ufffd/g, '').trim();
    if (clean === 'uW') return 'Line Name';
    if (clean === 'uO') return 'Line Type';
    if (clean === 'W' && isKey) return 'Report Name';
    if (clean === 'W' && !isKey) return 'Downward';
    if (clean === 'U' && !isKey) return 'Upward';
    if (clean === 'yDѼƳ') return 'Track Parameter Report';
    if (clean === 'qH') return 'Surveyor';
    if (clean === '}l{') return 'Start Mileage';
    if (clean === '{') return 'End Mileage';
    if (clean === '{W') return 'Mileage Decrease';
    if (clean === 'i') return 'Wavelength';
    if (clean === '25-3̪i' || clean.includes('25-3')) return '25m - 3m Wavelength';
    if (clean === 'q') return 'Measurement Date';
    if (clean === 'qɨ') return 'Measurement Time';
    return text; // Fallback
  }

  // We assume metadata tokens come in pairs: key;value;key;value;...
  function parseMetadataLines(lines) {
    const pairs = [];
    if (!lines || !lines.length) return pairs;
    lines.forEach(line => {
      const tokens = line.split(';').map(t => t.trim()).filter(t => t !== '');
      for (let i = 0; i < tokens.length; i += 2) {
        let key = tokens[i] || '';
        let value = tokens[i+1] || '';
        if (key.toLowerCase().includes('km')) {
          const num = Number(value.replace(',', '.'));
          if (!isNaN(num)) {
            value = formatRailwayKm(num);
          }
        }
        
        // Applica la traduzione dal mangled Big5
        key = translateMangled(key, true);
        value = translateMangled(value, false);

        if (key === 'Start Mileage' || key === 'End Mileage') {
          const num = Number(value);
          if (!isNaN(num)) {
            value = num.toFixed(3) + ' km';
          }
        } else if (key === 'Measurement Date') {
          // Format from 'YYYY.MM.DD' to 'Month DD, YYYY'
          const dateParts = value.split(/[./-]/);
          if (dateParts.length >= 3) {
            const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            if (!isNaN(dateObj.getTime())) {
              value = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            }
          }
        }

        pairs.push({ key, value });
      }
    });
    return pairs;
  }

  // Helper: robust number parsing (handles European commas)
  function parseNumberCell(v) {
    if (v == null) return NaN;
    let s = String(v).trim();
    // remove enclosing quotes
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1);
    }
    s = s.replace(/\s+/g, '');
    // If both '.' and ',' exist, decide which is decimal by last occurrence
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastDot !== -1 && lastComma !== -1) {
      if (lastComma > lastDot) {
        // comma is decimal separator, remove dots as thousands
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        // dot is decimal separator, remove commas
        s = s.replace(/,/g, '');
      }
    } else if (lastComma !== -1) {
      // only comma present: treat comma as decimal separator
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // only dot or no separator: remove any commas (shouldn't exist) and keep dots
      s = s.replace(/,/g, '');
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  // Load list of files from server 'upload' folder or custom configuration path
  const fetchFiles = async (configOverride = null) => {
    try {
      const conf = configOverride || opConfig;
      if (conf && conf.dataSourcePath) {
        const res = await fetch(`/api/local-files?path=${encodeURIComponent(conf.dataSourcePath)}`);
        const data = await res.json();
        setAvailableFiles(data.files || []);
        return;
      }
      const folderParam = searchParams.get('folder') || 'upload';
      const res = await api.get(`/api/files/${encodeURIComponent(folderParam)}`, { headers: authHeaders(token) });
      setAvailableFiles(res.data?.files || []);
    } catch (err) {
      // silently ignore
      setAvailableFiles([]);
    }
  };

  useEffect(() => { loadActiveOperatorConfig(); }, []);

  const [defectPdfState, setDefectPdfState] = useState({});
  const [defectValidState, setDefectValidState] = useState({});

  const calculatedDefects = useMemo(() => {
    if (!selectedX || !selectedYs.length) return [];
    
    let sources = [];
    if (geoDatasets && geoDatasets.length > 0) {
      sources = geoDatasets.filter(g => g.visible).map(g => ({ data: g.data, offset: g.offset || 0 }));
    } else {
      const src = (sampledRows && sampledRows.length > 0 && useSampling) ? sampledRows : csvData;
      if (src && src.length > 0) {
        sources = [{ data: src, offset: 0 }];
      }
    }

    if (!sources.length) return [];

    const defects = [];
    let defectIdCounter = 0;

    selectedYs.forEach(col => {
      const toll = tolerances[col];
      if (!toll || toll <= 0) return;

      sources.forEach((srcObj, srcIdx) => {
        let inDefect = false;
        let startKm = null;
        let endKm = null;
        let maxD = 0;

        for (let i = 0; i < srcObj.data.length; i++) {
          const row = srcObj.data[i];
          const rawKm = parseNumberCell(row[selectedX]);
          const val = parseNumberCell(row[col]);
          
          if (isNaN(rawKm) || isNaN(val)) continue;
          
          const kmVal = rawKm + srcObj.offset;
          const absVal = Math.abs(val);
          const isOut = absVal > toll;

          if (isOut) {
            if (!inDefect) {
              inDefect = true;
              startKm = kmVal;
              endKm = kmVal;
              maxD = absVal;
            } else {
              endKm = kmVal;
              if (absVal > maxD) maxD = absVal;
            }
          } else {
            if (inDefect) {
              const pA = ((maxD - toll) / toll) * 100;
              const pB = 100; // Placeholder for Estensione
              const id = `defect-${col}-${srcIdx}-${defectIdCounter++}`;
              defects.push({
                id,
                channel: col,
                description: col,
                kmStart: startKm,
                kmEnd: endKm,
                threshold: toll,
                maxDefect: maxD,
                priority: pA,
                priorityB: pB,
                pdf: !!defectPdfState[id],
                validated: !!defectValidState[id]
              });
              inDefect = false;
            }
          }
        }
        if (inDefect) {
          const pA = ((maxD - toll) / toll) * 100;
          const pB = 100;
          const id = `defect-${col}-${srcIdx}-${defectIdCounter++}`;
          defects.push({
            id,
            channel: col,
            description: col,
            kmStart: startKm,
            kmEnd: endKm,
            threshold: toll,
            maxDefect: maxD,
            priority: pA,
            priorityB: pB,
            pdf: !!defectPdfState[id],
            validated: !!defectValidState[id]
          });
        }
      });
    });

    return defects;
  }, [csvData, sampledRows, useSampling, geoDatasets, selectedX, selectedYs, tolerances, defectPdfState, defectValidState]);

  const handlePdfChange = (id, val) => setDefectPdfState(p => ({ ...p, [id]: val }));
  const handleValidChange = (id, val) => setDefectValidState(p => ({ ...p, [id]: val }));

  // Auto-load from URL if parameters are present
  useEffect(() => {
    const folderParam = searchParams.get('folder');
    const fileParam = searchParams.get('file');
    if (folderParam && fileParam) {
      loadServerCsv(fileParam, folderParam);
    }
  }, [searchParams]);

  // no unit detection — keep X dynamic based on input

  // Load a CSV that's already on the server (in upload folder)
  const loadServerCsv = async (fileName, folderName = 'upload', requestedSampleSize = sampleSize, storeFull = false, source = 'upload', dbPath = '') => {
    setLastServerFile({ file: fileName, folder: folderName });
    setIsFullLoad(!!storeFull);
    setLoading(true);
    setParseProgress({ parsed: 0 });
    
    // Load singularities for this file if it exists on the server
    try {
      let dbResp;
      if (opConfig && opConfig.dataSourcePath) {
        const url = `/api/local-files?action=get-singularities&path=${encodeURIComponent(opConfig.dataSourcePath)}&file=${encodeURIComponent(fileName)}`;
        const res = await fetch(url);
        dbResp = { data: await res.json() };
      } else {
        const dbUrl = `/api/files/singularities?folder=${encodeURIComponent(folderName)}&file=${encodeURIComponent(fileName)}`;
        dbResp = await api.get(dbUrl, { headers: authHeaders(token) });
      }
      if (dbResp && Array.isArray(dbResp.data)) {
        setSingularities(dbResp.data);
      } else {
        setSingularities([]);
      }
    } catch (e) {
      setSingularities([]);
    }

    await loadTolerances();

    try {
      let blob;
      if (source === 'tgm') {
        const url = `/api/tgm/sessions/${encodeURIComponent(folderName)}/downsample?path=${encodeURIComponent(dbPath)}&file=${encodeURIComponent(fileName)}&sampleSize=${requestedSampleSize}`;
        const fetchResp = await fetch(url);
        if (!fetchResp.ok) throw new Error('Failed to download from tgm api');
        
        const res = await fetchResp.json();
        
        setHeaders(res.headers);
        setMetadata(res.metadataLines);
        // Assuming parseMetadataLines is available in scope
        try { setInfoPairs(parseMetadataLines(res.metadataLines)); } catch(e){}
        setCsvData(res.sampledRows.slice(0, 500)); // preview
        setSampledRows(res.sampledRows);
        
        const lower = (res.headers || []).map(h => (h || '').toLowerCase());
        const kmIdx = lower.findIndex(c => c === 'km' || c.includes('km'));
        if (kmIdx !== -1) setSelectedX(res.headers[kmIdx]);
        
        const numericCols = res.headers.slice(2, 5);
        setSelectedYs(prev => prev.length > 0 ? prev : numericCols);
        
        setParseProgress({ parsed: res.totalDataRows, done: true });
        setLoading(false);
        return;
      } else if (opConfig && opConfig.dataSourcePath) {
        const url = `/api/local-files?action=download&path=${encodeURIComponent(opConfig.dataSourcePath)}&file=${encodeURIComponent(fileName)}`;
        const fetchResp = await fetch(url);
        if (!fetchResp.ok) throw new Error('Failed to download from local-files');
        blob = await fetchResp.blob();
      } else {
        const url = `/api/files/raw?folder=${encodeURIComponent(folderName)}&file=${encodeURIComponent(fileName)}&download=1`;
        const resp = await api.get(url, { headers: authHeaders(token), responseType: 'blob' });
        blob = resp.data;
      }

      // ---- ADDED LOGIC FOR .GEO ----
      if (fileName.toLowerCase().endsWith('.geo')) {
        const arrayBuffer = await blob.arrayBuffer();
        const res = await parseGeoBuffer(arrayBuffer, requestedSampleSize, storeFull);
        setGeoDatasets(prev => {
          if (prev.some(g => g.filename === fileName)) return prev;
          const newGeo = {
            id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
            filename: fileName,
            data: res.data,
            offset: 0,
            visible: true,
            color: ['#0EA5E9','#7C3AED','#F97316','#059669','#EF4444'][prev.length % 5]
          };
          return [...prev, newGeo];
        });
        
        // Setup initial headers/Ys if this is the first file
        setHeaders(res.hdrs);
        setMetadata(res.metadataLines);
        setInfoPairs(res.infoPairs);
        setCsvData([]);
        setSampledRows([]);
        
        const lower = (res.hdrs || []).map(h => (h || '').toLowerCase());
        const kmIdx = lower.findIndex(c => c === 'km' || c.includes('km'));
        if (kmIdx !== -1) setSelectedX(res.hdrs[kmIdx]);
        const numericCols = res.hdrs.slice(2, 5);
        setSelectedYs(prev => prev.length > 0 ? prev : numericCols);
        
        setParseProgress({ parsed: res.totalDataRows, seen: res.totalDataRows, done: true });
        setLoading(false);
        return;
      }
      // ---- END ADDED LOGIC ----

  // If sampling is requested, attempt deterministic ordered sampling by doing a lightweight
  // counting pass followed by a selection pass to pick evenly spaced indices. We detect
  // 'km' in headers during the count pass so selectedX does not need to be set beforehand.
  if (!storeFull && useSampling) {
        // First pass: count data rows and capture header/meta
        let headerFound = false;
        let hdrs = [];
        const metadataLines = [];
        let totalDataRows = 0;
        await new Promise((resolve, reject) => {
          Papa.parse(blob, {
            worker: true,
            skipEmptyLines: true,
            step: (results) => {
              const row = results.data;
              if (!headerFound) {
                const lower = row.map(c => (c || '').toString().trim().toLowerCase());
                if (lower.some(c => c === 'id' || c === 'km' || c.includes('km'))) {
                  headerFound = true;
                  hdrs = row.map(c => (c || '').toString().replace(/[^\x20-\x7E]/g, '').trim());
                  setHeaders(hdrs);
                } else {
                  metadataLines.push(row.join(';'));
                }
                return;
              }
              totalDataRows++;
              if (totalDataRows % 500 === 0) setParseProgress({ parsed: totalDataRows });
            },
            complete: () => { setParseProgress({ parsed: totalDataRows, done: false }); resolve(); },
            error: () => { reject(new Error('Count pass failed')); }
          });
        });

        // After counting, check if ordered sampling is applicable (detected 'km' header or user already
        // selected an X column). If not, fall through to the reservoir/full parsing below.
        const ss = requestedSampleSize || sampleSize;
        if (totalDataRows <= ss) {
          // small file — fall through to full parsing in the fallback path (below) which will
          // parse the blob fully and set headers/data accordingly.
        } else {
          const detectedLower = (hdrs || []).map(h => (h || '').toLowerCase());
          const hasKm = detectedLower.some(c => c === 'km' || c.includes('km'));
          const useOrdered = hasKm || !!selectedX;
          if (useOrdered) {
            // compute target indices (0-based) evenly spaced across totalDataRows
            const step = totalDataRows / ss;
            const targets = new Set();
            for (let i = 0; i < ss; i++) {
              const idx = Math.floor(i * step);
              targets.add(idx);
            }

            // Second pass: collect rows whose data-index is in targets
            const sampled = [];
            let dataIndex = -1;
            let previewRows = [];
            await new Promise((resolve, reject) => {
              let headerFound2 = false;
              Papa.parse(blob, {
                worker: true,
                skipEmptyLines: true,
                step: (results) => {
                  const row = results.data;
                  if (!headerFound2) {
                    const lower = row.map(c => (c || '').toString().trim().toLowerCase());
                    if (lower.some(c => c === 'id' || c === 'km' || c.includes('km'))) {
                      headerFound2 = true;
                      hdrs = row.map(c => (c || '').toString().replace(/[^\x20-\x7E]/g, '').trim());
                      setHeaders(hdrs);
                    } else {
                      // metadata already captured
                    }
                    return;
                  }
                  dataIndex++;
                  const obj = {};
                  for (let i = 0; i < hdrs.length; i++) obj[hdrs[i]] = row[i];
                  if (previewRows.length < 500) previewRows.push(obj);
                  if (targets.has(dataIndex)) sampled.push(obj);
                  if (dataIndex % 500 === 0) setParseProgress({ parsed: dataIndex });
                },
                complete: () => { setParseProgress({ parsed: dataIndex + 1, done: true }); resolve(); },
                error: () => { reject(new Error('Select pass failed')); }
              });
            });

            setCsvData(previewRows);
      setMetadata(metadataLines);
      setInfoPairs(parseMetadataLines(metadataLines));
            setSampledRows(sampled);
            // try auto-select km and numeric Ys
            const lower = (hdrs || []).map(h => (h || '').toLowerCase());
            const kmIdx = lower.findIndex(h => h === 'km' || h.includes('km'));
            if (kmIdx !== -1) setSelectedX(hdrs[kmIdx]);
            const numericCols = (hdrs || []).filter(h => {
              for (let i = 0; i < Math.min(30, previewRows.length); i++) {
                const v = previewRows[i][h];
                if (v == null || v === '') return false;
                const n = Number(String(v).replace(',', '.'));
                if (!isNaN(n)) return true;
              }
              return false;
            });
        setSelectedYs(numericCols.slice(2, 5));
            setLoading(false);
            return;
          }
          // else: fall through to fallback parsing (reservoir/full) below
        }
      }

      // fallback: existing behavior (reservoir or fullRows)
      let headerFound = false;
      let hdrs = [];
      const previewLimit = 500;
      const previewRows = [];
      const metadataLines = [];
      let rowCount = 0;
      // reservoir sampling
      const reservoir = [];
      let totalSeen = 0;
      // if storeFull is true we want to keep all rows (no reservoir sampling)
      const ss = storeFull ? Infinity : (requestedSampleSize || sampleSize);
      const fullRows = storeFull ? [] : null;
      let seenForParse = 0;

      Papa.parse(blob, {
        worker: true,
        skipEmptyLines: true,
        step: (results) => {
          rowCount++;
          const row = results.data;
          if (!headerFound) {
            const lower = row.map(c => (c || '').toString().trim().toLowerCase());
            if (lower.some(c => c === 'id' || c === 'km' || c.includes('km'))) {
              headerFound = true;
              hdrs = row.map(c => (c || '').toString().replace(/[^\x20-\x7E]/g, '').trim());
              // Expose headers early so UI can render and auto-select km
              setHeaders(hdrs);
              const lowerHdrs = hdrs.map(h => (h || '').toLowerCase());
              const kmIdx = lowerHdrs.findIndex(h => h === 'km' || h.includes('km'));
              if (kmIdx !== -1) setSelectedX(hdrs[kmIdx]);
            } else {
              metadataLines.push(row.join(';'));
            }
            if (rowCount % 100 === 0) setParseProgress({ parsed: rowCount });
            return;
          }

          const obj = {};
          for (let i = 0; i < hdrs.length; i++) obj[hdrs[i]] = row[i];
          // always keep a small preview for the UI
          if (previewRows.length < previewLimit) previewRows.push(obj);
          if (storeFull) {
            fullRows.push(obj);
          } else {
            // reservoir sampling (single pass)
            totalSeen++;
            if (reservoir.length < ss) {
              reservoir.push(obj);
            } else {
              const r = Math.floor(Math.random() * totalSeen);
              if (r < ss) reservoir[r] = obj;
            }
          }
          if (previewRows.length === 1) {
            // first data row available: try to auto-select numeric Ys if not already set
            const lowerHdrs = hdrs.map(h => (h || '').toLowerCase());
            const kmIdx = lowerHdrs.findIndex(h => h === 'km' || h.includes('km'));
            if (!selectedX && kmIdx !== -1) setSelectedX(hdrs[kmIdx]);
            const numericCols = hdrs.filter(h => {
              for (let i = 0; i < Math.min(10, previewRows.length); i++) {
                const v = previewRows[i][h];
                if (v == null || v === '') return false;
                const n = Number(String(v).replace(',', '.'));
                if (!isNaN(n)) return true;
              }
              return false;
            });
            if (numericCols.length > 0) setSelectedYs(prev => (prev.length ? prev : numericCols.slice(2, 5)));
          }
          if (previewRows.length % 100 === 0) {
            seenForParse = rowCount;
            setCsvData(storeFull ? [...fullRows] : [...previewRows]);
            setSampledRows(storeFull ? [] : [...reservoir]);
            setParseProgress({ parsed: rowCount, seen: seenForParse });
          }
        },
        complete: () => {
          setCsvData(storeFull ? fullRows : previewRows);
          setHeaders(hdrs || []);
      setMetadata(metadataLines);
      setInfoPairs(parseMetadataLines(metadataLines));
          setParseProgress({ parsed: rowCount, seen: rowCount, done: true });
          setSampledRows(storeFull ? [] : [...reservoir]);
          const lower = (hdrs || []).map(h => (h || '').toLowerCase());
          if (lower.includes('km')) setSelectedX(hdrs[lower.indexOf('km')]);
          const numericCols = (hdrs || []).filter(h => {
            for (let i = 0; i < Math.min(30, previewRows.length); i++) {
              const v = previewRows[i][h];
              if (v == null || v === '') return false;
              const n = Number(String(v).replace(',', '.'));
              if (!isNaN(n)) return true;
            }
            return false;
          });
          setSelectedYs(numericCols.slice(2, 5));
          setLoading(false);
        },
        error: () => {
          setLoading(false);
          setParseError('Unable to load CSV from server');
        }
      });
    } catch (err) {
      setLoading(false);
      setParseError('Unable to load CSV from server');
    }
  };

  // Local file input handler (also used to preview before upload)
  // Accept an explicit requestedSampleSize so resampling can request a different reservoir size.
  const handleLocalFile = (file, requestedSampleSize = sampleSize, storeFull = false) => {
    setLastLocalFile(file);
    setIsFullLoad(!!storeFull);
    if (!file) return;
    setLoading(true);
    setParseProgress({ parsed: 0 });

    if (file.name.toLowerCase().endsWith('.geo')) {
      (async () => {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const res = await parseGeoBuffer(arrayBuffer, requestedSampleSize, storeFull);
          setGeoDatasets(prev => {
            if (prev.some(g => g.filename === file.name)) return prev;
            const newGeo = {
              id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
              filename: file.name,
              data: res.data,
              offset: 0,
              visible: true,
              color: ['#0EA5E9','#7C3AED','#F97316','#059669','#EF4444'][prev.length % 5]
            };
            return [...prev, newGeo];
          });
          setHeaders(res.hdrs);
          setMetadata(res.metadataLines);
          setInfoPairs(res.infoPairs);
          setCsvData([]);
          setSampledRows([]);
          const lower = (res.hdrs || []).map(h => (h || '').toLowerCase());
          if (lower.includes('km')) setSelectedX(res.hdrs[lower.indexOf('km')]);
          const numericCols = res.hdrs.slice(2, 5);
          setSelectedYs(prev => prev.length > 0 ? prev : numericCols);
          setParseProgress({ parsed: res.totalDataRows, seen: res.totalDataRows, done: true });
          setLoading(false);
        } catch (e) {
          console.error(e);
          setParseError(e.message);
          setLoading(false);
        }
      })();
      return;
    }
    const previewLimit = 500;
    let headerFound = false;
    let hdrs = [];
    const previewRows = [];
    const metadataLines = [];
    let rowCount = 0;
    // reservoir sampling
    const reservoir = [];
    let totalSeen = 0;
  const ss = storeFull ? Infinity : (requestedSampleSize || sampleSize);
  const fullRows = storeFull ? [] : null;
  let seenForParse = 0;
  // If sampling is requested, try ordered two-pass sampling when applicable.
  // We detect 'km' in headers during the count pass and apply ordered sampling even when
  // `selectedX` wasn't set before opening the file. Otherwise fall back to reservoir/full.
  if (!storeFull && useSampling) {
    (async () => {
      // first pass: count rows and discover headers/metadata
      let headerFound = false;
      let hdrs = [];
      const metadataLines = [];
      let totalDataRows = 0;
      await new Promise((resolve, reject) => {
        Papa.parse(file, {
          worker: true,
          skipEmptyLines: true,
          step: (results) => {
            const row = results.data;
            if (!headerFound) {
              const lower = row.map(c => (c || '').toString().trim().toLowerCase());
              if (lower.includes('id') || lower.includes('km')) {
                headerFound = true;
                hdrs = row.map(c => (c || '').toString().replace(/[^\x20-\x7E]/g, '').trim());
                setHeaders(hdrs);
              } else {
                metadataLines.push(row.join(';'));
              }
              return;
            }
            totalDataRows++;
            if (totalDataRows % 500 === 0) setParseProgress({ parsed: totalDataRows });
          },
          complete: () => { setParseProgress({ parsed: totalDataRows, done: false }); resolve(); },
          error: () => { reject(new Error('Count pass failed')); }
        });
      });

      const ss = requestedSampleSize || sampleSize;
      if (totalDataRows <= ss) {
        // Small file: force a single-pass full parse to avoid exiting early
        // from this async branch and leaving parse state pending.
        handleLocalFile(file, requestedSampleSize, true);
        return;
      } else {
        const detectedLower = (hdrs || []).map(h => (h || '').toLowerCase());
        const hasKm = detectedLower.includes('km');
        const useOrdered = hasKm || !!selectedX;
        if (useOrdered) {
          const stepIdx = totalDataRows / ss;
          const targets = new Set();
          for (let i = 0; i < ss; i++) {
            const idx = Math.floor(i * stepIdx);
            targets.add(idx);
          }

          // second pass: select target indices
          const sampled = [];
          let dataIndex = -1;
          const previewRows = [];
          await new Promise((resolve, reject) => {
            let headerFound2 = false;
            Papa.parse(file, {
              worker: true,
              skipEmptyLines: true,
              step: (results) => {
                const row = results.data;
                if (!headerFound2) {
                  const lower = row.map(c => (c || '').toString().trim().toLowerCase());
                  if (lower.includes('id') || lower.includes('km')) {
                    headerFound2 = true;
                    hdrs = row.map(c => (c || '').toString().replace(/[^\x20-\x7E]/g, '').trim());
                    setHeaders(hdrs);
                  } else {
                    // metadata already captured
                  }
                  return;
                }
                dataIndex++;
                const obj = {};
                for (let i = 0; i < hdrs.length; i++) obj[hdrs[i]] = row[i];
                if (previewRows.length < 500) previewRows.push(obj);
                if (targets.has(dataIndex)) sampled.push(obj);
                if (dataIndex % 500 === 0) setParseProgress({ parsed: dataIndex });
              },
              complete: () => { setParseProgress({ parsed: dataIndex + 1, done: true }); resolve(); },
              error: () => { reject(new Error('Select pass failed')); }
            });
          });

          setCsvData(previewRows);
          setMetadata(metadataLines);
          setInfoPairs(parseMetadataLines(metadataLines));
          setSampledRows(sampled);
          // detect numeric columns
          const numericCols = (hdrs || []).filter(h => {
            for (let i = 0; i < Math.min(30, previewRows.length); i++) {
              const v = previewRows[i][h];
              if (v == null || v === '') return false;
              const n = Number(String(v).replace(',', '.'));
              if (!isNaN(n)) return true;
            }
            return false;
          });
          setSelectedYs(numericCols.slice(2, 5));
          setLoading(false);
          return;
        }
        // No ordered key detected: force single-pass full parse instead of
        // exiting this async branch without completing.
        handleLocalFile(file, requestedSampleSize, true);
        return;
      }
    })();
    return;
  }

  Papa.parse(file, {
    worker: true,
    skipEmptyLines: true,
    step: (results) => {
      rowCount++;
      const row = results.data;
          if (!headerFound) {
            const lower = row.map(c => (c || '').toString().trim().toLowerCase());
            if (lower.includes('id') || lower.includes('km')) {
              headerFound = true;
              hdrs = row.map(c => (c || '').toString().replace(/[^\x20-\x7E]/g, '').trim());
              setHeaders(hdrs);
              const lowerHdrs = hdrs.map(h => (h || '').toLowerCase());
              if (lowerHdrs.includes('km')) setSelectedX(hdrs[lowerHdrs.indexOf('km')]);
            } else {
              metadataLines.push(row.join(';'));
            }
            if (rowCount % 100 === 0) setParseProgress({ parsed: rowCount });
            return;
          }

          const obj = {};
          for (let i = 0; i < hdrs.length; i++) obj[hdrs[i]] = row[i];
          if (previewRows.length < previewLimit) previewRows.push(obj);
          if (storeFull) {
            fullRows.push(obj);
          } else {
            // reservoir sampling (single pass)
            totalSeen++;
            if (reservoir.length < ss) {
              reservoir.push(obj);
            } else {
              const r = Math.floor(Math.random() * totalSeen);
              if (r < ss) reservoir[r] = obj;
            }
          }
          if (previewRows.length === 1) {
            const lowerHdrs = hdrs.map(h => (h || '').toLowerCase());
            if (!selectedX && lowerHdrs.includes('km')) setSelectedX(hdrs[lowerHdrs.indexOf('km')]);
            const numericCols = hdrs.filter(h => {
              for (let i = 0; i < Math.min(10, previewRows.length); i++) {
                const v = previewRows[i][h];
                if (v == null || v === '') return false;
                const n = Number(String(v).replace(',', '.'));
                if (!isNaN(n)) return true;
              }
              return false;
            });
            if (numericCols.length > 0) setSelectedYs(prev => (prev.length ? prev : numericCols.slice(2, 5)));
          }
          if (previewRows.length % 100 === 0) {
            seenForParse = rowCount;
            setCsvData(storeFull ? [...fullRows] : [...previewRows]);
            setSampledRows(storeFull ? [] : [...reservoir]);
            setParseProgress({ parsed: rowCount, seen: seenForParse });
          }
        },
        complete: () => {
          setCsvData(storeFull ? fullRows : previewRows);
          setHeaders(hdrs || []);
          setMetadata(metadataLines);
          setInfoPairs(parseMetadataLines(metadataLines));
          setParseProgress({ parsed: rowCount, seen: rowCount, done: true });
          setSampledRows(storeFull ? [] : [...reservoir]);
          const lower = (hdrs || []).map(h => (h || '').toLowerCase());
          if (lower.includes('km')) setSelectedX(hdrs[lower.indexOf('km')]);
          const numericCols = (hdrs || []).filter(h => {
            for (let i = 0; i < Math.min(30, previewRows.length); i++) {
              const v = previewRows[i][h];
              if (v == null || v === '') return false;
              const n = Number(String(v).replace(',', '.'));
              if (!isNaN(n)) return true;
            }
            return false;
          });
          setSelectedYs(numericCols.slice(2, 5));
          setLoading(false);
        },
        error: () => {
          setLoading(false);
          setParseError('Error parsing CSV file');
        }
      });
  };

  // Upload to server (upload folder by default)
  const uploadToServer = async (file) => {
    if (!file) return;
    setUploadStatus(null);
    setUploadInProgress(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post(`/api/files/${encodeURIComponent('upload')}/upload`, formData, { headers: { ...authHeaders(token), 'Content-Type': 'multipart/form-data' } });
      await fetchFiles();
      setUploadStatus({ type: 'success', msg: 'File uploaded to upload/' });
      setShowUploadModal(false);
      setUploadCandidate(null);
    } catch (err) {
      console.error('upload failed', err);
      setUploadStatus({ type: 'error', msg: 'Upload failed' });
    }
    setUploadInProgress(false);
  };

  // Toggle Y selection
  const toggleY = (col) => {
    setSelectedYs(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  const saveSingularities = async () => {
    const fileParam = searchParams.get('file') || lastServerFile?.file;
    const folderParam = searchParams.get('folder') || lastServerFile?.folder || 'upload';
    if (!fileParam) {
      alert('Carica un file dal server per poter salvare le singolarità.');
      return;
    }
    try {
      if (opConfig && opConfig.dataSourcePath) {
        await fetch('/api/local-files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save-singularities', path: opConfig.dataSourcePath, file: fileParam, data: singularities })
        });
      } else {
        await api.post('/api/files/singularities/save', {
          folder: folderParam,
          file: fileParam,
          singularities
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      alert(t('savingSuccess') || 'Salvataggio riuscito');
    } catch (err) {
      console.error('Error saving singularities', err);
      alert(t('savingError') || 'Errore durante il salvataggio');
    }
  };

  // Inline header rename
  const renameHeader = (oldName, newName) => {
    if (!oldName || !newName || oldName === newName) return;
    // update headers list and each row
    const idx = headers.indexOf(oldName);
    if (idx === -1) return;
    const newHeaders = [...headers];
    newHeaders[idx] = newName;
    const newData = csvData.map(r => {
      const nr = { ...r };
      nr[newName] = nr[oldName];
      delete nr[oldName];
      return nr;
    });
    setHeaders(newHeaders);
    setCsvData(newData);
    // update selections if needed
    if (selectedX === oldName) setSelectedX(newName);
    setSelectedYs(prev => prev.map(s => s === oldName ? newName : s));
  };

  const chartData = useMemo(() => {
    let finalDatasets = [];

    if (geoDatasets && geoDatasets.length > 0) {
      geoDatasets.filter(g => g.visible).forEach((geo, geoIdx) => {
        let source = geo.data;
        if (kmRange && selectedX) {
          source = source.filter(row => {
            const v = parseNumberCell(row[selectedX]);
            if (isNaN(v)) return false;
            const shiftedX = v + geo.offset;
            return shiftedX >= kmRange.min && shiftedX <= kmRange.max;
          });
        }
        selectedYs.forEach((col, idx) => {
          let pts = source.map((row, i) => {
            const originalX = parseNumberCell(row[selectedX]);
            const x = originalX + geo.offset;
            const v = row[col];
            const y = Number(String(v).replace(',', '.'));
            return { x, y, _sourceIndex: i };
          }).filter(p => !isNaN(p.x) && !isNaN(p.y));
          pts.sort((a, b) => a.x - b.x);

          finalDatasets.push({
            label: `${geo.filename} - ${col}`,
            data: pts,
            yAxisID: `y${idx}`,
            borderColor: geo.color,
            pointRadius: 0,
            borderWidth: 1,
            segment: {
              borderColor: ctx => {
                const toll = tolerances[col];
                if (toll > 0) {
                  if (!ctx.p0 || !ctx.p1 || ctx.p0.parsed.y === undefined || ctx.p1.parsed.y === undefined) return undefined;
                  const p1 = ctx.p0.parsed.y;
                  const p2 = ctx.p1.parsed.y;
                  if (Math.abs(p1) > toll || Math.abs(p2) > toll) {
                    return 'rgb(220, 38, 38)';
                  }
                }
                return undefined;
              }
            },
            tension: 0.2,
            fill: false,
          });
        });
      });
    }

    let source = (sampledRows && sampledRows.length > 0 && useSampling) ? sampledRows : csvData;
    if (source && source.length > 0) {
      if (kmRange && selectedX) {
        source = source.filter(row => {
          const v = parseNumberCell(row[selectedX]);
          if (isNaN(v)) return false;
          return v >= kmRange.min && v <= kmRange.max;
        });
      }
      const csvDatasets = selectedYs.map((col, idx) => {
        let pts = source.map((row, i) => {
          const x = parseNumberCell(row[selectedX]);
          const v = row[col];
          const y = Number(String(v).replace(',', '.'));
          return { x, y, _sourceIndex: i };
        }).filter(p => !isNaN(p.x) && !isNaN(p.y));
        pts.sort((a, b) => a.x - b.x);

        return {
          label: col,
          data: pts,
          yAxisID: `y${idx}`,
          borderColor: ['#0EA5E9','#7C3AED','#F97316','#059669','#EF4444'][idx % 5],
          pointRadius: 0,
          borderWidth: 1,
          segment: {
            borderColor: ctx => {
              const toll = tolerances[col];
              if (toll > 0) {
                if (!ctx.p0 || !ctx.p1 || ctx.p0.parsed.y === undefined || ctx.p1.parsed.y === undefined) return undefined;
                const p1 = ctx.p0.parsed.y;
                const p2 = ctx.p1.parsed.y;
                if (Math.abs(p1) > toll || Math.abs(p2) > toll) {
                  return 'rgb(220, 38, 38)';
                }
              }
              return undefined;
            }
          },
          tension: 0.2,
          fill: false,
        };
      });
      finalDatasets = [...finalDatasets, ...csvDatasets];
    }

    return { datasets: finalDatasets };
  }, [csvData, sampledRows, selectedX, selectedYs, useSampling, kmRange, tolerances, geoDatasets]);

  const chartOptions = useMemo(() => {
    const scales = { x: { type: 'linear', display: true, title: { display: true, text: selectedX, font: { weight: 'bold' } }, ticks: { callback: function(val) { return formatRailwayKm(val); } } } };
    selectedYs.forEach((col, idx) => {
      scales[`y${idx}`] = {
        type: 'linear',
        display: true,
        position: 'left',
        stack: 'oscilloscope',
        stackWeight: 1,
        offset: true,
        border: { display: true },
        title: { display: true, text: col + ' (mm)', font: { size: 10 } },
        ticks: { maxTicksLimit: 3, padding: 4 }
      };
    });

    return {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (event, activeElements, chart) => {
        if (!chart) return;
        // The event object from chartjs already has correct relative x, y
        const dataX = chart.scales.x.getValueForPixel(event.x);
        const kmValue = Number(dataX).toFixed(3);
        if (kmValue != null) {
          setContextMenu({ x: event.x, y: event.y, kmLabel: kmValue, formattedKm: formatRailwayKm(kmValue) });
        }
      },
      onHover: (event, activeElements, chart) => {
        if (!chart || !chart.scales?.x) return;
        // Throttle to ~30fps for performance
        const now = Date.now();
        if (now - hoverThrottleRef.current < 33) return;
        hoverThrottleRef.current = now;
        // Get the km value at the cursor x position
        const dataX = chart.scales.x.getValueForPixel(event.x);
        if (dataX == null || isNaN(dataX)) return;
        let closestRow = null;
        let closestDist = Infinity;
        
        // Search in csvData/sampledRows
        const source = (sampledRows && sampledRows.length > 0 && useSampling) ? sampledRows : csvData;
        if (source && source.length > 0 && selectedX) {
          for (let j = 0; j < source.length; j++) {
            const km = parseNumberCell(source[j][selectedX]);
            if (!isNaN(km)) {
              const dist = Math.abs(km - dataX);
              if (dist < closestDist) { closestDist = dist; closestRow = source[j]; }
            }
          }
        }
        
        // Search in geoDatasets
        if (geoDatasets && geoDatasets.length > 0 && selectedX) {
          geoDatasets.filter(g => g.visible).forEach(geo => {
            for (let j = 0; j < geo.data.length; j++) {
              const km = parseNumberCell(geo.data[j][selectedX]);
              if (!isNaN(km)) {
                const shiftedKm = km + geo.offset;
                const dist = Math.abs(shiftedKm - dataX);
                if (dist < closestDist) { closestDist = dist; closestRow = geo.data[j]; }
              }
            }
          });
        }
        if (closestRow) {
          const lat = Number(closestRow['Latitudine'] ?? closestRow['Lat'] ?? closestRow['lat'] ?? 0);
          const lon = Number(closestRow['Longitudine'] ?? closestRow['Lon'] ?? closestRow['lon'] ?? 0);
          // Guard against invalid (0,0) coordinates (null GPS island)
          if (!isNaN(lat) && !isNaN(lon) && !(lat === 0 && lon === 0)) {
            setHoveredCoords({ lat, lon });
          }
        }
      },
      plugins: {
        tooltip: { mode: 'index', intersect: false },
        legend: { position: 'top' },
        title: { display: false },
        zoom: { zoom: { drag: { enabled: true, backgroundColor: 'rgba(14, 165, 233, 0.1)', borderColor: 'rgba(14, 165, 233, 0.4)', borderWidth: 1 }, wheel: { enabled: true }, mode: 'x' }, pan: { enabled: true, mode: 'x' } },
        annotation: {
          annotations: (() => {
            const anns = {};
            singularities.forEach((sig, sIdx) => {
              anns[`sig-${sIdx}`] = { type: 'line', scaleID: 'x', value: Number(sig.km), borderColor: 'rgba(239, 68, 68, 0.8)', borderWidth: 2, borderDash: [5, 5], label: { display: true, content: sig.icon + ' ' + sig.type + ' (' + formatRailwayKm(sig.km) + ')', position: 'start', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: 'rgba(239, 68, 68, 0.8)', borderWidth: 1, borderRadius: 4, padding: 4, font: { size: 12 } } };
            });
            selectedYs.forEach((col, idx) => {
              const toll = tolerances[col];
              if (toll > 0) {
                anns[`tol-${idx}-pos`] = { type: 'line', yScaleID: `y${idx}`, yMin: toll, yMax: toll, borderColor: 'rgba(148, 163, 184, 0.6)', borderWidth: 1, borderDash: [4, 4], drawTime: 'beforeDatasetsDraw' };
                anns[`tol-${idx}-neg`] = { type: 'line', yScaleID: `y${idx}`, yMin: -toll, yMax: -toll, borderColor: 'rgba(148, 163, 184, 0.6)', borderWidth: 1, borderDash: [4, 4], drawTime: 'beforeDatasetsDraw' };
              }
            });
            return anns;
          })()
        }
      },
      scales: scales
    };
  }, [csvData, sampledRows, useSampling, selectedYs, singularities, tolerances, selectedX]);

  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950 text-slate-100 p-4 w-full">
      {parseError && <div className="mb-4 bg-rose-500/10 border-l-4 border-rose-500 p-3 rounded-lg"><div className="text-sm text-rose-400 font-medium">{parseError}</div></div>}
      {uploadStatus && <div className={`mb-4 ${uploadStatus.type === 'success' ? 'bg-emerald-500/10 border-l-4 border-emerald-500 text-emerald-400' : 'bg-rose-500/10 border-l-4 border-rose-500 text-rose-400'} p-3 rounded-lg font-medium`}><div className="text-sm">{uploadStatus.msg}</div></div>}

      <div className="mb-8">
        <div className="flex justify-between items-center w-full">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-200 to-white bg-clip-text text-transparent flex items-center">
              <svg className="w-7 h-7 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002-2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              TGM Visualizer
              <span className="text-sm font-normal text-blue-300 bg-blue-900/50 border border-blue-700/50 px-2 py-0.5 rounded-md shadow-sm ml-3">
                v1.6
              </span>
            </h2>
            <p className="text-slate-400 mt-1">{t('visualizeExplore') || 'Visualize and explore your CSV data'}</p>
          </div>
          <div className="flex gap-4 items-center">
            <button 
              onClick={() => router.push('/configuration')}
              className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-600 text-white text-sm font-bold px-4 py-2 rounded-xl shadow transition-all duration-200 hover:-translate-y-0.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <span>{t('configureGraphs')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 mb-6">
        {infoPairs && infoPairs.length > 0 && (
            <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
              <div className="border-b border-slate-700/50 bg-slate-900/40 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">{t('infoTitle') || 'Info'}</h3>
                <div className="text-sm text-slate-400">{t('metadataExtracted') || 'Metadata extracted from upload'}{(searchParams.get('folder') || lastServerFile?.folder) ? ` | ID: ${searchParams.get('folder') || lastServerFile?.folder}` : ''}</div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {infoPairs.map((p, idx) => (
                  <div key={idx} className="flex gap-2 items-start min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 w-40 flex-shrink-0 whitespace-nowrap">{p.key}</div>
                    <div className="text-sm text-slate-200 whitespace-nowrap overflow-hidden text-ellipsis" title={p.value}>{p.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="relative bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden w-full">
            <div className="border-b border-slate-700/50 bg-slate-900/40 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-200">
                {t('configTitle') || 'Data / Chart Configuration'}
              </h3>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center px-4 py-2 border border-slate-600 hover:border-blue-500 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 cursor-pointer shadow-lg transition-all duration-200">
                  {t('importFile') || 'Load local'}
                  <input type="file" accept=".csv,.geo" className="hidden" onChange={e => { if (e.target.files[0]) handleLocalFile(e.target.files[0]); }} />
                </label>
                <label className="inline-flex items-center px-4 py-2 border border-slate-600 hover:border-slate-500 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 cursor-pointer transition-all duration-200">
                  Upload to server
                  <input type="file" accept=".csv,.geo" className="hidden" onChange={e => { const f = e.target.files[0]; if (f) { setUploadCandidate(f); setShowUploadModal(true); } }} />
                </label>
                {parseProgress && !parseProgress.done && (
                  <div className="inline-flex items-center px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-300">
                      <svg className="w-4 h-4 mr-2 animate-spin text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                      </svg>
                      Parsing {parseProgress.parsed || 0} rows{parseProgress.seen ? ` (seen ${parseProgress.seen})` : ''}... {isFullLoad ? <span className="text-xs text-amber-500 ml-2">full load</span> : null}
                    </div>
                )}
              </div>
            </div>
            
            <div className="p-6 grid grid-cols-1 gap-6">
              <div>
                <TGMDatabaseContainer onPlaySession={(s, dbPath) => loadServerCsv('軌道參數報表.csv', s.id, sampleSize, false, 'tgm', dbPath)} />
              </div>

              {showUploadModal && uploadCandidate ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                  <div className="absolute inset-0 bg-black opacity-30" onClick={() => { if (!uploadInProgress) { setShowUploadModal(false); setUploadCandidate(null); } }} />
                  <div className="bg-white rounded-lg shadow-lg p-6 z-50 w-11/12 max-w-md relative">
                    <h4 className="text-lg font-medium text-slate-800 mb-2">Confirm upload</h4>
                    <div className="text-sm text-slate-600 mb-4">Upload <strong className="text-slate-800">{uploadCandidate.name}</strong> to server upload/ ?</div>
                    <div className="flex justify-end gap-2">
                      <button className="px-3 py-1 bg-white border rounded" onClick={() => { setShowUploadModal(false); setUploadCandidate(null); }}>Cancel</button>
                      <button disabled={uploadInProgress} className={`px-3 py-1 bg-blue-600 text-white rounded ${uploadInProgress ? 'opacity-60 cursor-not-allowed' : ''}`} onClick={async () => { await uploadToServer(uploadCandidate); }}>
                        {uploadInProgress ? (
                          <span className="inline-flex items-center gap-2"><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>Uploading...</span>
                        ) : 'Upload'}
                      </button>
                    </div>
                    {uploadStatus && <div className={`mt-3 text-sm ${uploadStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{uploadStatus.msg}</div>}
                  </div>
                </div>
              ) : null}

              <div className="hidden">
                <label className="block text-sm font-medium text-slate-700 mb-1">X-axis</label>
                <select value={selectedX} onChange={e => setSelectedX(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                  <option value="">Select column</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <div className="mt-4 text-sm text-slate-500">Tip: choose an index or time-like column for X-axis</div>
              </div>

              <div className="hidden">
                <label className="block text-sm font-medium text-slate-700 mb-1">Y-series (toggle multiple)</label>
                <div className="border border-slate-200 rounded-md p-2 max-h-48 overflow-auto">
                  {headers.length === 0 ? <div className="text-sm text-slate-500">No headers</div> : headers.map(h => (
                    <label key={h} className="flex items-center gap-2 text-sm py-1 px-1">
                      <input type="checkbox" checked={selectedYs.includes(h)} onChange={() => toggleY(h)} />
                      <span className="truncate">{h}</span>
                      <button className="ml-auto text-xs text-slate-400 hover:text-slate-600" onClick={() => { const newName = prompt('Rename header', h); if (newName) renameHeader(h, newName); }}>rename</button>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {(process.env.NEXT_PUBLIC_DEBUG_MODE === 'true' || true) && (
              <div className="absolute bottom-1 right-2 text-[10px] text-slate-300 font-mono pointer-events-none opacity-50 transition-opacity hover:opacity-100 z-50 bg-slate-900/80 px-2 py-0.5 rounded shadow">
                ID: card-config
              </div>
            )}
          </div>

        <div className="relative bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden min-h-[400px] flex flex-col w-full">
          <div className="border-b border-slate-700/50 bg-slate-900/40 px-6 py-4 flex items-center justify-between">
            <h3 className="text-lg font-medium text-slate-200">
              {t('mapTitle') || 'Google Maps'}
            </h3>
          </div>
          <div className="flex-1 p-0 relative min-h-[300px]">
            {(() => {
              const displayCoords = hoveredCoords || { lat: 45.5513, lon: 12.0725 };
              return (
                <div style={{ height: '100%', width: '100%', zIndex: 0, position: 'relative' }}>
                  <MapContainer center={[displayCoords.lat, displayCoords.lon]} zoom={14} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[displayCoords.lat, displayCoords.lon]} />
                    <MapUpdater center={[displayCoords.lat, displayCoords.lon]} />
                  </MapContainer>
                </div>
              );
            })()}
          </div>
        {(process.env.NEXT_PUBLIC_DEBUG_MODE === 'true' || true) && (
          <div className="absolute bottom-1 right-2 text-[10px] text-slate-300 font-mono pointer-events-none opacity-50 transition-opacity hover:opacity-100 z-50 bg-slate-900/80 px-2 py-0.5 rounded shadow">
            ID: card-map
          </div>
        )}
      </div>
    </div>

    {headers.length > 0 ? (
        <>
          <div className="relative bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden mb-6 p-6" style={{ height: Math.max(420, selectedYs.length * 150) + 100 }}>
            <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
              {geoDatasets.length > 1 && (
                <button className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg shadow-lg text-sm flex items-center font-bold border border-slate-600 transition-all" onClick={() => setShowGeoModal(true)}>Gestione Acquisizioni</button>
              )}
              <button className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg shadow-lg text-sm flex items-center font-bold border border-slate-600 transition-all" onClick={() => chartRef.current?.resetZoom()}>{t('resetZoom') || 'Reset Zoom'}</button>
              <button className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg shadow-lg text-sm flex items-center font-bold border border-slate-600 transition-all" onClick={saveSingularities}>{t('saveDatabase') || 'Salva DB Linee'}</button>
              <div className="relative">
                <button className="bg-slate-800 hover:bg-slate-700 text-slate-200 w-9 h-9 flex items-center justify-center rounded-lg shadow-lg font-bold border border-slate-600 transition-all" onClick={() => setShowYMenu(!showYMenu)}>⋯</button>
                {showYMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-700 bg-slate-900/50 font-medium text-sm text-slate-200 flex justify-between items-center">{t('configureGraphs') || 'Configura Grafici'} (Asse Y) <button onClick={() => setShowYMenu(false)} className="text-slate-400 hover:text-white transition-colors">&times;</button></div>
                    <div className="max-h-60 overflow-auto p-2 bg-slate-800/90">
                      {headers.length === 0 ? <div className="text-sm text-slate-400 p-2 text-center">Nessuna serie disponibile</div> : headers.filter(h => h !== selectedX).map(h => (
                        <label key={h} className="flex items-center gap-3 text-sm py-2 px-3 hover:bg-blue-600/20 cursor-pointer rounded-lg text-slate-300 transition-colors">
                          <input type="checkbox" checked={selectedYs.includes(h)} onChange={() => toggleY(h)} className="rounded border-slate-500 bg-slate-900" />
                          <span className="truncate">{h}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {contextMenu && (
              <div className="absolute bg-slate-800 rounded-xl shadow-2xl border border-slate-600 z-50 overflow-hidden" style={{ left: contextMenu.x + 20, top: Math.max(contextMenu.y - 50, 10) }}>
                <div className="bg-slate-900/50 px-4 py-2 text-xs font-bold text-slate-300 border-b border-slate-700 flex justify-between items-center">
                  <span>Km: {contextMenu.formattedKm || contextMenu.kmLabel}</span><button onClick={() => setContextMenu(null)} className="ml-4 text-slate-400 hover:text-white transition-colors">&times;</button>
                </div>
                <ul className="py-2">
                  {[ { type: 'Semaforo', icon: '🚦' }, { type: 'Passaggio a livello', icon: '🚧' }, { type: 'Fabbricato viaggiatori', icon: '🚉' }, { type: 'Scambio', icon: '🛤️' }, { type: 'Cippo', icon: '📍' } ].map(item => (
                    <li key={item.type}>
                      <button className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-blue-600/30 flex items-center gap-3 transition-colors" onClick={() => { 
                        setSingularities(prev => {
                          const next = [...prev, { km: contextMenu.kmLabel, type: item.type, icon: item.icon }];
                          const fileParam = searchParams.get('file') || lastServerFile?.file;
                          const folderParam = searchParams.get('folder') || lastServerFile?.folder || 'upload';
                          if (fileParam) {
                            if (opConfig && opConfig.dataSourcePath) {
                              fetch('/api/local-files', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'save-singularities', path: opConfig.dataSourcePath, file: fileParam, data: next })
                              }).catch(e => console.error('auto-save error', e));
                            } else {
                              api.post('/api/files/singularities/save', {
                                folder: folderParam,
                                file: fileParam,
                                singularities: next
                              }, { headers: authHeaders(token) }).catch(e => console.error('auto-save error', e));
                            }
                          }
                          return next;
                        }); 
                        setContextMenu(null); 
                      }}>
                        <span>{item.icon}</span> {item.type}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ height: '100%' }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!chartRef.current) return;
                const chart = chartRef.current;
                const canvasRect = chart.canvas.getBoundingClientRect();
                const canvasX = e.clientX - canvasRect.left;
                const canvasY = e.clientY - canvasRect.top;
                const dataX = chart.scales.x.getValueForPixel(canvasX);
                const kmValue = Number(dataX).toFixed(3);
                setContextMenu({ x: canvasX, y: canvasY, kmLabel: kmValue, formattedKm: formatRailwayKm(kmValue) });
              }}
              onMouseMove={(e) => {
                if (!chartRef.current) return;
                // Throttle to 20fps
                const now = Date.now();
                if (now - hoverThrottleRef.current < 50) return;
                hoverThrottleRef.current = now;
                const chart = chartRef.current;
                if (!chart.scales?.x) return;
                const canvasRect = chart.canvas.getBoundingClientRect();
                const canvasX = e.clientX - canvasRect.left;
                const dataX = chart.scales.x.getValueForPixel(canvasX);
                if (dataX == null || isNaN(dataX)) return;
                let best = null, bestDist = Infinity;
                
                const src = (sampledRows && sampledRows.length > 0 && useSampling) ? sampledRows : csvData;
                if (src && src.length > 0 && selectedX) {
                  for (let j = 0; j < src.length; j++) {
                    const km = parseNumberCell(src[j][selectedX]);
                    if (!isNaN(km)) {
                      const d = Math.abs(km - dataX);
                      if (d < bestDist) { bestDist = d; best = src[j]; }
                    }
                  }
                }
                
                if (geoDatasets && geoDatasets.length > 0 && selectedX) {
                  geoDatasets.filter(g => g.visible).forEach(geo => {
                    for (let j = 0; j < geo.data.length; j++) {
                      const km = parseNumberCell(geo.data[j][selectedX]);
                      if (!isNaN(km)) {
                        const shiftedKm = km + geo.offset;
                        const d = Math.abs(shiftedKm - dataX);
                        if (d < bestDist) { bestDist = d; best = geo.data[j]; }
                      }
                    }
                  });
                }
                if (best) {
                  const lat = parseFloat(best['Latitudine'] ?? best['Lat'] ?? best['lat'] ?? 0);
                  const lon = parseFloat(best['Longitudine'] ?? best['Lon'] ?? best['lon'] ?? 0);
                  if (isFinite(lat) && isFinite(lon)) {
                    setHoveredCoords({ lat, lon });
                  }
                }
              }}
            >
              <ChartErrorBoundary>
                {chartData && chartData.datasets && chartData.datasets.length > 0 ? (
                  <Line ref={chartRef} key={JSON.stringify({ selectedX, selectedYs, csvData: csvData.length })} data={chartData} options={chartOptions} />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500">No chartable data yet (waiting for parsed rows)</div>
                )}
              </ChartErrorBoundary>
            </div>

            {(loading || (parseProgress && !parseProgress.done)) && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto animate-spin text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                  <div className="mt-2 text-sm text-slate-700">Loading data… {parseProgress ? `${parseProgress.parsed || 0} rows` : ''}</div>
                </div>
              </div>
            )}
          </div>

          {/* EN 13231-3 Section Defects Heatmap */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6 w-full max-w-full min-w-0">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-700">{t('sectionDefectsTitle') || 'Gravità Difetti per Sezione (EN 13231-3)'}</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">{t('sectionLength') || 'Lunghezza Sezione'} (m):</span>
                <input 
                  type="number" min="10" step="10" 
                  className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-right"
                  value={sectionLength}
                  onChange={e => setSectionLength(Number(e.target.value) || 200)}
                />
              </div>
            </div>
            <div className="p-6 overflow-x-auto w-full max-w-full">
              {selectedYs.map(col => {
                let sources = [];
                if (geoDatasets && geoDatasets.length > 0) {
                  sources = geoDatasets.filter(g => g.visible).map(g => ({ data: g.data, offset: g.offset || 0 }));
                } else {
                  const src = (sampledRows && sampledRows.length > 0 && useSampling) ? sampledRows : csvData;
                  if (src && src.length > 0) {
                    sources = [{ data: src, offset: 0 }];
                  }
                }
                const toll = tolerances[col] || 0;
                
                // Raggruppamento punti in segmenti
                const segments = {};
                const secLen = sectionLength; // X è in metri, quindi non dividiamo per 1000
                
                sources.forEach(srcObj => {
                  srcObj.data.forEach(row => {
                    const originalX = parseNumberCell(row[selectedX]);
                    const x = originalX + srcObj.offset;
                    const v = parseNumberCell(row[col]);
                    if (!isNaN(x) && !isNaN(v)) {
                      const segIdx = Math.floor(x / secLen);
                      if (!segments[segIdx]) {
                        segments[segIdx] = { start: segIdx * secLen, end: (segIdx + 1) * secLen, total: 0, defects: 0 };
                      }
                      segments[segIdx].total++;
                      if (toll > 0 && Math.abs(v) > toll) {
                        segments[segIdx].defects++;
                      }
                    }
                  });
                });

                const validSegments = Object.values(segments).sort((a,b) => a.start - b.start);

                if (validSegments.length === 0) return null;

                return (
                  <div key={col} className="mb-6 last:mb-0 w-full max-w-full">
                    <div className="font-semibold text-slate-700 mb-2 truncate" title={col}>{col}</div>
                    <div className="w-max min-w-full">
                      <div className="flex w-full h-8 border border-slate-200 rounded overflow-hidden">
                        {validSegments.map((seg, idx) => {
                          const perc = seg.total > 0 ? (seg.defects / seg.total) * 100 : 0;
                          let bgClass = "bg-green-400";
                          if (perc > 0 && perc <= 2) bgClass = "bg-yellow-300";
                          else if (perc > 2) bgClass = "bg-red-500";
                          
                          return (
                            <div 
                              key={idx} 
                              className={`flex-none w-[60px] ${bgClass} border-r border-dashed border-slate-500 last:border-0 hover:opacity-80 transition-opacity cursor-pointer`}
                              title={`Km ${formatRailwayKm(seg.start)} - ${formatRailwayKm(seg.end)}\nDifetti: ${seg.defects}/${seg.total}\nGravità: ${perc.toFixed(1)}%`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex w-full mt-1">
                        {validSegments.map((seg, idx) => (
                          <div key={idx} className="flex-none w-[60px] border-l border-slate-400 pl-1 text-[10px] text-slate-500 overflow-hidden whitespace-nowrap" title={formatRailwayKm(seg.start)}>
                            {formatRailwayKm(seg.start)}
                          </div>
                        ))}
                        {validSegments.length > 0 && (
                          <div className="w-0 border-l border-slate-400 relative">
                            <span className="absolute right-0 text-[10px] text-slate-500 pr-1 whitespace-nowrap">{formatRailwayKm(validSegments[validSegments.length - 1].end)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {selectedYs.length === 0 && (
                <div className="text-sm text-slate-500">{t('selectSeriesFirst') || 'Seleziona almeno un asse Y per visualizzare le sezioni.'}</div>
              )}
            </div>
          </div>

          {/* EN 13231-3 Defects area */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-700">{t('defectsTitle') || 'Report Difetti e Tolleranze (EN 13231-3)'}</h3>
              <div className="text-sm text-slate-400">{(searchParams.get('folder') || lastServerFile?.folder) ? `ID: ${searchParams.get('folder') || lastServerFile?.folder}` : ''}</div>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {selectedYs.map(col => {
                let sources = [];
                if (geoDatasets && geoDatasets.length > 0) {
                  sources = geoDatasets.filter(g => g.visible).map(g => ({ data: g.data, offset: g.offset || 0 }));
                } else {
                  const src = (sampledRows && sampledRows.length > 0 && useSampling) ? sampledRows : csvData;
                  if (src && src.length > 0) {
                    sources = [{ data: src, offset: 0 }];
                  }
                }

                const toll = tolerances[col] || 0;
                let count = 0;
                let outOfToll = 0;
                
                sources.forEach(srcObj => {
                  srcObj.data.forEach(row => {
                    const v = parseNumberCell(row[col]);
                    if (!isNaN(v)) {
                      count++;
                      if (toll > 0 && Math.abs(v) > toll) outOfToll++;
                    }
                  });
                });
                const perc = count > 0 ? ((outOfToll / count) * 100).toFixed(1) : 0;
                
                return (
                  <div key={col} className="border border-slate-200 rounded p-4 bg-slate-50">
                    <div className="font-semibold text-slate-700 truncate mb-2" title={col}>{col}</div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500">{t('tolerance') || 'Tolleranza'} (± mm)</span>
                      <input 
                        type="number" min="0" step="0.1" 
                        className="w-16 px-1 py-0.5 border rounded text-xs text-right text-slate-900"
                        value={tolerances[col] !== undefined ? tolerances[col] : ''}
                        onChange={e => updateTolerance(col, e.target.value === '' ? undefined : parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">{t('samples') || 'Campioni Validi'}</span>
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">{t('outOfBounds') || 'Fuori Tolleranza'}</span>
                      <span className={`text-sm font-medium ${outOfToll > 0 ? 'text-red-600' : 'text-green-600'}`}>{outOfToll}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">{t('percentage') || '% Difettosità'}</span>
                      <span className={`text-sm font-medium ${perc > 5 ? 'text-red-600' : 'text-slate-700'}`}>{perc}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="px-6 pb-6">
              <DefectTable 
                rows={calculatedDefects} 
                onPdfChange={handlePdfChange} 
                onValidationChange={handleValidChange} 
              />
            </div>
          </div>
        </>
      ) : (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                {t('noFileSelected') || 'Carica un file o seleziona dal server per iniziare.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reservoir sampling notice */}
        {(((sampledRows && sampledRows.length > 0) || ((parseProgress && parseProgress.parsed) || 0) > Math.max(1000, sampleSize))) ? (
          <div className="px-6 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600 max-w-xl">
                Showing a reservoir sample ({sampledRows.length} rows) — requested {sampleSize} — of the full file to keep the UI responsive. Use the controls to resample or turn sampling off to view the full preview (may be slow for very large files).
                <div className="text-xs text-slate-400 mt-1">Reservoir sampling picks a representative random subset of the file — good for quick charts.</div>
                {sampledRows.length > 0 && sampledRows.length < Math.min(sampleSize, parseProgress?.parsed || Infinity) && (
                  <div className="text-xs text-amber-600 mt-2">Note: sampled {sampledRows.length} rows which is less than the requested sample size ({sampleSize}). This can happen if parsing was interrupted or file rows were fewer than requested.</div>
                )}
              </div>
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={useSampling} onChange={e => {
                      const val = e.target.checked;
                      setUseSampling(val);
                      // Reparse current file with/without sampling
                      if (val) {
                        if (lastLocalFile) handleLocalFile(lastLocalFile, sampleSize, false);
                        else if (lastServerFile) loadServerCsv(lastServerFile.file, lastServerFile.folder, sampleSize, false);
                      } else {
                        if (lastLocalFile) handleLocalFile(lastLocalFile, sampleSize, true);
                        else if (lastServerFile) loadServerCsv(lastServerFile.file, lastServerFile.folder, sampleSize, true);
                      }
                    }} />
                    <span className="text-sm text-slate-600">{t('useSampling') || 'Use sampling'}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={100} max={100000} value={sampleSize} onChange={e => setSampleSize(Number(e.target.value) || 1000)} className="w-20 px-2 py-1 border rounded text-sm" />
                    <span className="text-sm text-slate-500">{t('sampleSize') || 'sample size'}</span>
                  </div>
                </div>
 
                <div className="flex flex-wrap items-center gap-3 justify-end min-w-0">
                  <div className="flex flex-wrap items-center gap-2 justify-end min-w-0">
                    <div>
                      <div className="text-sm text-slate-500">{t('xRange') || 'X range:'}</div>
                      <input type="text" value={kmMinInput} onChange={e => setKmMinInput(e.target.value)} className="w-24 max-w-full px-2 py-1 border rounded text-sm" placeholder="min" />
                      <input type="text" value={kmMaxInput} onChange={e => setKmMaxInput(e.target.value)} className="w-24 max-w-full px-2 py-1 border rounded text-sm" placeholder="max" />
                    </div>
                    <div>
                      <button className="px-2 py-1 bg-white border rounded" onClick={() => {
                        const mn = parseNumberCell(kmMinInput);
                        const mx = parseNumberCell(kmMaxInput);
                        if (!isNaN(mn) && !isNaN(mx) && mn <= mx) setKmRange({ min: mn, max: mx });
                      }}>{t('apply') || 'Apply'}</button>
                      <button className="px-2 py-1 bg-white border rounded" onClick={() => setKmRange(null)}>{t('reset') || 'Reset'}</button>
                    </div>
                  </div>
                    <div>
                      <button className="px-2 py-1 bg-blue-600 text-white rounded" onClick={() => {
                        setSampledRows([]);
                        setCsvData([]);
                        setParseProgress({ parsed: 0 });
                        resample();
                      }}>{t('resample') || 'Resample'}</button>
                    </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

      {showGeoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-30" onClick={() => setShowGeoModal(false)} />
          <div className="bg-white rounded-lg shadow-lg p-6 z-50 w-11/12 max-w-3xl relative max-h-[80vh] overflow-y-auto">
            <h4 className="text-xl font-bold text-slate-800 mb-4">Gestione Acquisizioni (.geo)</h4>
            {geoDatasets.length === 0 ? (
              <p className="text-slate-500">Nessuna acquisizione .geo caricata.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {geoDatasets.map((geo, idx) => (
                  <div key={geo.id} className="flex items-center gap-4 p-3 border border-slate-200 rounded shadow-sm bg-slate-50">
                    <input type="checkbox" checked={geo.visible} onChange={() => {
                      setGeoDatasets(prev => prev.map(g => g.id === geo.id ? { ...g, visible: !g.visible } : g));
                    }} className="w-4 h-4" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-700 truncate" style={{ color: geo.color }}>{geo.filename}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-600">Offset (km):</label>
                      <input type="number" step="0.001" value={geo.offset} onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setGeoDatasets(prev => prev.map(g => g.id === geo.id ? { ...g, offset: val } : g));
                      }} className="w-24 px-2 py-1 border border-slate-300 rounded text-right" />
                    </div>
                    <button 
                      className={`px-3 py-1 text-sm rounded text-white ${idx === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                      disabled={idx === 0}
                      onClick={() => autoAlign(geo.id)}
                    >
                      Auto-Allinea
                    </button>
                    <button className="text-red-500 hover:text-red-700" onClick={() => {
                      setGeoDatasets(prev => prev.filter(g => g.id !== geo.id));
                    }}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700" onClick={() => setShowGeoModal(false)}>Chiudi</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
class TopErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("TopLevel Error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#fee', color: '#900', fontFamily: 'monospace' }}>
          <h2>DataVisualizer Crashed!</h2>
          <p><strong>Error:</strong> {this.state.error?.message}</p>
          <pre>{this.state.error?.stack}</pre>
          <hr />
          <pre>{this.state.info?.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DataVizualizerWithErrorBoundary(props) {
  return (
    <TopErrorBoundary>
      <DataVisualizer {...props} />
    </TopErrorBoundary>
  );
}
