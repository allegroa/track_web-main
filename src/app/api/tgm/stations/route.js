import { NextResponse } from 'next/server';
import path from 'path';
import { getStations } from '../../../../../TGM/backend/utils/stationManager.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetPath = searchParams.get('path');

  if (!targetPath) {
    return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
  }

  try {
    const fullPath = path.normalize(targetPath);
    const stations = await getStations(fullPath);
    return NextResponse.json({ stations });
  } catch (error) {
    console.error('API TGM Stations GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
