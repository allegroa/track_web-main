import './globals.css';

export const metadata = {
  title: 'RAMSYS Data Visualizer',
  description: 'Railway geometry data visualization service for WebOne',
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body className="min-h-screen bg-slate-100 antialiased">{children}</body>
    </html>
  );
}
