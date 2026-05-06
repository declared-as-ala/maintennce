import { ZoneId, AckPayload } from '../types/maintenance';

// --- ESP32 LOCAL HTTP COMMUNICATION ---
// The ESP32 receiver exposes a simple HTTP server on the local WiFi.
// When the phone is on the same network as the ESP32, use these direct endpoints.
//
// ESP32 Firmware should expose:
//   POST /ack       { "zone": "Z1" }
//   POST /ack-all
//   GET  /status    → { zones: { Z1: "OK"|"CALL", ... }, buzzer: bool }
//
// MQTT alternative (see below): ESP32 subscribes to maintenance/ack

let esp32BaseUrl = 'http://192.168.1.100'; // Default, overridden from settings

export function setEsp32BaseUrl(url: string): void {
  esp32BaseUrl = url.replace(/\/$/, '');
}

async function post(path: string, body: object): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const response = await fetch(`${esp32BaseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendAckToEsp32(zoneId: ZoneId): Promise<boolean> {
  const payload: AckPayload = {
    zone: zoneId,
    acknowledgedBy: 'mobile-app',
    timestamp: new Date().toISOString(),
  };

  try {
    // HTTP POST to ESP32
    // Endpoint: POST /ack
    // Body: { "zone": "Z1", "acknowledgedBy": "mobile-app", "timestamp": "..." }
    const response = await post('/ack', payload);
    return response.ok;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[ESP32] Timeout acknowledging zone ${zoneId}`);
    } else {
      console.error(`[ESP32] Failed to ack zone ${zoneId}:`, error);
    }
    return false;
  }
}

export async function sendAckAllToEsp32(): Promise<boolean> {
  const payload: AckPayload = {
    zone: 'ALL',
    acknowledgedBy: 'mobile-app',
    timestamp: new Date().toISOString(),
  };

  try {
    // HTTP POST to ESP32
    // Endpoint: POST /ack-all
    const response = await post('/ack-all', payload);
    return response.ok;
  } catch (error) {
    console.error('[ESP32] Failed to ack all zones:', error);
    return false;
  }
}

export async function getEsp32Status(): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    // GET /status → { zones: { Z1: "OK", Z2: "CALL" }, buzzer: true }
    const response = await fetch(`${esp32BaseUrl}/status`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function pingEsp32(): Promise<boolean> {
  const result = await getEsp32Status();
  return result !== null;
}

// --- MQTT INTEGRATION POINT ---
// When MQTT broker is available, subscribe to:
//   Topic: maintenance/call
//   Payload: { "zone": "Z1", "timestamp": "2026-04-24T10:30:00Z" }
//
// Publish acknowledgements to:
//   Topic: maintenance/ack
//   Payload: { "zone": "Z1", "acknowledgedBy": "mobile-app", "timestamp": "..." }
//
// Recommended library: react-native-mqtt or a WebSocket-based MQTT client
// The ESP32 should subscribe to maintenance/ack to reset LEDs/buzzer.

export const Esp32Service = {
  setEsp32BaseUrl,
  sendAckToEsp32,
  sendAckAllToEsp32,
  getEsp32Status,
  pingEsp32,
};
