'use client';

import React, { useState, useMemo } from 'react';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtKm(metersValue) {
  const num = Number(metersValue);
  if (isNaN(num)) return String(metersValue);
  const isNeg = num < 0;
  const abs = Math.abs(num);
  const km = Math.floor(abs / 1000);
  const m = Math.round(abs % 1000);
  return (isNeg ? '-' : '') + km + '+' + m.toString().padStart(3, '0');
}

function fmtNum(v, decimals = 6) {
  const n = Number(v);
  return isNaN(n) ? '' : n.toFixed(decimals);
}

// ─────────────────────────────────────────────
// Export helpers
// ─────────────────────────────────────────────
function exportCsv(rows, filename) {
  const headers = ['#', 'KM start', 'KM end', 'Threshold', 'Max defect', 'Priority A (%)', 'Priority B (%)', 'Description', 'Validated'];
  const lines = [headers.join(';')];
  rows.forEach((r, i) => {
    lines.push([
      i + 1,
      fmtNum(r.kmStart),
      fmtNum(r.kmEnd),
      fmtNum(r.threshold),
      fmtNum(r.maxDefect),
      r.priority,
      r.priorityB ?? '',
      r.description || r.channel,
      r.validated ? '1' : '0',
    ].join(';'));
  });
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportExcel(rows, filename) {
  const headers = ['#', 'KM start', 'KM end', 'Threshold', 'Max defect', 'Priority A (%)', 'Priority B (%)', 'Description', 'Validated'];
  const lines = [headers.join('\t')];
  rows.forEach((r, i) => {
    lines.push([
      i + 1,
      fmtNum(r.kmStart),
      fmtNum(r.kmEnd),
      fmtNum(r.threshold),
      fmtNum(r.maxDefect),
      r.priority,
      r.priorityB ?? '',
      r.description || r.channel,
      r.validated ? '1' : '0',
    ].join('\t'));
  });
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportPdf(rows) {
  const pdfRows = rows.filter(r => r.pdf);
  if (!pdfRows.length) {
    alert('Seleziona almeno una riga con il checkbox PDF prima di esportare.');
    return;
  }
  const htmlRows = pdfRows.map((r, i) => {
    const pA = Number(r.priority), pB = Number(r.priorityB ?? 0);
    const isHigh = pA > 50;
    return `
      <tr class="${i % 2 === 0 ? 'even' : 'odd'}${isHigh ? ' high' : ''}">
        <td>${i + 1}</td>
        <td>${fmtKm(r.kmStart)}</td>
        <td>${fmtKm(r.kmEnd)}</td>
        <td>${fmtNum(r.threshold, 3)}</td>
        <td>${fmtNum(r.maxDefect, 3)} [mm]</td>
        <td>${pA.toFixed(1)}%</td>
        <td>${pB.toFixed(1)}%</td>
        <td>${r.description || r.channel}</td>
        <td>${r.validated ? '✔' : ''}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Defects Report</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:10px;margin:20px}
    h2{font-size:14px;margin-bottom:4px} p{font-size:9px;color:#64748b;margin-bottom:8px}
    table{border-collapse:collapse;width:100%}
    th{background:#1e3a5f;color:#fff;padding:5px 8px;text-align:left;font-size:9px}
    td{padding:4px 8px;border-bottom:1px solid #e2e8f0}
    tr.even td{background:#f8fafc} tr.odd td{background:#fff}
    tr.high td{color:#dc2626;font-weight:bold}
    @media print{@page{size:A4 landscape;margin:10mm}}
  </style></head><body>
  <h2>Defects Report</h2>
  <p>Generato il ${new Date().toLocaleDateString()} — ${pdfRows.length} difetti selezionati</p>
  <table>
    <thead><tr>
      <th>#</th><th>KM start</th><th>KM end</th><th>Threshold</th><th>Max defect</th>
      <th>Priority A</th><th>Priority B</th><th>Description</th><th>Validated</th>
    </tr></thead>
    <tbody>${htmlRows}</tbody>
  </table>
  <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
}

// ─────────────────────────────────────────────
// Priority Tooltip
// ─────────────────────────────────────────────
function PriorityTooltip({ show }) {
  if (!show) return null;
  return (
    <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-3 text-left">
      <p className="text-xs font-bold text-slate-700 mb-2">Come vengono calcolate le priorità</p>
      <div className="space-y-2">
        <div className="bg-orange-50 border border-orange-200 rounded p-2">
          <p className="text-xs font-semibold text-orange-700">Priority A — Intensità</p>
          <p className="text-xs text-slate-600 mt-0.5 font-mono">(Max defect − Threshold) / Threshold × 100</p>
          <p className="text-xs text-slate-500 mt-1">Misura di quanto il difetto peggiore supera la soglia.</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2">
          <p className="text-xs font-semibold text-blue-700">Priority B — Estensione</p>
          <p className="text-xs text-slate-600 mt-0.5 font-mono">Punti fuori soglia / Punti totali nella sezione × 100</p>
          <p className="text-xs text-slate-500 mt-1">Misura quanto è estesa la sezione difettosa rispetto alla sua lunghezza totale.</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function DefectTable({ rows = [], onValidationChange, onPdfChange }) {
  const [filterChannel, setFilterChannel] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('priority');
  const [sortDir, setSortDir] = useState('desc');
  const [groupByChannel, setGroupByChannel] = useState(false);
  const [showOnlyPdf, setShowOnlyPdf] = useState(false);
  const [showPriorityTooltip, setShowPriorityTooltip] = useState(false);

  const channels = useMemo(() => [...new Set(rows.map(r => r.channel))].sort(), [rows]);

  const displayed = useMemo(() => {
    let r = rows;
    if (filterChannel) r = r.filter(x => x.channel === filterChannel);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(x => (x.description || '').toLowerCase().includes(q) || x.channel.toLowerCase().includes(q));
    }
    if (showOnlyPdf) r = r.filter(x => x.pdf);

    r = [...r].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      const numericKeys = ['priority', 'priorityB', 'kmStart', 'kmEnd', 'maxDefect', 'threshold'];
      if (numericKeys.includes(sortKey)) { av = Number(av); bv = Number(bv); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return r;
  }, [rows, filterChannel, search, showOnlyPdf, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <span className="ml-0.5 text-slate-300 text-xs">↕</span>;
    return <span className="ml-0.5 text-blue-400 text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const selectedPdfCount = rows.filter(r => r.pdf).length;

  const grouped = useMemo(() => {
    if (!groupByChannel) return null;
    const map = {};
    displayed.forEach(r => { if (!map[r.channel]) map[r.channel] = []; map[r.channel].push(r); });
    return map;
  }, [displayed, groupByChannel]);

  const renderRow = (r, idx) => {
    const pA = Number(r.priority);
    const pB = Number(r.priorityB ?? 0);
    const isHighA = pA > 50;
    const isMedA = pA > 20 && !isHighA;

    return (
      <tr key={r.id}
        className={`border-b border-slate-100 hover:bg-blue-50/40 transition-colors
          ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
      >
        <td className="px-2 py-2 text-slate-400 text-xs tabular-nums">{idx + 1}</td>
        <td className="px-2 py-2 font-mono text-xs text-slate-700 whitespace-nowrap">{fmtKm(r.kmStart)}</td>
        <td className="px-2 py-2 font-mono text-xs text-slate-700 whitespace-nowrap">{fmtKm(r.kmEnd)}</td>
        <td className="px-2 py-2 text-slate-500 font-mono text-xs whitespace-nowrap">{fmtNum(r.threshold, 3)}</td>

        <td className="px-2 py-2 font-mono text-xs font-semibold whitespace-nowrap">
          <span className={isHighA ? 'text-red-700' : isMedA ? 'text-amber-700' : 'text-slate-700'}>
            {fmtNum(r.maxDefect, 3)}
          </span>
          <span className="text-slate-400 font-normal"> [mm]</span>
        </td>

        {/* Priority A — Intensità */}
        <td className="px-2 py-2 min-w-[90px]">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 bg-slate-200 rounded-full h-1.5 min-w-[32px]">
              <div
                className={`h-1.5 rounded-full transition-all ${isHighA ? 'bg-red-500' : isMedA ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{ width: `${Math.min(100, pA)}%` }}
              />
            </div>
            <span className={`text-xs tabular-nums w-10 text-right font-semibold ${isHighA ? 'text-red-700' : isMedA ? 'text-amber-700' : 'text-slate-600'}`}>
              {pA.toFixed(1)}%
            </span>
          </div>
        </td>

        {/* Priority B — Estensione */}
        <td className="px-2 py-2 min-w-[90px]">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 bg-slate-200 rounded-full h-1.5 min-w-[32px]">
              <div
                className={`h-1.5 rounded-full transition-all ${pB > 50 ? 'bg-blue-600' : pB > 20 ? 'bg-blue-400' : 'bg-blue-300'}`}
                style={{ width: `${Math.min(100, pB)}%` }}
              />
            </div>
            <span className="text-xs tabular-nums w-10 text-right text-blue-700 font-semibold">
              {pB.toFixed(1)}%
            </span>
          </div>
        </td>

        <td className="px-2 py-2 text-slate-600 text-xs max-w-[140px] truncate" title={r.description || r.channel}>
          {r.description || r.channel}
        </td>

        {/* PDF checkbox */}
        <td className="px-2 py-2 text-center">
          <input
            type="checkbox"
            checked={!!r.pdf}
            onChange={e => onPdfChange && onPdfChange(r.id, e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
            title="Seleziona per PDF"
          />
        </td>

        {/* Validated */}
        <td className="px-2 py-2 text-center">
          <input
            type="checkbox"
            checked={!!r.validated}
            onChange={e => onValidationChange && onValidationChange(r.id, e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-emerald-600 cursor-pointer"
            title="Convalidato"
          />
        </td>
      </tr>
    );
  };

  const thCls = "px-2 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-slate-800 hover:bg-slate-200/60 transition-colors";

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col" style={{ minHeight: '300px' }}>

      {/* ── Header ── */}
      <div className="border-b border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-3 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 leading-none">Defects</h3>
              <p className="text-xs text-slate-400 mt-0.5">Max defect &gt; Threshold (EN 13231-3)</p>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white shadow-sm">
              {displayed.length} difetti
            </span>
          </div>

          {/* Export buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button id="defect-export-csv" onClick={() => exportCsv(displayed, 'defects.csv')}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSV
            </button>
            <button id="defect-export-excel" onClick={() => exportExcel(displayed, 'defects.xls')}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 shadow-sm transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Excel
            </button>
            <button id="defect-export-pdf" onClick={() => exportPdf(rows)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-red-300 bg-white text-red-700 hover:bg-red-50 shadow-sm transition-colors"
              title={selectedPdfCount === 0 ? 'Seleziona righe PDF prima' : `Stampa ${selectedPdfCount} righe`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF {selectedPdfCount > 0 && <span className="bg-red-600 text-white rounded-full px-1.5 text-xs">{selectedPdfCount}</span>}
            </button>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)}
            className="text-xs px-2 py-1 border border-slate-300 rounded bg-white text-slate-700 min-w-[100px]">
            <option value="">Canale ▾</option>
            {channels.map(ch => <option key={ch} value={ch}>{ch}</option>)}
          </select>

          <select value={`${sortKey}-${sortDir}`}
            onChange={e => { const [k, d] = e.target.value.split('-'); setSortKey(k); setSortDir(d); }}
            className="text-xs px-2 py-1 border border-slate-300 rounded bg-white text-slate-700">
            <option value="priority-desc">Priority A ↓</option>
            <option value="priority-asc">Priority A ↑</option>
            <option value="priorityB-desc">Priority B ↓</option>
            <option value="kmStart-asc">KM start ↑</option>
            <option value="maxDefect-desc">Max defect ↓</option>
          </select>

          <div className="relative flex-1 min-w-[120px]">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cerca..." className="w-full pl-6 pr-2 py-1 text-xs border border-slate-300 rounded bg-white placeholder-slate-400" />
          </div>

          <label className="inline-flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={showOnlyPdf} onChange={e => setShowOnlyPdf(e.target.checked)} className="rounded border-slate-300" />
            Solo PDF
          </label>
          <label className="inline-flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={groupByChannel} onChange={e => setGroupByChannel(e.target.checked)} className="rounded border-slate-300" />
            Raggruppa
          </label>
          {(filterChannel || search || showOnlyPdf) && (
            <button onClick={() => { setFilterChannel(''); setSearch(''); setShowOnlyPdf(false); }}
              className="text-xs text-blue-600 hover:underline">Reset</button>
          )}
        </div>
      </div>

      {/* ── Empty state ── */}
      {rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 flex-1">
          <svg className="w-10 h-10 mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-slate-500">Nessun difetto rilevato</p>
          <p className="text-xs text-slate-400 mt-1">Imposta la threshold per calcolare i difetti</p>
        </div>
      )}

      {/* ── Table ── */}
      {displayed.length > 0 && (
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className={thCls}>#</th>
                <th className={thCls} onClick={() => toggleSort('kmStart')}>KM start <SortIcon col="kmStart" /></th>
                <th className={thCls} onClick={() => toggleSort('kmEnd')}>KM end <SortIcon col="kmEnd" /></th>
                <th className={thCls} onClick={() => toggleSort('threshold')}>Threshold <SortIcon col="threshold" /></th>
                <th className={thCls} onClick={() => toggleSort('maxDefect')}>Max defect <SortIcon col="maxDefect" /></th>

                {/* Priority A header with tooltip */}
                <th className={`${thCls} relative`} onClick={() => toggleSort('priority')}>
                  <div className="flex items-center gap-1">
                    <span>Priority A</span>
                    <SortIcon col="priority" />
                    <button
                      className="ml-1 w-4 h-4 rounded-full bg-slate-300 hover:bg-blue-400 text-white text-xs flex items-center justify-center font-bold transition-colors"
                      onClick={e => { e.stopPropagation(); setShowPriorityTooltip(v => !v); }}
                      title="Spiegazione formule Priority"
                    >?</button>
                  </div>
                  <PriorityTooltip show={showPriorityTooltip} />
                </th>

                <th className={thCls} onClick={() => toggleSort('priorityB')}>Priority B <SortIcon col="priorityB" /></th>
                <th className={thCls}>Description</th>
                <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">PDF</th>
                <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Validated</th>
              </tr>
            </thead>

            <tbody>
              {groupByChannel && grouped
                ? Object.entries(grouped).map(([ch, chRows]) => (
                  <React.Fragment key={`g-${ch}`}>
                    <tr className="bg-blue-50/60 border-y border-blue-100">
                      <td colSpan={10} className="px-3 py-1.5">
                        <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">{ch}</span>
                        <span className="ml-2 text-xs text-slate-500">{chRows.length} difetti</span>
                      </td>
                    </tr>
                    {chRows.map((r, i) => renderRow(r, i))}
                  </React.Fragment>
                ))
                : displayed.map((r, i) => renderRow(r, i))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer ── */}
      {displayed.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-2 bg-slate-50 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-slate-500">
            {displayed.length} difetti{filterChannel && ` · ${filterChannel}`}
            {rows.length !== displayed.length && ` (tot: ${rows.length})`}
          </span>
          <span className="text-xs text-slate-400">
            {selectedPdfCount > 0 && `${selectedPdfCount} sel. PDF`}
          </span>
        </div>
      )}
    </div>
  );
}
