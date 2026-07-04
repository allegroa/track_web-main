'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const TGMView = dynamic(() => import('../../TGM/frontend/views/TGMView'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600 font-medium">
      Caricamento TGM Database…
    </div>
  ),
});

export default function TGMViewClient() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Caricamento…</div>}>
      <TGMView />
    </Suspense>
  );
}
