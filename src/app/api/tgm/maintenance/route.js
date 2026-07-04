import { NextResponse } from 'next/server';
import path from 'path';
import { getMaintenanceRecords, addMaintenanceRecord } from '../../../../../TGM/backend/utils/maintenanceManager.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetPath = searchParams.get('path');

  if (!targetPath) {
    return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
  }

  try {
    const records = await getMaintenanceRecords(path.normalize(targetPath));
    return NextResponse.json({ records });
  } catch (error) {
    console.error(`API TGM Maintenance GET error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const targetPath = searchParams.get('path');

  if (!targetPath) {
    return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
  }

  try {
    const record = await request.json();
    const newRecord = await addMaintenanceRecord(path.normalize(targetPath), record);
    return NextResponse.json({ record: newRecord });
  } catch (error) {
    console.error(`API TGM Maintenance POST error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
