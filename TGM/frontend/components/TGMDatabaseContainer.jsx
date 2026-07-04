import React, { useState, useEffect, useRef } from 'react';
import TGMDatabaseVisualizer from './TGMDatabaseVisualizer';
import TGMMaintenanceDatabase from './TGMMaintenanceDatabase';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

export default function TGMDatabaseContainer({ onPlaySession, extraHeaderActions }) {
  const { t } = useTranslation();
  const [baseDbPath, setBaseDbPath] = useState('');
  const baseDbPathRef = useRef('');
  const [currentSubFolder, setCurrentSubFolder] = useState('');
  const currentSubFolderRef = useRef('');
  const [sessions, setSessions] = useState([]);
  const [stationsList, setStationsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('database'); // 'database' | 'maintenance'

  // Stati per l'importazione
  const [isDragging, setIsDragging] = useState(false);
  const [importState, setImportState] = useState(null); // 'uploading', 'detecting', 'extracting', etc.
  const [importProgress, setImportProgress] = useState(0);
  const [duplicateFolder, setDuplicateFolder] = useState('');
  const [importError, setImportError] = useState('');
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [cancelSource, setCancelSource] = useState(null);
  
  // Coda
  const [importQueue, setImportQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const queueRef = useRef([]);
  const indexRef = useRef(0);

  const filesRef = useRef(null);
  const isArchiveImportRef = useRef(false);
  const archiveInputRef = useRef(null);
  const directoryInputRef = useRef(null);

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      currentSubFolderRef.current = subFolder;
      baseDbPathRef.current = targetPath;

      try {
        const stationsRes = await fetch(`/api/tgm/stations?path=${encodeURIComponent(targetPath)}`);
        if (stationsRes.ok) {
           const stationsJson = await stationsRes.json();
           setStationsList(stationsJson.stations || []);
        }
      } catch(e) {
        console.warn('Errore fetch stazioni', e);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions('');
  }, []);

  const transitionTo = async (nextState, duration = 500) => {
    setImportState(nextState);
    await delay(duration);
  };
  
  const startImportQueue = (newQueue) => {
    if (newQueue.length === 0) return;
    queueRef.current = newQueue;
    indexRef.current = 0;
    setImportQueue(newQueue);
    setQueueIndex(0);
    processNextInQueue();
  };
  
  const processNextInQueue = () => {
    const currentIndex = indexRef.current;
    if (currentIndex >= queueRef.current.length) {
       // Coda terminata
       setImportState(null);
       setImportQueue([]);
       setQueueIndex(0);
       return;
    }
    const currentItem = queueRef.current[currentIndex];
    
    if (currentItem.isEmailImport) {
      runImportFlow(currentItem, true);
    } else {
      runImportFlow(currentItem.files, currentItem.isArchive);
    }
  };
  
  const handleNextInQueue = () => {
    indexRef.current += 1;
    setQueueIndex(indexRef.current);
    processNextInQueue();
  };

  const cleanupEmailQueue = async (item) => {
    if (item && item.isEmailImport) {
      try {
        await fetch(`/api/tgm/email/queue?file=${encodeURIComponent(item.filename)}`, { method: 'DELETE' });
      } catch (e) {}
    }
  };

  const handleSkipConflict = async () => {
    setDuplicateFolder('');
    await cleanupEmailQueue(importQueue[queueIndex]);
    handleNextInQueue();
  };

  const handleCancelAll = async () => {
    if (cancelSource) {
      cancelSource.cancel();
    }
    if (importQueue && importQueue.length > 0) {
      for (let i = queueIndex; i < importQueue.length; i++) {
        await cleanupEmailQueue(importQueue[i]);
      }
    }
    setImportState(null);
    setImportQueue([]);
    setQueueIndex(0);
  };

  const startEmailImportQueue = (filenames) => {
    if (!filenames || filenames.length === 0) return;
    const newQueue = filenames.map(name => ({
      isEmailImport: true,
      filename: name,
      name: name
    }));
    startImportQueue(newQueue);
  };

  // Expose methods to parent via a ref or by attaching to window (for simplicity in this specific architecture)
  useEffect(() => {
    window.startEmailImportQueue = startEmailImportQueue;
  }); // Run on every render to avoid stale closures

  const runImportFlow = async (filesArray, isArchiveImport) => {
    if (filesArray.length === 0) return;

    filesRef.current = filesArray;
    isArchiveImportRef.current = isArchiveImport;
    setImportError('');
    setImportState('uploading');
    setImportProgress(0);

    const cancelTokenSource = axios.CancelToken.source();
    setCancelSource(cancelTokenSource);

    const formData = new FormData();
    const currentBasePath = baseDbPathRef.current;
    const currentSub = currentSubFolderRef.current;
    formData.append('path', currentBasePath + (currentSub ? '/' + currentSub : ''));
    formData.append('overwrite', 'false');

    // Handle email import vs standard drag&drop
    const isEmailImport = filesArray.isEmailImport;

    if (isEmailImport) {
      formData.append('serverFiles', filesArray.filename);
    } else if (isArchiveImport) {
      formData.append('files', filesArray[0].file, filesArray[0].relPath);
    } else {
      for (const item of filesArray) {
        formData.append('files', item.file, item.relPath);
      }
    }

    let serverResponse = null;
    let serverError = null;

    const uploadPromise = axios.post('/api/tgm/sessions/import', formData, {
      cancelToken: cancelTokenSource.token,
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setImportProgress(Math.min(90, Math.round(percentCompleted * 0.9)));
      }
    }).then(res => {
      serverResponse = res.data;
    }).catch(err => {
      if (axios.isCancel(err)) {
        serverError = new Error('Operazione annullata dall\'utente');
      } else {
        serverError = err;
      }
    });

    try {
      await transitionTo('detecting', 500);

      if (isArchiveImport) {
        setImportState('extracting');
        setImportProgress(92);
        await delay(500);
      } else {
        setImportState('validating');
        setImportProgress(92);
        await delay(500);
      }

      await transitionTo('validating', 500);
      setImportProgress(95);

      await transitionTo('metadata', 500);
      setImportProgress(97);

      setImportState('checking_duplicates');
      setImportProgress(99);
      await delay(500);

      await uploadPromise;

      if (serverError) throw serverError;

      if (serverResponse.duplicate) {
        setDuplicateFolder(serverResponse.folderName);
        setImportState('conflict');
        return;
      }

      await proceedToFinalImport(serverResponse.folderName, cancelTokenSource);

    } catch (err) {
      setImportState('error');
      setImportError(err.response?.data?.error || err.message || 'Errore sconosciuto');
    }
  };

  const proceedToFinalImport = async (folderName, cancelTokenSource) => {
    try {
      await transitionTo('parsing', 500);
      setImportProgress(99);

      await transitionTo('saving_filesystem', 500);
      setImportProgress(100);

      await transitionTo('registering', 500);
      await transitionTo('success', 750);

      setCancelSource(null);
      fetchSessions(currentSubFolder);
      handleNextInQueue();
    } catch (err) {
      setImportState('error');
      setImportError(err.message || 'Errore di registrazione nel database');
    }
  };

  const handleOverwrite = async () => {
    if (!duplicateFolder || !filesRef.current) return;

    setImportError('');
    setImportState('uploading');
    setImportProgress(90);

    const cancelTokenSource = axios.CancelToken.source();
    setCancelSource(cancelTokenSource);

    const formData = new FormData();
    const currentBasePath = baseDbPathRef.current;
    const currentSub = currentSubFolderRef.current;
    formData.append('path', currentBasePath + (currentSub ? '/' + currentSub : ''));
    formData.append('overwrite', 'true');

    const isEmailImport = filesRef.current.isEmailImport;

    if (isEmailImport) {
      formData.append('serverFiles', filesRef.current.filename);
    } else if (isArchiveImportRef.current) {
      formData.append('files', filesRef.current[0].file, filesRef.current[0].relPath);
    } else {
      for (const item of filesRef.current) {
        formData.append('files', item.file, item.relPath);
      }
    }

    try {
      setImportState('saving_filesystem');
      setImportProgress(95);

      const res = await axios.post('/api/tgm/sessions/import', formData, {
        cancelToken: cancelTokenSource.token
      });

      await proceedToFinalImport(res.data.folderName, cancelTokenSource);
    } catch (err) {
      setImportState('error');
      setImportError(err.response?.data?.error || err.message || 'Errore sovrascrittura');
    }
  };

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

  const handleDeleteSession = async (session) => {
    if (!window.confirm(t('confirmDelete', 'Sei sicuro di voler eliminare definitivamente questa sessione? L\'operazione è irreversibile.'))) {
      return;
    }
    try {
      const res = await fetch('/api/tgm/sessions/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          targetPath: baseDbPath + (currentSubFolder ? '/' + currentSubFolder : ''),
          sessionId: session.folderName
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchSessions(currentSubFolder);
    } catch (err) {
      alert('Errore eliminazione: ' + err.message);
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

  // Funzioni Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    const filesList = [];
    const readDirectoryEntries = async (reader) => {
      let allEntries = [];
      const read = async () => {
        const entries = await new Promise((resolve) => reader.readEntries(resolve));
        if (entries.length > 0) {
          allEntries = allEntries.concat(entries);
          await read();
        }
      };
      await read();
      return allEntries;
    };

    const traverse = async (entry) => {
      if (entry.isFile) {
        const file = await new Promise((resolve) => entry.file(resolve));
        const relPath = entry.fullPath.startsWith('/') ? entry.fullPath.substring(1) : entry.fullPath;
        filesList.push({ file, relPath });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const entries = await readDirectoryEntries(reader);
        for (const childEntry of entries) {
          await traverse(childEntry);
        }
      }
    };

    const promises = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const entry = item.webkitGetAsEntry();
      if (entry) {
        promises.push(traverse(entry));
      }
    }

    await Promise.all(promises);
    if (filesList.length === 0) return;

    const grouped = {};
    const archives = [];
    
    filesList.forEach(({ file, relPath }) => {
      const parts = relPath.split('/');
      if (parts.length === 1 && (relPath.toLowerCase().endsWith('.zip') || relPath.toLowerCase().endsWith('.rar'))) {
        archives.push({ file, relPath, isArchive: true });
      } else {
        const rootFolder = parts[0];
        if (!grouped[rootFolder]) grouped[rootFolder] = [];
        grouped[rootFolder].push({ file, relPath });
      }
    });

    const newQueue = [];
    for (const folderName in grouped) {
      newQueue.push({ files: grouped[folderName], isArchive: false, name: folderName });
    }
    for (const arch of archives) {
      newQueue.push({ files: [arch], isArchive: true, name: arch.file.name });
    }

    startImportQueue(newQueue);
  };

  const handleDirectorySelect = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const filesList = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      filesList.push({ file, relPath: file.webkitRelativePath || file.name });
    }
    
    const grouped = {};
    filesList.forEach(({ file, relPath }) => {
      const parts = relPath.split('/');
      const rootFolder = parts[0];
      if (!grouped[rootFolder]) grouped[rootFolder] = [];
      grouped[rootFolder].push({ file, relPath });
    });
    
    const newQueue = [];
    for (const folderName in grouped) {
      newQueue.push({ files: grouped[folderName], isArchive: false, name: folderName });
    }
    
    startImportQueue(newQueue);
  };

  const handleArchiveSelect = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const newQueue = [];
    for (let i = 0; i < files.length; i++) {
       newQueue.push({ files: [{ file: files[i], relPath: files[i].name }], isArchive: true, name: files[i].name });
    }
    startImportQueue(newQueue);
  };

  return (
    <div 
      className={`flex flex-col gap-2 w-full h-[400px] transition-colors relative duration-200 ${isDragging ? 'bg-blue-50/50 rounded-xl outline outline-2 outline-dashed outline-blue-400' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-3">
          <label className="block text-sm font-semibold tracking-wide uppercase text-slate-800">
            TGM Sessions Database
          </label>
          <span className="text-xs text-blue-600 font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            /{currentSubFolder}
          </span>
        </div>
        <div className="flex gap-3 items-center">
          {viewMode === 'database' && (
            <button
              onClick={() => setViewMode('maintenance')}
              className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-sm"
            >
              🛠️ {t('maintenance', 'Manutenzioni')}
            </button>
          )}
          {/* Pulsante Importazione File */}
          <div className="relative">
            <button
              onClick={() => setShowImportMenu(!showImportMenu)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
            >
              {t('importFile')}
            </button>
            {showImportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowImportMenu(false)}></div>
                <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 text-slate-700">
                  <button
                    onClick={() => {
                      setShowImportMenu(false);
                      directoryInputRef.current.click();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-medium flex items-center gap-2"
                  >
                    📁 {t('importDirectory')}
                  </button>
                  <button
                    onClick={() => {
                      setShowImportMenu(false);
                      archiveInputRef.current.click();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-medium flex items-center gap-2"
                  >
                    📦 {t('importArchive')}
                  </button>
                </div>
              </>
            )}
          </div>
          {extraHeaderActions}
        </div>
      </div>
      
      {/* Input File Nascosti */}
      <input 
        type="file" 
        ref={directoryInputRef} 
        webkitdirectory="" 
        directory="" 
        multiple 
        style={{ display: 'none' }} 
        onChange={handleDirectorySelect}
      />
      <input 
        type="file" 
        ref={archiveInputRef} 
        accept=".zip,.rar" 
        style={{ display: 'none' }} 
        onChange={handleArchiveSelect}
      />

      {error && <div className="text-red-500 text-xs mb-2">{error}</div>}
      
      {isDragging && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-blue-50/80 backdrop-blur-sm rounded-xl outline outline-2 outline-dashed outline-blue-500 pointer-events-none">
          <div className="text-xl font-bold text-blue-700 pointer-events-none">
            {t('releaseToImport', 'Release to import')}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200">
        {viewMode === 'maintenance' ? (
          <TGMMaintenanceDatabase 
            dbPath={baseDbPath} 
            onNavigateBack={() => setViewMode('database')} 
          />
        ) : (
          <TGMDatabaseVisualizer 
            sessions={sessions} 
            stationsList={stationsList}
            currentSubFolder={currentSubFolder}
            onNavigate={handleNavigate}
            onPlaySession={(s, dbPath) => onPlaySession(s, baseDbPath + (currentSubFolder ? '/' + currentSubFolder : ''))}
            onMoveFolder={handleMoveFolder}
            onDeleteSession={handleDeleteSession}
          />
        )}
      </div>

      {/* Overlay di Caricamento e Macchina a Stati */}
      {importState && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              {t('importingTitle')} {importQueue.length > 1 ? `(${queueIndex + 1}/${importQueue.length})` : ''}
            </h3>
            {importQueue.length > 1 && importQueue[queueIndex] && (
               <div className="text-xs text-slate-500 mb-4 font-mono truncate">
                 Folder: {importQueue[queueIndex].name}
               </div>
            )}
            
            {importState === 'conflict' ? (
              <div>
                <p className="text-sm text-slate-600 mb-6">
                  {t('duplicateConfirmText', { folderName: duplicateFolder })}
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleSkipConflict}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                    autoFocus
                  >
                    {t('skip', 'Skip')}
                  </button>
                  <button
                    onClick={handleOverwrite}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition"
                  >
                    {t('overwrite', 'Overwrite')}
                  </button>
                </div>
              </div>
            ) : importState === 'error' ? (
              <div>
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 font-medium mb-6 whitespace-pre-wrap">
                  ❌ {importError}
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleCancelAll}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={async () => {
                      if (queueIndex >= importQueue.length - 1) {
                         await cleanupEmailQueue(importQueue[queueIndex]);
                         setImportState(null);
                         setImportQueue([]);
                         setQueueIndex(0);
                      } else {
                         await cleanupEmailQueue(importQueue[queueIndex]);
                         handleNextInQueue();
                      }
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition"
                  >
                    {queueIndex >= importQueue.length - 1 ? t('close', 'Close') : t('continueRemaining', 'Continue ({{count}} remaining)', { count: importQueue.length - queueIndex - 1 })}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider animate-pulse">
                    {t('state_' + importState)}
                  </span>
                  {importProgress > 0 && (
                    <span className="text-xs font-bold text-slate-500 font-mono">
                      {importProgress}%
                    </span>
                  )}
                </div>
                
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-6">
                  <div 
                    className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${importProgress || 5}%` }}
                  ></div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleCancelAll}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

