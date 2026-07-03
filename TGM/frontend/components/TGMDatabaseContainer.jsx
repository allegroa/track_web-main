import React, { useState, useEffect } from 'react';
import TGMDatabaseVisualizer from './TGMDatabaseVisualizer';

export default function TGMDatabaseContainer({ onPlaySession }) {
  const [baseDbPath, setBaseDbPath] = useState('');
  const [currentSubFolder, setCurrentSubFolder] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchSessions = async (subFolder = currentSubFolder) => {
    try {
      setLoading(true);
      setError('');
      
      const configRes = await fetch('/api/configuration');
      if (!configRes.ok) throw new Error('Impossibile leggere la configurazione');
      const configData = await configRes.json();
      
      const activeOp = configData.activeOperator;
      const targetPath = configData.operators?.[activeOp]?.dataSourcePath || 'E:/Software/track_web-main/database';
      setBaseDbPath(targetPath);
      
      let fullPath = targetPath;
      if (subFolder) {
        fullPath = `${targetPath}/${subFolder}`;
      }
      
      const res = await fetch(`/api/tgm/sessions?path=${encodeURIComponent(fullPath)}`);
      const json = await res.json();
      
      if (!res.ok) throw new Error(json.error || 'Errore nel recupero delle sessioni');
      
      setSessions(json.sessions || []);
      setCurrentSubFolder(subFolder);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions('');
  }, []);

  const handleCreateFolder = async () => {
    const name = prompt('Nome nuova cartella:');
    if (!name) return;
    try {
      const res = await fetch('/api/tgm/sessions/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          targetPath: baseDbPath + (currentSubFolder ? '/' + currentSubFolder : ''),
          folderName: name
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchSessions(currentSubFolder);
    } catch (err) {
      alert('Errore creazione cartella: ' + err.message);
    }
  };

  const handleMoveFolder = async (sourceFolder, destinationFolder) => {
    try {
      const res = await fetch('/api/tgm/sessions/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move',
          targetPath: baseDbPath + (currentSubFolder ? '/' + currentSubFolder : ''),
          sourceFolder,
          destinationFolder
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchSessions(currentSubFolder);
    } catch (err) {
      alert('Errore spostamento cartella: ' + err.message);
    }
  };

  const handleNavigate = (subDir) => {
    if (subDir === '..') {
      const parts = currentSubFolder.split('/').filter(Boolean);
      parts.pop();
      fetchSessions(parts.join('/'));
    } else {
      const newSub = currentSubFolder ? `${currentSubFolder}/${subDir}` : subDir;
      fetchSessions(newSub);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full h-[400px]">
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-3">
          <label className="block text-sm font-semibold tracking-wide uppercase text-slate-300">
            TGM Sessions Database
          </label>
          <span className="text-xs text-blue-300 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            /{currentSubFolder}
          </span>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleCreateFolder}
            className="text-xs text-green-400 hover:text-green-300 border border-green-800 bg-green-900/30 px-2 py-1 rounded"
          >
            + Nuova Cartella
          </button>
          <button 
            onClick={() => fetchSessions(currentSubFolder)}
            disabled={loading}
            className="text-xs text-blue-400 hover:text-blue-300 border border-blue-800 bg-blue-900/30 px-2 py-1 rounded"
          >
            {loading ? 'Aggiornamento...' : '↻ Ricarica'}
          </button>
        </div>
      </div>
      
      {error && <div className="text-red-400 text-xs mb-2">{error}</div>}
      
      <div className="flex-1 overflow-hidden rounded-xl border border-slate-700">
        <TGMDatabaseVisualizer 
          sessions={sessions} 
          currentSubFolder={currentSubFolder}
          onNavigate={handleNavigate}
          onPlaySession={(s) => onPlaySession(s, baseDbPath + (currentSubFolder ? '/' + currentSubFolder : ''))}
          onMoveFolder={handleMoveFolder}
          onDeleteSession={(s) => console.log('Delete non implementato', s)}
        />
      </div>
    </div>
  );
}
