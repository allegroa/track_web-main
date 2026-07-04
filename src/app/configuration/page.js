'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import i18n from '../../lib/i18n';

export default function ConfigurationPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [allData, setAllData] = useState({ activeOperator: '', operators: {} });
  const [operators, setOperators] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState('');
  const [newOperatorName, setNewOperatorName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [config, setConfig] = useState({
    language: 'en',
    sampleSize: 2000,
    sectionLength: 200,
    useSampling: true,
    selectedX: 'km',
    dataSourceType: 'local',
    dataSourcePath: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/configuration');
      const data = await res.json();
      setAllData(data);
      const ops = data.operators ? Object.keys(data.operators) : [];
      setOperators(ops);
      
      let initialOp = data.activeOperator;
      if (!initialOp && ops.length > 0) {
        initialOp = ops[0];
      }
      
      if (initialOp) {
        setSelectedOperator(initialOp);
        applyConfigToForm(data.operators[initialOp]);
      }
    } catch (e) {
      console.error('Errore caricamento configurazione globale', e);
    }
  };

  const applyConfigToForm = (opConfig) => {
    if (!opConfig) return;
    
    if (opConfig.language && i18n.language !== opConfig.language) {
      i18n.changeLanguage(opConfig.language);
    }

    setConfig({
      language: opConfig.language || 'en',
      sampleSize: opConfig.sampleSize !== undefined ? opConfig.sampleSize : 2000,
      sectionLength: opConfig.sectionLength !== undefined ? opConfig.sectionLength : 200,
      useSampling: opConfig.useSampling !== undefined ? opConfig.useSampling : true,
      selectedX: opConfig.selectedX || 'km',
      dataSourceType: opConfig.dataSourceType || 'local',
      dataSourcePath: opConfig.dataSourcePath || ''
    });
  };

  useEffect(() => {
    if (selectedOperator && !isCreatingNew && allData.operators) {
      applyConfigToForm(allData.operators[selectedOperator]);
    }
  }, [selectedOperator, isCreatingNew]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    const opName = isCreatingNew ? newOperatorName.trim() : selectedOperator;
    if (!opName) {
      setMessage({ type: 'error', text: t('invalidOperatorName') || 'Enter a valid operator name before saving' });
      setLoading(false);
      return;
    }

    const cleanOpName = opName.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanOpName) {
      setMessage({ type: 'error', text: t('invalidOperatorChars') || 'The operator name contains invalid characters' });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/configuration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activeOperator: cleanOpName,
          operators: {
            ...allData.operators,
            [cleanOpName]: config
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: t('configSavedSuccess', { operator: cleanOpName }) || `Configuration saved successfully for operator ${cleanOpName}!` });
        if (isCreatingNew) {
          setIsCreatingNew(false);
          setNewOperatorName('');
        }
        await fetchConfig();
      } else {
        setMessage({ type: 'error', text: data.error || t('configSaveError') || 'Errore nel salvataggio' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: t('apiConnectionError') || 'Impossibile connettersi alle API' });
    } finally {
      setLoading(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!config.dataSourcePath) return;
    const confirmDelete = window.confirm(t('clearDbConfirm') || "Sei sicuro di voler azzerare il database? Questa operazione cancellerà tutti i dati in modo permanente.");
    if (!confirmDelete) return;

    try {
      const response = await fetch('/api/tgm/sessions/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clear-database',
          targetPath: config.dataSourcePath
        })
      });
      const data = await response.json();
      if (data.success) {
        alert(t('clearDbSuccess') || "Database azzerato con successo.");
      } else {
        alert((t('clearDbError') || "Errore durante l'azzeramento: ") + data.error);
      }
    } catch (error) {
      alert((t('networkError') || "Errore di rete: ") + error.message);
    }
  };

  const preventEnterSubmit = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const hasValidOperator = isCreatingNew ? newOperatorName.trim().length > 0 : selectedOperator.length > 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center p-6">
      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all duration-300 mt-6">
        
        {/* Header */}
        <div className="px-6 py-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              {t('tgmConfigTitle') || 'Configurazione Modulo TGM'}
              <span className="bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded text-sm shadow-sm">
                v1.6
              </span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {t('tgmConfigDesc') || "Gestisci le preferenze di visualizzazione specifiche per ciascun operatore. L'operatore salvato diverrà quello attivo."}
            </p>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 md:p-8 space-y-6">
          
          {/* Notifiche */}
          {message.text && (
            <div className={`p-4 rounded-xl border transition-all duration-300 ${
              message.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}>
              <div className="flex items-center space-x-2">
                {message.type === 'success' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                )}
                <span className="text-sm font-medium">{message.text}</span>
              </div>
            </div>
          )}

          {/* Selezione Operatore */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 md:p-6 space-y-4 shadow-sm">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold tracking-wide uppercase text-slate-700">
                {t('operatorLabel') || 'Operatore'}
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNew(!isCreatingNew);
                  setMessage({ type: '', text: '' });
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors focus:outline-none bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100"
              >
                {isCreatingNew ? (t('selectExisting') || 'Seleziona esistente') : (t('newOperator') || '+ Nuovo Operatore')}
              </button>
            </div>

            {isCreatingNew ? (
              <div className="space-y-1">
                <input
                  type="text"
                  required
                  placeholder={t('operatorPlaceholder') || "Inserisci nome operatore (es. RFI)"}
                  value={newOperatorName}
                  onChange={(e) => setNewOperatorName(e.target.value)}
                  onKeyDown={preventEnterSubmit}
                  className="w-full md:w-1/2 bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-lg px-4 py-2.5 text-slate-800 placeholder-slate-400 transition-all focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
                <p className="text-xs text-slate-500">{t('operatorHint') || "Solo lettere, numeri, trattini e underscore."}</p>
              </div>
            ) : (
              <select
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                disabled={operators.length === 0}
                className="w-full md:w-1/2 bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-lg px-4 py-2.5 text-slate-800 transition-all focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {operators.length === 0 ? (
                  <option value="">{t('noOperators') || 'Nessun operatore configurato (Creane uno nuovo)'}</option>
                ) : (
                  operators.map((op) => (
                    <option key={op} value={op}>{op} {allData.activeOperator === op ? (t('active') || '(Attivo)') : ''}</option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Origine Dati */}
          <div className={`bg-slate-50 border border-slate-100 rounded-xl p-4 md:p-6 space-y-4 shadow-sm transition-opacity ${hasValidOperator ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-700">{t('dataLocation') || 'Posizione Dati'}</h3>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer">
                <input 
                  type="radio" 
                  name="dataSourceType" 
                  value="local" 
                  checked={config.dataSourceType === 'local'} 
                  onChange={(e) => setConfig({ ...config, dataSourceType: e.target.value })}
                  className="text-blue-600 border-slate-300 bg-white focus:ring-blue-500"
                />
                <span>{t('local') || 'Locale'}</span>
              </label>
              <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer">
                <input 
                  type="radio" 
                  name="dataSourceType" 
                  value="nas" 
                  checked={config.dataSourceType === 'nas'} 
                  onChange={(e) => setConfig({ ...config, dataSourceType: e.target.value })}
                  className="text-blue-600 border-slate-300 bg-white focus:ring-blue-500"
                />
                <span>{t('nasNetworkPath') || 'NAS / Percorso di Rete'}</span>
              </label>
            </div>
            
            <div className="flex flex-col space-y-2 relative">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dataFolderPath') || 'Percorso Cartella Dati'}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.dataSourcePath}
                  onChange={(e) => setConfig({ ...config, dataSourcePath: e.target.value })}
                  onKeyDown={preventEnterSubmit}
                  className="flex-1 bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-slate-800 transition-all focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={config.dataSourceType === 'nas' ? '\\\\IndirizzoNAS\\Cartella\\Dati' : 'C:\\Dati\\Operatore'}
                />
                <button
                  type="button"
                  onClick={() => setIsFileBrowserOpen(true)}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-700 transition-colors shadow-sm whitespace-nowrap font-medium"
                >
                  {t('browse') || 'Sfoglia...'}
                </button>
                <button
                  type="button"
                  onClick={handleClearDatabase}
                  className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg px-4 py-2 text-sm transition-colors shadow-sm whitespace-nowrap font-medium"
                >
                  {t('clearDatabase') || 'Cancella Database'}
                </button>
              </div>
            </div>
          </div>

          {/* Configurazione Parametri */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity ${hasValidOperator ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            
            {/* Lingua Default */}
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('defaultLanguage') || 'Lingua Default'}</label>
              <select
                value={config.language}
                onChange={(e) => setConfig({ ...config, language: e.target.value })}
                className="bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-slate-800 transition-all focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="en">English (Default)</option>
                <option value="zh">Chinese (Simplified)</option>
                <option value="zh-TW">Taiwanese (Traditional)</option>
                <option value="de">Deutsch (German)</option>
                <option value="it">Italiano (Italian)</option>
              </select>
            </div>

            {/* Asse X di Default */}
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('defaultXAxis') || 'Asse X Default'}</label>
              <input
                type="text"
                value={config.selectedX}
                onChange={(e) => setConfig({ ...config, selectedX: e.target.value })}
                onKeyDown={preventEnterSubmit}
                className="bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-slate-800 transition-all focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="es. km"
              />
            </div>

            {/* Dimensione Campione */}
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('sampleSizePts') || 'Dimensione Campione (Punti)'}</label>
              <input
                type="number"
                min="100"
                max="50000"
                value={config.sampleSize}
                onChange={(e) => setConfig({ ...config, sampleSize: parseInt(e.target.value) || 2000 })}
                onKeyDown={preventEnterSubmit}
                className="bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-slate-800 transition-all focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Lunghezza Sezione */}
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('sectionLengthMeters') || 'Lunghezza Sezione (Metri)'}</label>
              <input
                type="number"
                min="10"
                max="10000"
                value={config.sectionLength}
                onChange={(e) => setConfig({ ...config, sectionLength: parseInt(e.target.value) || 200 })}
                onKeyDown={preventEnterSubmit}
                className="bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-slate-800 transition-all focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Abilita Campionamento */}
            <div className="md:col-span-2 flex items-center space-x-3 p-3 bg-slate-50 border border-slate-100 rounded-lg">
              <input
                type="checkbox"
                id="useSampling"
                checked={config.useSampling}
                onChange={(e) => setConfig({ ...config, useSampling: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded bg-white focus:ring-blue-500 focus:ring-offset-slate-50 focus:ring-1"
              />
              <label htmlFor="useSampling" className="text-sm text-slate-700 font-medium select-none cursor-pointer">
                {t('enableSampling') || 'Abilita il campionamento dei dati di default (consigliato per file grandi)'}
              </label>
            </div>

          </div>

          {/* Azioni */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:justify-between items-center gap-4">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition-all duration-200 text-center"
            >
              {t('cancelAndReturn') || 'Annulla e Torna alla Home'}
            </button>
            <button
              type="submit"
              disabled={loading || !hasValidOperator}
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-center"
            >
              {loading ? (t('saving') || 'Salvataggio...') : (t('saveConfiguration') || 'Salva Configurazione')}
            </button>
          </div>

          <FileBrowserModal 
            isOpen={isFileBrowserOpen}
            onClose={() => setIsFileBrowserOpen(false)}
            onSelect={(path) => {
              setConfig({ ...config, dataSourcePath: path });
              setIsFileBrowserOpen(false);
            }}
          />

        </form>
      </div>
    </main>
  );
}

// --- FILE BROWSER MODAL COMPONENT ---
const FileBrowserModal = ({ isOpen, onClose, onSelect }) => {
  const [currentPath, setCurrentPath] = useState('');
  const [folders, setFolders] = useState([]);
  const [loadingDir, setLoadingDir] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDirectory('');
    }
  }, [isOpen]);

  const loadDirectory = async (path) => {
    setLoadingDir(true);
    try {
      const res = await fetch('/api/list-dirs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPath: path })
      });
      const data = await res.json();
      if (data.error) {
        alert("Errore accesso cartella: " + data.error);
      } else {
        setFolders(data.files || []);
        setCurrentPath(data.currentPath);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingDir(false);
  };

  const goUp = () => {
    if (!currentPath || currentPath.length <= 3) {
      loadDirectory(''); // dischi
      return;
    }
    const parts = currentPath.split(/[\\/]/).filter(Boolean);
    parts.pop();
    if (parts.length === 1 && currentPath.includes(':\\')) {
      loadDirectory(parts[0] + '\\');
    } else if (parts.length > 0) {
      loadDirectory(parts.join('\\'));
    } else {
      loadDirectory('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col h-[70vh]">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-200">Seleziona Cartella Dati</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xl font-bold">&times;</button>
        </div>
        <div className="p-3 bg-slate-900/50 flex gap-2 items-center border-b border-slate-700/50">
          <button type="button" onClick={goUp} disabled={!currentPath} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 text-sm disabled:opacity-50 border border-slate-600 transition-colors">
            &#8593; Su
          </button>
          <div className="flex-1 truncate text-sm text-blue-300 font-mono bg-slate-900 p-1.5 rounded border border-slate-700/50">
            {currentPath || "Dischi Locali (Seleziona un'unità)"}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
          {loadingDir ? (
            <div className="flex justify-center p-8 text-slate-500 text-sm">Caricamento in corso...</div>
          ) : (
            <div className="space-y-1">
              {folders.map(f => (
                <div 
                  key={f.path}
                  onClick={() => loadDirectory(f.path)}
                  className="flex items-center gap-3 p-2.5 hover:bg-slate-700/60 cursor-pointer rounded-lg text-slate-200 text-sm transition-colors border border-transparent hover:border-slate-600"
                >
                  <span className="text-blue-400 text-xl">📁</span>
                  <span className="truncate">{f.name}</span>
                </div>
              ))}
              {folders.length === 0 && <div className="p-4 text-center text-slate-500 text-sm">Questa cartella è vuota o non contiene sottocartelle.</div>}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-slate-700 flex justify-end gap-3 bg-slate-900/30">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm transition-colors font-medium">
            Annulla
          </button>
          <button 
            type="button"
            onClick={() => onSelect(currentPath)}
            disabled={!currentPath}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm disabled:opacity-50 transition-colors shadow-md"
          >
            Conferma questa cartella
          </button>
        </div>
      </div>
    </div>
  );
};
