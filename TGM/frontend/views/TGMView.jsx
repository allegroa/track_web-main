'use client';

import React, { useState, useEffect } from 'react';
import TGMChart from '../components/TGMChart';
import TGMDatabaseVisualizer from '../components/TGMDatabaseVisualizer';

export default function TGMView() {
  const [dbPath, setDbPath] = useState('E:/Software/track_web-main/database');
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('database'); // 'database' or 'chart'

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/tgm/sessions?path=${encodeURIComponent(dbPath)}`);
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error || 'Errore nel recupero delle sessioni');
      }
      
      setSessions(json.sessions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionData = async (session) => {
    try {
      setLoading(true);
      setError('');
      setSelectedSession(session);
      setViewMode('chart');
      
      const res = await fetch(`/api/tgm/sessions/${encodeURIComponent(session.id)}/data?path=${encodeURIComponent(dbPath)}`);
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error || 'Errore nel recupero dei dati della sessione');
      }
      
      setChartData(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-screen flex flex-col bg-slate-50">
      <div className="mb-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            TGM Database
            <span className="bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded text-sm">v1.6</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">TGM Visualizer v1.6</p>
        </div>
        
        <div className="flex gap-4 items-end">
          <div>
            <input 
              type="text" 
              placeholder="Percorso Database"
              className="w-64 border-slate-300 rounded-md shadow-sm border p-2 text-sm"
              value={dbPath}
              onChange={(e) => setDbPath(e.target.value)}
            />
          </div>
          <button 
            onClick={fetchSessions}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-md transition-colors text-sm border border-slate-200"
            disabled={loading && viewMode === 'database'}
          >
            {loading && viewMode === 'database' ? 'Caricamento...' : 'Aggiorna DB'}
          </button>
          <button 
            className="bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-all shadow-sm"
          >
            ⚙️ Tolleranze / Configurazione
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm shadow-sm">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 relative">
        {viewMode === 'database' ? (
          <TGMDatabaseVisualizer 
            sessions={sessions}
            onPlaySession={loadSessionData}
          />
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 h-full flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="font-semibold text-lg text-slate-800">
                {selectedSession ? `Visualizzazione Grafico: ${selectedSession.label}` : 'Grafico'}
              </h2>
              <button 
                onClick={() => setViewMode('database')}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-md transition"
              >
                ← Torna al Database
              </button>
            </div>
            
            <div className="flex-1 p-4 relative min-h-0">
              {loading ? (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
                  <div className="text-blue-600 font-medium">Estrazione dati in corso...</div>
                </div>
              ) : chartData ? (
                <TGMChart data={chartData} />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                  Impossibile caricare il grafico.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
