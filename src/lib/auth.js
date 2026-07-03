'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'webone_token';

/** Resolve JWT from ?token= query (WebOne handoff) or session storage. */
export function useAuthToken() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState(null);

  useEffect(() => {
    const fromQuery = searchParams.get('token');
    if (fromQuery) {
      sessionStorage.setItem(STORAGE_KEY, fromQuery);
      setToken(fromQuery);
      return;
    }
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) setToken(stored);
  }, [searchParams]);

  return token;
}

export function buildVisualizerUrl({ baseUrl, folder, file, token }) {
  const url = new URL(baseUrl.replace(/\/$/, '') + '/');
  if (folder) url.searchParams.set('folder', folder);
  if (file) url.searchParams.set('file', file);
  if (token) url.searchParams.set('token', token);
  return url.toString();
}
