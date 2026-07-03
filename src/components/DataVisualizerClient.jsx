'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const DataVisualizer = dynamic(() => import('./DataVisualizer'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
      Loading visualizer…
    </div>
  ),
});

export default function DataVisualizerClient() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading…</div>}>
      <DataVisualizer />
    </Suspense>
  );
}
