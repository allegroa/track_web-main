'use client';

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const isDebugMode = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true' || true;

export default function TGMDatabaseVisualizer({ sessions, stationsList = [], currentSubFolder, onNavigate, onPlaySession, onMoveFolder, onDeleteSession }) {
  const { t } = useTranslation();
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editSessionId, setEditSessionId] = useState(null);
  const [editStationValue, setEditStationValue] = useState('');
  const [columnFilters, setColumnFilters] = useState({
    date: '',
    time: '',
    startKm: '',
    endKm: '',
    length: '',
    stazionePartenza: '',
    direction: ''
  });

  const handleFilterChange = (column, value) => {
    setColumnFilters(prev => ({ ...prev, [column]: value }));
  };

  const handleEditStart = (session) => {
    setEditSessionId(session.id);
    setEditStationValue(session.stazionePartenza || '');
  };

  const handleEditCancel = () => {
    setEditSessionId(null);
    setEditStationValue('');
  };

  const handleEditSave = async (sessionId) => {
    if (!window.confirm(t('confirmStationEdit', 'Sei sicuro di voler modificare la START STATION? Questa modifica sarà salvata permanentemente sul database.'))) {
      return;
    }
    try {
      const res = await fetch('/api/tgm/sessions/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-metadata',
          targetPath: 'E:/Software/track_web-main/database',
          sessionId: sessionId,
          updates: { stazionePartenza: editStationValue }
        })
      });
      const data = await res.json();
      if (data.success) {
         const session = sessions.find(s => s.id === sessionId);
         if (session) session.stazionePartenza = editStationValue;
         setEditSessionId(null);
         alert(t('stationEditSuccess', 'Start Station aggiornata con successo!'));
      } else {
         alert(data.error || 'Errore nel salvataggio');
      }
    } catch (err) {
       alert('Errore di connessione: ' + err.message);
    }
  };

  const isStationInvalid = (name) => {
    if (!name || name === '-') return true;
    // Solo lettere (inclusi eventuali spazi/trattini) permesse, no numeri
    return /[0-9]/.test(name);
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedSessions = useMemo(() => {
    let sortable = [...sessions];
    
    sortable = sortable.filter(s => {
      // Se è una cartella non-sessione, applichiamo il filtro solo al nome cartella (usando la colonna date)
      if (!s.isSession) {
         if (columnFilters.date && (!s.folderName || !s.folderName.toLowerCase().includes(columnFilters.date.toLowerCase()))) return false;
         return true;
      }
      
      if (columnFilters.date && (!s.date || !s.date.toLowerCase().includes(columnFilters.date.toLowerCase()))) return false;
      if (columnFilters.time && (!s.time || !s.time.toLowerCase().includes(columnFilters.time.toLowerCase()))) return false;
      if (columnFilters.startKm && (!s.startKm || !s.startKm.toString().includes(columnFilters.startKm))) return false;
      if (columnFilters.endKm && (!s.endKm || !s.endKm.toString().includes(columnFilters.endKm))) return false;
      if (columnFilters.length) {
         const len = Math.abs((s.endKm || 0) - (s.startKm || 0)).toFixed(3);
         if (!len.includes(columnFilters.length)) return false;
      }
      if (columnFilters.stazionePartenza && (!s.stazionePartenza || !s.stazionePartenza.toLowerCase().includes(columnFilters.stazionePartenza.toLowerCase()))) return false;
      if (columnFilters.direction && (!s.direction || !s.direction.toLowerCase().includes(columnFilters.direction.toLowerCase()))) return false;
      
      return true;
    });

    if (sortConfig !== null) {
      sortable.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        if (sortConfig.key === 'length') {
          valA = Math.abs((a.endKm || 0) - (a.startKm || 0));
          valB = Math.abs((b.endKm || 0) - (b.startKm || 0));
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    // Metti sempre le cartelle "non sessione" in cima
    sortable.sort((a, b) => {
      if (!a.isSession && b.isSession) return -1;
      if (a.isSession && !b.isSession) return 1;
      return 0;
    });
    return sortable;
  }, [sessions, sortConfig, columnFilters]);

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm text-left text-slate-600">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
            <tr>
              <th className="w-12 text-center p-3 font-semibold text-xs tracking-wider">
                SELECT
              </th>
              <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('date')}>
                MEASUREMENT / FOLDER {getSortIcon('date')}
              </th>
              <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('time')}>
                TIME {getSortIcon('time')}
              </th>
              <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('startKm')}>
                START KM {getSortIcon('startKm')}
              </th>
              <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('endKm')}>
                END KM {getSortIcon('endKm')}
              </th>
              <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('length')}>
                LENGTH (KM) {getSortIcon('length')}
              </th>
              <th className="p-3">START STATION</th>
              <th className="p-3 text-center">DIR.</th>
              <th className="p-3">FILES PRESENT</th>
              <th className="p-3 text-right">ACTIONS</th>
            </tr>
            <tr className="bg-white border-b border-slate-200 shadow-sm">
              <th className="p-1"></th>
              <th className="p-1"><input type="text" className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-normal focus:outline-none focus:border-blue-500" placeholder="Filter..." value={columnFilters.date} onChange={e => handleFilterChange('date', e.target.value)} /></th>
              <th className="p-1"><input type="text" className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-normal focus:outline-none focus:border-blue-500" placeholder="Filter..." value={columnFilters.time} onChange={e => handleFilterChange('time', e.target.value)} /></th>
              <th className="p-1"><input type="text" className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-normal focus:outline-none focus:border-blue-500" placeholder="Filter..." value={columnFilters.startKm} onChange={e => handleFilterChange('startKm', e.target.value)} /></th>
              <th className="p-1"><input type="text" className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-normal focus:outline-none focus:border-blue-500" placeholder="Filter..." value={columnFilters.endKm} onChange={e => handleFilterChange('endKm', e.target.value)} /></th>
              <th className="p-1"><input type="text" className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-normal focus:outline-none focus:border-blue-500" placeholder="Filter..." value={columnFilters.length} onChange={e => handleFilterChange('length', e.target.value)} /></th>
              <th className="p-1">
                <select 
                  className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-normal focus:outline-none focus:border-blue-500 bg-white" 
                  value={columnFilters.stazionePartenza} 
                  onChange={e => handleFilterChange('stazionePartenza', e.target.value)}
                >
                  <option value="">{t('all', 'All')}</option>
                  {stationsList.map((station, idx) => (
                    <option key={idx} value={station}>{station}</option>
                  ))}
                </select>
              </th>
              <th className="p-1">
                <select 
                  className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-normal focus:outline-none focus:border-blue-500 bg-white" 
                  value={columnFilters.direction} 
                  onChange={e => handleFilterChange('direction', e.target.value)}
                >
                  <option value="">{t('all', 'All')}</option>
                  <option value="up">UP</option>
                  <option value="dn">DN</option>
                </select>
              </th>
              <th className="p-1"></th>
              <th className="p-1"></th>
            </tr>
          </thead>
          <tbody>
            {currentSubFolder && (
              <tr 
                className="border-b border-slate-50 hover:bg-blue-50/50 cursor-pointer transition relative group"
                onClick={() => onNavigate('..')}
              >
                <td className="text-center p-3"></td>
                <td className="p-3 font-bold text-blue-600" colSpan="9">
                  <span className="mr-2">📁</span> .. (Torna indietro)
                </td>
              </tr>
            )}

            {sortedSessions.map((session) => (
              <tr 
                key={session.id} 
                className={`border-b border-slate-50 hover:bg-slate-50/50 transition relative group ${selectedIds.has(session.id) ? 'bg-blue-50/30' : ''}`}
              >
                <td className="text-center p-3">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 cursor-pointer" 
                    checked={selectedIds.has(session.id)}
                    onChange={() => {
                      toggleSelect(session.id);
                      if (session.isSession && onPlaySession) {
                        onPlaySession(session);
                      }
                    }}
                  />
                </td>
                
                {session.isSession ? (
                  <>
                    <td className="p-3 font-medium text-slate-800">{session.date}</td>
                    <td className="p-3">{session.time}</td>
                    <td className="p-3">{session.startKm?.toFixed(3)}</td>
                    <td className="p-3">{session.endKm?.toFixed(3)}</td>
                    <td className="p-3">{Math.abs((session.endKm || 0) - (session.startKm || 0)).toFixed(3)}</td>
                    <td className="p-3 font-semibold text-slate-700">
                      {editSessionId === session.id ? (
                        <input 
                          type="text" 
                          className="border border-slate-300 rounded px-2 py-1 text-xs w-24 focus:outline-none focus:border-blue-500"
                          value={editStationValue}
                          onChange={(e) => setEditStationValue(e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={isStationInvalid(session.stazionePartenza) ? 'text-red-600 border-b border-red-300 border-dashed pb-0.5' : ''}>
                            {session.stazionePartenza || '-'}
                          </span>
                          {isStationInvalid(session.stazionePartenza) && (
                            <span title={t('invalidStationName', 'Valore non valido (contiene numeri). Usa la matita nelle azioni per modificare.')} className="text-red-500 cursor-help text-xs">⚠️</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold">
                      {session.direction === 'UP' ? <span className="text-emerald-600">⬆️ UP</span> : session.direction === 'DN' ? <span className="text-blue-600">⬇️ DN</span> : session.direction || '-'}
                    </td>
                  </>
                ) : (
                  <td className="p-3 font-bold text-blue-600 cursor-pointer hover:underline" colSpan="7" onClick={() => onNavigate(session.folderName)}>
                    <span className="mr-2">📁</span> {session.folderName}
                  </td>
                )}
                
                <td className="p-3">
                  {session.isSession && (
                    <div className="flex gap-1 flex-wrap">
                      {session.hasParameters && (
                        <span className="bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full text-xs font-semibold">{t('parameters', 'Parameters')}</span>
                      )}
                      {session.hasTqi && (
                        <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full text-xs font-semibold">{t('tqi', 'TQI')}</span>
                      )}
                      {session.hasExceedances && (
                        <span className="bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-full text-xs font-semibold">{t('exceedances', 'Exceedances')}</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-3 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex justify-end gap-2 text-slate-400">
                      {editSessionId === session.id ? (
                        <>
                          <button onClick={() => handleEditSave(session.id)} className="text-green-600 hover:text-green-800 transition-colors" title="Salva">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                          </button>
                          <button onClick={handleEditCancel} className="hover:text-slate-600 transition-colors" title="Annulla">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                          </button>
                        </>
                      ) : (
                        <>
                          {session.isSession && (
                            <button 
                              onClick={() => handleEditStart(session)} 
                              className="hover:text-blue-600 transition-colors"
                              title={t('editStation', 'Modifica stazione')}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                          )}
                          <button 
                            onClick={() => onDeleteSession && onDeleteSession(session)}
                            className="hover:text-red-600 transition-colors"
                            title="Elimina"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            
            {sortedSessions.length === 0 && !currentSubFolder && (
              <tr>
                <td colSpan="10" className="p-8 text-center text-slate-500">
                  Nessuna sessione trovata.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end items-center">
        <div className="text-sm text-slate-500 font-medium">
          Total Sessions: {sessions.filter(s => s.isSession).length} | Folders: {sessions.filter(s => !s.isSession).length}
        </div>
      </div>
    </div>
  );
}
