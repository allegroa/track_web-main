import { NextResponse } from 'next/server';
import path from 'path';
import { getSessionData } from '../../../../../../../TGM/backend/controllers/tgmController.js';

export async function GET(request, context) {
  // In Next.js 15, `context.params` is a Promise
  const params = await context.params;
  const sessionId = params.id;
  
  const { searchParams } = new URL(request.url);
  const targetPath = searchParams.get('path');

  if (!targetPath) {
    return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
  }

  try {
    const fullPath = path.normalize(targetPath);
    const data = await getSessionData(fullPath, sessionId);
    return NextResponse.json({ data });
  } catch (error) {
    console.error(`API TGM Session Data GET error for ${sessionId}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
