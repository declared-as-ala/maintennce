import { ZoneId, CallEvent, AckPayload } from '../types/maintenance';

// --- BACKEND API SERVICE ---
// Abstraction layer for communicating with the cloud backend.
// Replace BASE_URL with your actual backend URL in settings.
//
// Backend endpoints expected:
//   POST   /api/calls/ack          { zone: "Z1" }
//   POST   /api/calls/ack-all
//   GET    /api/calls/history      → CallEvent[]
//   POST   /api/devices/push-token { token, platform }
//   GET    /api/status             → { zones, timestamp }
//
// The backend should:
// 1. Receive HTTP from ESP32: POST /api/call { zone: "Z1", timestamp: "..." }
// 2. Store the call in its DB
// 3. Send FCM push notification via Firebase Admin SDK to all registered devices
// 4. Expose REST API for mobile to ACK and fetch history

let backendBaseUrl = '';

export function setBackendBaseUrl(url: string): void {
  backendBaseUrl = url.replace(/\/$/, '');
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
  if (!backendBaseUrl) {
    return { data: null, error: 'Backend URL not configured' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${backendBaseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        // Add Authorization header here when auth is implemented
        // 'Authorization': `Bearer ${token}`,
      },
      signal: controller.signal,
      ...options,
    });

    if (!response.ok) {
      return { data: null, error: `HTTP ${response.status}` };
    }

    const data = await response.json() as T;
    return { data, error: null };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { data: null, error: 'Timeout' };
    }
    return { data: null, error: String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function acknowledgeZoneOnBackend(zoneId: ZoneId): Promise<boolean> {
  const payload: AckPayload = {
    zone: zoneId,
    acknowledgedBy: 'mobile-app',
    timestamp: new Date().toISOString(),
  };

  const { error } = await apiFetch('/api/calls/ack', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return error === null;
}

export async function acknowledgeAllOnBackend(): Promise<boolean> {
  const payload: AckPayload = {
    zone: 'ALL',
    acknowledgedBy: 'mobile-app',
    timestamp: new Date().toISOString(),
  };

  const { error } = await apiFetch('/api/calls/ack-all', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return error === null;
}

export async function fetchHistoryFromBackend(): Promise<CallEvent[]> {
  const { data } = await apiFetch<CallEvent[]>('/api/calls/history');
  return data ?? [];
}

export async function registerPushToken(
  token: string,
  platform: string
): Promise<boolean> {
  // Register device push token with backend so it can send FCM notifications.
  // Backend uses Firebase Admin SDK to forward FCM notifications.
  const { error } = await apiFetch('/api/devices/push-token', {
    method: 'POST',
    body: JSON.stringify({ token, platform }),
  });
  return error === null;
}

export async function checkBackendHealth(): Promise<boolean> {
  const { error } = await apiFetch('/api/status');
  return error === null;
}

export const ApiService = {
  setBackendBaseUrl,
  acknowledgeZoneOnBackend,
  acknowledgeAllOnBackend,
  fetchHistoryFromBackend,
  registerPushToken,
  checkBackendHealth,
};
