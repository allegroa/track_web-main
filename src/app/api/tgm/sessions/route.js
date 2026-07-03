import { NextResponse } from 'next/server';
import path from 'path';
import { getSessions } from '../../../../../TGM/backend/controllers/tgmController.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetPath = searchParams.get('path');

  if (!targetPath) {
    return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
  }

  try {
    const fullPath = path.normalize(targetPath);
    const sessions = await getSessions(fullPath);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('API TGM Sessions GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
