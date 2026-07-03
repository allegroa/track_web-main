'use client';

import React, { useState, useMemo } from 'react';

const isDebugMode = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true' || true;

export default function TGMDatabaseVisualizer({ sessions, currentSubFolder, onNavigate, onPlaySession, onMoveFolder, onDeleteSession }) {
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [draggedItem, setDraggedItem] = useState(null);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedSessions = useMemo(() => {
    let sortable = [...sessions];
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
  }, [sessions, sortConfig]);

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

  const handleDragStart = (e, session) => {
    setDraggedItem(session);
    e.dataTransfer.setData('text/plain', session.folderName);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, session) => {
    e.preventDefault();
    if (!session || session.isSession) return;
    // Solo se passiamo sopra una cartella normale
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetFolder) => {
    e.preventDefault();
    if (!draggedItem || !targetFolder) return;
    
    let dest = targetFolder.folderName;
    if (targetFolder === '..') {
      dest = 'root'; // handled by backend
    }
    
    if (draggedItem.folderName !== dest) {
      onMoveFolder(draggedItem.folderName, dest);
    }
    setDraggedItem(null);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h2 className="text-lg font-semibold text-slate-800">TGM Sessions Database</h2>
        <div className="text-sm text-slate-500">
          Total Sessions: {sessions.filter(s => s.isSession).length} | Folders: {sessions.filter(s => !s.isSession).length}
        </div>
      </div>
      
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
          </thead>
          <tbody>
            {currentSubFolder && (
              <tr 
                className="border-b border-slate-50 hover:bg-blue-50/50 cursor-pointer transition relative group"
                onClick={() => onNavigate('..')}
                onDragOver={(e) => handleDragOver(e, { isSession: false })}
                onDrop={(e) => handleDrop(e, '..')}
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
                draggable
                onDragStart={(e) => handleDragStart(e, session)}
                onDragOver={(e) => handleDragOver(e, session)}
                onDrop={(e) => handleDrop(e, session)}
                className={`border-b border-slate-50 hover:bg-slate-50/50 transition relative group ${selectedIds.has(session.id) ? 'bg-blue-50/30' : ''}`}
              >
                <td className="text-center p-3">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300" 
                    checked={selectedIds.has(session.id)}
                    onChange={() => toggleSelect(session.id)}
                  />
                </td>
                
                {session.isSession ? (
                  <>
                    <td className="p-3 font-medium text-slate-800">{session.date}</td>
                    <td className="p-3">{session.time}</td>
                    <td className="p-3">{session.startKm?.toFixed(3)}</td>
                    <td className="p-3">{session.endKm?.toFixed(3)}</td>
                    <td className="p-3">{Math.abs((session.endKm || 0) - (session.startKm || 0)).toFixed(3)}</td>
                    <td className="p-3 font-semibold text-slate-700">{session.stazionePartenza || '-'}</td>
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
                        <span className="bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full text-xs font-semibold">Parametri</span>
                      )}
                      {session.hasTqi && (
                        <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full text-xs font-semibold">TQI</span>
                      )}
                      {session.hasExceedances && (
                        <span className="bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-full text-xs font-semibold">Eccedenze</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-3 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex justify-end gap-2">
                      {session.isSession && (
                        <button 
                          onClick={() => onPlaySession && onPlaySession(session)}
                          className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition"
                          title="Carica Dati"
                        >
                          ▶️
                        </button>
                      )}
                      <button 
                        onClick={() => onDeleteSession && onDeleteSession(session)}
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded transition"
                        title="Elimina"
                      >
                        🗑️
                      </button>
                    </div>
                    
                    {isDebugMode && (
                      <div className="text-[10px] text-slate-500 font-mono opacity-50 group-hover:opacity-100 transition-opacity">
                        ID: {session.id}
                      </div>
                    )}
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
    </div>
  );
}
