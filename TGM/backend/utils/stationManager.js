import fs from 'fs/promises';
import path from 'path';

/**
 * Returns the path to the station.json file.
 */
function getStationFilePath(basePath) {
  return path.join(basePath, 'station.json');
}

/**
 * Retrieves the list of stations from the database.
 */
export async function getStations(basePath) {
  const filePath = getStationFilePath(basePath);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const stations = JSON.parse(content);
    return Array.isArray(stations) ? stations : [];
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    console.warn('Error reading station.json:', err);
    return [];
  }
}

/**
 * Adds a new station to the database if it doesn't already exist.
 * The station name must be valid (not empty).
 */
export async function addStation(basePath, stationName) {
  if (!stationName || typeof stationName !== 'string') return;
  const sName = stationName.trim();
  if (!sName || sName === '-') return;

  const filePath = getStationFilePath(basePath);
  
  let stations = await getStations(basePath);
  
  if (!stations.includes(sName)) {
    stations.push(sName);
    stations.sort((a, b) => a.localeCompare(b)); // Keep it sorted alphabetically
    try {
      await fs.writeFile(filePath, JSON.stringify(stations, null, 2), 'utf-8');
    } catch (writeErr) {
      console.error('Error writing to station.json:', writeErr);
    }
  }
}
