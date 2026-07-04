import fs from 'fs/promises';
import path from 'path';

const getMaintenanceFilePath = (basePath) => {
  return path.join(basePath, 'maintenance.json');
};

/**
 * Assicura che il file maintenance.json esista, altrimenti lo crea con un array vuoto
 */
async function ensureMaintenanceFile(filePath) {
  try {
    await fs.access(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(filePath, '[]', 'utf-8');
    } else {
      throw err;
    }
  }
}

/**
 * Recupera tutti gli interventi di manutenzione
 */
export async function getMaintenanceRecords(basePath) {
  const filePath = getMaintenanceFilePath(basePath);
  await ensureMaintenanceFile(filePath);
  const data = await fs.readFile(filePath, 'utf-8');
  try {
    return JSON.parse(data);
  } catch (err) {
    console.error('Errore nel parsing di maintenance.json:', err);
    return [];
  }
}

/**
 * Aggiunge un nuovo intervento di manutenzione
 */
export async function addMaintenanceRecord(basePath, record) {
  const filePath = getMaintenanceFilePath(basePath);
  const records = await getMaintenanceRecords(basePath);
  
  const newRecord = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    createdAt: new Date().toISOString(),
    ...record
  };
  
  records.push(newRecord);
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
  return newRecord;
}

/**
 * Aggiorna un intervento esistente
 */
export async function updateMaintenanceRecord(basePath, id, updatedFields) {
  const filePath = getMaintenanceFilePath(basePath);
  const records = await getMaintenanceRecords(basePath);
  
  const index = records.findIndex(r => r.id === id);
  if (index === -1) {
    throw new Error('Record di manutenzione non trovato');
  }
  
  records[index] = {
    ...records[index],
    ...updatedFields,
    updatedAt: new Date().toISOString()
  };
  
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
  return records[index];
}

/**
 * Elimina un intervento
 */
export async function deleteMaintenanceRecord(basePath, id) {
  const filePath = getMaintenanceFilePath(basePath);
  let records = await getMaintenanceRecords(basePath);
  
  const initialLength = records.length;
  records = records.filter(r => r.id !== id);
  
  if (records.length === initialLength) {
    throw new Error('Record di manutenzione non trovato');
  }
  
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
  return true;
}
