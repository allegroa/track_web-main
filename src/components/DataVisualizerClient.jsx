'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const DataVisualizer = dynamic(() => import('./DataVisualizer'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
      Loading visualizer…
    </div>
  ),
});

export default function DataVisualizerClient() {
  const { t } = useTranslation();
  const [emailFilesCount, setEmailFilesCount] = useState(0);
  const [emailFiles, setEmailFiles] = useState([]);

  useEffect(() => {
    let pollingInterval = 15; // default 15 minutes
    let intervalId;

    const checkEmails = async () => {
      try {
        const res = await fetch('/api/tgm/email/check', { method: 'POST' });
        const data = await res.json();
        if (data.success && data.queueCount > 0) {
          setEmailFilesCount(data.queueCount);
          setEmailFiles(data.files || []);
        } else if (data.success && data.queueCount === 0) {
          setEmailFilesCount(0);
          setEmailFiles([]);
        }
      } catch (e) {
        console.error('Failed to poll emails', e);
      }
    };

    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/configuration');
        const data = await res.json();
        if (data.emailConfig && data.emailConfig.pollingInterval) {
          pollingInterval = data.emailConfig.pollingInterval;
        }
      } catch (e) {
        // ignore
      }
      
      // Start polling
      intervalId = setInterval(checkEmails, pollingInterval * 60 * 1000);
      // Run once at startup
      checkEmails();
    };

    fetchConfig();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const handleImportNow = () => {
    if (window.startEmailImportQueue && emailFiles.length > 0) {
      window.startEmailImportQueue(emailFiles);
      // Hide banner immediately to let the import modal take focus
      setEmailFilesCount(0);
      setEmailFiles([]);
    } else if (!window.startEmailImportQueue) {
      alert("Il componente di importazione non è ancora stato caricato.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {emailFilesCount > 0 && (
        <div className="bg-amber-100 border-b border-amber-200 px-6 py-3 text-amber-800 flex justify-between items-center shadow-sm shrink-0 z-50">
          <div className="flex items-center gap-3">
            <span className="text-xl">📧</span>
            <span className="font-medium text-sm">
              {t('emailFilesReady', { count: emailFilesCount }) || `Ci sono ${emailFilesCount} file ricevuti via email pronti per l'importazione.`}
            </span>
          </div>
          <button 
            onClick={handleImportNow}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded shadow-sm transition-colors"
          >
            {t('importNow') || 'Importa Ora'}
          </button>
        </div>
      )}
      <div className="flex-1 relative">
        <Suspense fallback={<div className="flex h-full w-full items-center justify-center">Loading…</div>}>
          <DataVisualizer />
        </Suspense>
      </div>
    </div>
  );
}
