'use client';

import React, { useState, useEffect } from 'react';

export default function TGMMaintenanceDatabase({ dbPath, onNavigateBack }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    station: '',
    startKm: '',
    endKm: '',
    taskType: '',
    operator: '',
    notes: ''
  });

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tgm/maintenance?path=${encodeURIComponent(dbPath)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Errore recupero manutenzioni');
      setRecords(json.records || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [dbPath]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch(`/api/tgm/maintenance?path=${encodeURIComponent(dbPath)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          startKm: parseFloat(formData.startKm),
          endKm: parseFloat(formData.endKm)
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Errore salvataggio');
      
      setRecords([...records, json.record]);
      setShowModal(false);
      setFormData({ date: '', station: '', startKm: '', endKm: '', taskType: '', operator: '', notes: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminare questo intervento?')) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/tgm/maintenance/${id}?path=${encodeURIComponent(dbPath)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Errore eliminazione');
      setRecords(records.filter(r => r.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h2 className="font-semibold text-lg text-slate-800">Database Manutenzione (Draft)</h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowModal(true)}
            className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md transition"
          >
            + Nuovo Intervento
          </button>
          <button 
            onClick={onNavigateBack}
            className="text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-300 px-3 py-1.5 rounded-md transition"
          >
            Chiudi
          </button>
        </div>
      </div>
      
      {error && <div className="p-4 text-red-600 bg-red-50">{error}</div>}
      
      <div className="flex-1 overflow-auto p-4">
        {loading && records.length === 0 ? (
          <div className="text-center text-slate-500 py-8">Caricamento...</div>
        ) : records.length === 0 ? (
          <div className="text-center text-slate-500 py-8">Nessun intervento registrato.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <th className="p-3">DATA</th>
                <th className="p-3">TIPO INTERVENTO</th>
                <th className="p-3">STAZIONE/LINEA</th>
                <th className="p-3">DA KM</th>
                <th className="p-3">A KM</th>
                <th className="p-3">OPERATORE</th>
                <th className="p-3 text-right">AZIONI</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3 text-sm">{r.date}</td>
                  <td className="p-3 text-sm font-medium">{r.taskType}</td>
                  <td className="p-3 text-sm">{r.station}</td>
                  <td className="p-3 text-sm">{r.startKm}</td>
                  <td className="p-3 text-sm">{r.endKm}</td>
                  <td className="p-3 text-sm">{r.operator}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700">Elimina</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[500px] shadow-xl">
            <h3 className="text-lg font-bold mb-4">Nuovo Intervento</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input required type="date" className="border p-2 rounded" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              <input required type="text" placeholder="Tipo di Intervento (es. Rincalzatura)" className="border p-2 rounded" value={formData.taskType} onChange={e => setFormData({...formData, taskType: e.target.value})} />
              <input required type="text" placeholder="Stazione/Linea" className="border p-2 rounded" value={formData.station} onChange={e => setFormData({...formData, station: e.target.value})} />
              <div className="flex gap-2">
                <input required type="number" step="0.001" placeholder="Start Km" className="border p-2 rounded w-1/2" value={formData.startKm} onChange={e => setFormData({...formData, startKm: e.target.value})} />
                <input required type="number" step="0.001" placeholder="End Km" className="border p-2 rounded w-1/2" value={formData.endKm} onChange={e => setFormData({...formData, endKm: e.target.value})} />
              </div>
              <input type="text" placeholder="Operatore/Ditta" className="border p-2 rounded" value={formData.operator} onChange={e => setFormData({...formData, operator: e.target.value})} />
              <textarea placeholder="Note aggiuntive" className="border p-2 rounded" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Annulla</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Salva</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
