function formatRailwayKm(metersValue) {
  const num = Number(metersValue);
  if (isNaN(num)) return String(metersValue);
  const isNeg = num < 0;
  const absNum = Math.abs(num);
  const km = Math.floor(absNum / 1000);
  const meters = Math.round(absNum % 1000);
  return (isNeg ? '-' : '') + km + '+' + meters.toString().padStart(3, '0');
}

export async function parseGeoBuffer(arrayBuffer, requestedSampleSize, storeFull) {
  const HEADER_SIZE = 2480;
  const PACKET_SIZE = 152;
  
  if (arrayBuffer.byteLength < HEADER_SIZE) {
    throw new Error("File .geo troppo piccolo (header mancante)");
  }

  const decoder = new TextDecoder('windows-1252');
  const szOriginalName = decoder.decode(new Uint8Array(arrayBuffer, 32, 256)).replace(/\0/g, '');
  const szComment = decoder.decode(new Uint8Array(arrayBuffer, 320, 256)).replace(/\0/g, '');
  const szLine = decoder.decode(new Uint8Array(arrayBuffer, 832, 256)).replace(/\0/g, '');

  const headerView = new DataView(arrayBuffer);
  const isMetricDecreasing = headerView.getInt32(292, true) !== 0;
  const initialPosition = headerView.getInt32(300, true);

  const metadataLines = [
    `Nome Originale;${szOriginalName}`,
    `Commento;${szComment}`,
    `Linea;${szLine}`,
    `Km Iniziale;${formatRailwayKm(initialPosition)}`
  ];
  const infoPairs = [
    { key: "Nome Originale", value: szOriginalName },
    { key: "Commento", value: szComment },
    { key: "Linea", value: szLine },
    { key: "Km Iniziale", value: formatRailwayKm(initialPosition) }
  ];

  const dataLen = arrayBuffer.byteLength - HEADER_SIZE;
  const totalDataRows = Math.floor(dataLen / PACKET_SIZE);

  const useSampling = !storeFull;
  const ss = storeFull ? Infinity : (requestedSampleSize || 5000);

  let step = 1;
  if (useSampling && ss < totalDataRows) {
    step = totalDataRows / ss;
  }

  const data = [];
  const hdrs = [
    "km", "speed", 
    "Sopraelevazione", "Scartamento", "Twist Corto", "Twist Lungo", 
    "Allineamento Sinistro", "Allineamento Destro", "Livello Longitudinale Sinistro", "Livello Longitudinale Destro",
    "TopSxD1", "TopDxD1", "Sopraelevazione Mediata", "AlignSxD1", "AlignDxD1", "AlignSxD2", "AlignDxD2", "TopSxD2", "TopDxD2",
    "Sopraelevazione Quasi Statica", "Twist Medio", "Curvatura Laterale", "Curvatura Verticale",
    "MovAvAlignSx", "MovAvAlignDx", "MovAvTopSx", "MovAvTopDx", "MovAvGauge", "MovAvCant",
    "Latitudine", "Longitudine", "Altezza", "Satelliti"
  ];

  let currentFloatIndex = 0;
  
  for (let i = 0; i < totalDataRows; i++) {
    if (useSampling && ss < totalDataRows) {
      if (i < Math.floor(currentFloatIndex)) {
        continue;
      }
      currentFloatIndex += step;
    }
    
    const offset = HEADER_SIZE + i * PACKET_SIZE;
    const view = new DataView(arrayBuffer, offset, PACKET_SIZE);
    const row = {};
    
    // offset 0: pos, offset 4: trackpos
    const trackpos = view.getFloat32(4, true); 
    if (isMetricDecreasing) {
      row["km"] = initialPosition - trackpos;
    } else {
      row["km"] = initialPosition + trackpos;
    }
    row["speed"] = view.getFloat32(8, true);
    
    for (let g = 0; g < 27; g++) {
      row[hdrs[g + 2]] = view.getFloat32(12 + g * 4, true);
    }
    
    row["Latitudine"] = view.getFloat64(120, true);
    row["Longitudine"] = view.getFloat64(128, true);
    row["Altezza"] = view.getFloat64(136, true);
    row["Satelliti"] = view.getInt32(144, true);

    data.push(row);
  }

  return { data, hdrs, infoPairs, metadataLines, totalDataRows };
}
