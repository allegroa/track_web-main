import DataVisualizerClient from '../components/DataVisualizerClient';

export default function HomePage() {
  return (
    <>
      <DataVisualizerClient />
      <div className="fixed bottom-4 right-4 z-50">
        <a 
          href="/tgm" 
          className="bg-slate-800 text-white px-4 py-2 rounded-full shadow-lg hover:bg-slate-700 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          Vai al Modulo TGM →
        </a>
      </div>
    </>
  );
}
