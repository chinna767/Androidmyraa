import { Capacitor } from '@capacitor/core';

const WEB_BACKEND = '';

const ANDROID_BACKEND = 'https://androidmyraa.onrender.com';

export const BACKEND_URL =
  Capacitor.isNativePlatform()
    ? ANDROID_BACKEND
    : WEB_BACKEND;

export function apiUrl(path: string): string {
  if (!path.startsWith('/')) path = `/${path}`;

  return BACKEND_URL
    ? `${BACKEND_URL}${path}`
    : path;
}

export function liveWebSocketUrl(): string {
  if (BACKEND_URL) {
    return BACKEND_URL
      .replace(/^https:/, 'wss:')
      .replace(/^http:/, 'ws:') + '/api/live';
  }

  const protocol =
    window.location.protocol === 'https:' ? 'wss:' : 'ws:';

  return `${protocol}//${window.location.host}/api/live`;
}
