# Maintenance Call — Setup Guide

## 1. Install dependencies

```bash
cd maintenance-call
npm install
```

## 2. Run on Android (development)

```bash
npx expo start --android
```

Or on a physical device:
```bash
npx expo start         # scan QR code with Expo Go
```

> Real push notifications require a physical device + EAS build (see §5).

---

## 3. Project structure

```
maintenance-call/
├── app/
│   ├── _layout.tsx            — Root layout, notification listeners
│   ├── index.tsx              — Redirect to dashboard
│   └── (tabs)/
│       ├── _layout.tsx        — Tab navigator
│       ├── dashboard.tsx      — 4 zone cards, ACK buttons
│       ├── history.tsx        — Call log with filters
│       └── settings.tsx       — Network config + simulation
├── components/
│   ├── ZoneCard.tsx           — Animated pulsing zone card
│   ├── StatusBadge.tsx        — OK / pending badge
│   ├── ConfirmDialog.tsx      — Reusable modal confirmation
│   └── ConnectionStatus.tsx   — Online/offline/local indicator
├── store/
│   └── useMaintenanceStore.ts — Zustand global state
├── services/
│   ├── database.ts            — expo-sqlite CRUD
│   ├── notifications.ts       — Expo push + local alerts
│   ├── esp32.ts               — HTTP POST to ESP32 over LAN
│   ├── api.ts                 — Cloud backend REST calls
│   └── simulator.ts           — Dev simulation (no hardware needed)
├── types/
│   └── maintenance.ts         — All TypeScript types
└── constants/
    ├── zones.ts               — Zone IDs, names, colors
    └── theme.ts               — Dark industrial design tokens
```

---

## 4. Testing without hardware (Simulation mode)

1. Open the app → **Paramètres** tab
2. Enable **Mode simulation**
3. Press **CALL:Z1 / Z2 / Z3 / Z4** buttons
4. Switch to **Tableau de bord** — the card turns red and pulses
5. Tap **Acquitter** to acknowledge the zone
6. Check **Historique** for the logged event

The `SimulatorService` triggers the full `receiveCall()` flow including:
- SQLite insert
- Zustand state update
- Local push notification

---

## 5. EAS Build for real push notifications

Push notifications from FCM require a real build (not Expo Go).

### Setup EAS

```bash
npm install -g eas-cli
eas login
eas build:configure
```

### Build development APK

```bash
eas build --platform android --profile development
```

Install the APK on your device, then run:
```bash
npx expo start --dev-client
```

### Production build

```bash
eas build --platform android --profile production
```

### Required EAS configuration in app.json

Replace `YOUR_EAS_PROJECT_ID` in `app.json`:
```json
"extra": {
  "eas": {
    "projectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
}
```

Get your project ID at: https://expo.dev

---

## 6. ESP32 architecture

```
[Button Zone 1–4]
     │ LoRa RF
     ▼
[ESP32 Transmitter] ──LoRa──► [ESP32 Receiver]
                                    │
                              OLED + LEDs + Buzzer
                                    │ WiFi HTTP POST
                                    ▼
                           [Backend Server]
                                    │
                         Firebase Admin SDK
                                    │ FCM Push
                                    ▼
                           [Expo Mobile App]
                                    │ HTTP POST /ack
                                    ▼
                           [ESP32 Receiver]
                          (reset LED + buzzer)
```

### ESP32 Receiver firmware endpoints

```
GET  /status      → { "zones": { "Z1": "OK", "Z2": "CALL" }, "buzzer": true }
POST /ack         ← { "zone": "Z1", "acknowledgedBy": "mobile-app", "timestamp": "..." }
POST /ack-all     ← { "zone": "ALL", ... }
```

### ESP32 → Backend

When ESP32 receives a LoRa CALL:Zx message, it sends:
```
POST https://your-api.com/api/call
Content-Type: application/json

{
  "zone": "Z1",
  "timestamp": "2026-04-24T10:30:00Z"
}
```

---

## 7. Backend API (Node.js / Firebase Functions example)

```
POST /api/call              ← from ESP32 receiver
POST /api/calls/ack         ← from mobile app
POST /api/calls/ack-all     ← from mobile app
GET  /api/calls/history     → CallEvent[]
POST /api/devices/push-token ← { token, platform }
GET  /api/status
```

### Firebase Function example

```javascript
// On receiving /api/call from ESP32:
const { zone, timestamp } = req.body;

// 1. Save to Firestore
await db.collection('calls').add({ zone, timestamp, status: 'pending' });

// 2. Get registered device tokens
const tokens = await getRegisteredTokens(); // from Firestore

// 3. Send FCM to all devices
await admin.messaging().sendEachForMulticast({
  tokens,
  notification: {
    title: `🚨 APPEL MAINTENANCE — ${zone}`,
    body: `${zone} nécessite une intervention urgente`,
  },
  android: {
    priority: 'high',
    notification: {
      channelId: 'maintenance-alerts',
      color: '#EF4444',
      priority: 'max',
    },
  },
  data: { zoneId: zone, type: 'maintenance_call' },
});
```

---

## 8. MQTT alternative

If using MQTT broker instead of HTTP:

**Subscribe (ESP32 → Broker → App):**
```
Topic:   maintenance/call
Payload: { "zone": "Z1", "timestamp": "2026-04-24T10:30:00Z" }
```

**Publish (App → Broker → ESP32):**
```
Topic:   maintenance/ack
Payload: { "zone": "Z1", "acknowledgedBy": "mobile-app", "timestamp": "..." }
```

Recommended client for React Native: `react-native-paho-mqtt` or WebSocket MQTT.
Wire it in `services/esp32.ts` — the abstraction layer is already in place.

---

## 9. Local ESP32 connection mode

When the phone is on the same WiFi as the ESP32:
- Set the ESP32 IP in Settings → **Adresse IP ESP32**
- Set Connection Mode to **Mode local**
- ACKs are sent directly via HTTP: `POST http://192.168.1.100/ack`
- No backend required

---

## 10. Packages used

| Package | Purpose |
|---|---|
| `expo-router` | File-based navigation |
| `expo-notifications` | Push + local notifications |
| `expo-sqlite` | Local call history database |
| `expo-secure-store` | Encrypted WiFi password storage |
| `@react-native-async-storage/async-storage` | Non-sensitive settings |
| `zustand` | Global state management |
| `expo-haptics` | Tactile feedback |
| `react-native-reanimated` | Smooth animations |
| `expo-linear-gradient` | UI gradients |
| `@expo/vector-icons` | Ionicons |
