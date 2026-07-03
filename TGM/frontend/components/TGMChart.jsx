'use client';

import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
);

export default function TGMChart({ data }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    // Assumiamo che la prima colonna numerica crescente o con 'km' nel nome sia l'asse X
    const keys = Object.keys(data[0]);
    const xKey = keys.find(k => k.toLowerCase().includes('km')) || keys[0];
    
    // Raccogliamo le chiavi numeriche per gli assi Y (escludendo l'asse X)
    const yKeys = keys.filter(k => k !== xKey && typeof data[0][k] === 'number');

    const labels = data.map(row => row[xKey]);
    
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    
    const datasets = yKeys.slice(0, 6).map((key, index) => ({
      label: key,
      data: data.map(row => row[key]),
      borderColor: colors[index % colors.length],
      borderWidth: 1.5,
      pointRadius: 0, // Ottimizzazione per dataset di grandi dimensioni
      tension: 0.1,
      yAxisID: `y${index}`,
    }));

    return { labels, datasets, yKeys: yKeys.slice(0, 6) };
  }, [data]);

  const options = useMemo(() => {
    if (!chartData) return {};
    
    const scales = {
      x: {
        type: 'category',
        title: {
          display: true,
          text: 'Chilometrica (Km)',
        },
        ticks: {
          maxTicksLimit: 20
        }
      }
    };

    // Creiamo assi impilati per i vari parametri
    chartData.yKeys.forEach((key, i) => {
      scales[`y${i}`] = {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: key
        },
        grid: {
          drawOnChartArea: i === 0, // Solo la prima asse disegna la griglia
        },
      };
    });

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
        },
        zoom: {
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true
            },
            mode: 'x',
          },
          pan: {
            enabled: true,
            mode: 'x',
          }
        }
      },
      scales
    };
  }, [chartData]);

  if (!data || data.length === 0) {
    return <div className="p-4 text-gray-500">Nessun dato disponibile da visualizzare.</div>;
  }

  return (
    <div style={{ height: '600px', width: '100%' }}>
      <Line data={chartData} options={options} />
    </div>
  );
}
