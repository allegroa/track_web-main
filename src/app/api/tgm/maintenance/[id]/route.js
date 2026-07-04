import { NextResponse } from 'next/server';
import path from 'path';
import { updateMaintenanceRecord, deleteMaintenanceRecord } from '../../../../../../TGM/backend/utils/maintenanceManager.js';

export async function PUT(request, context) {
  // In Next.js 15, `context.params` is a Promise
  const params = await context.params;
  const recordId = params.id;
  
  const { searchParams } = new URL(request.url);
  const targetPath = searchParams.get('path');

  if (!targetPath) {
    return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
  }

  try {
    const record = await request.json();
    const updatedRecord = await updateMaintenanceRecord(path.normalize(targetPath), recordId, record);
    return NextResponse.json({ record: updatedRecord });
  } catch (error) {
    console.error(`API TGM Maintenance PUT error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  // In Next.js 15, `context.params` is a Promise
  const params = await context.params;
  const recordId = params.id;
  
  const { searchParams } = new URL(request.url);
  const targetPath = searchParams.get('path');

  if (!targetPath) {
    return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
  }

  try {
    await deleteMaintenanceRecord(path.normalize(targetPath), recordId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`API TGM Maintenance DELETE error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
