# Maintenance Call

Maintenance Call is a hybrid industrial alert system composed of:

- an `Expo` / `React Native` mobile app (`maintenance-call`)
- `ESP32` LoRa firmware (transmitters + receiver)
- an optional backend API for cloud sync and push notifications

The system monitors machine fault calls (`Z1`, `Z2`) with 4 fault buttons per machine (`B1`..`B4`), then lets operators acknowledge calls from mobile.

---

## 1) What This Project Does

- Receives maintenance calls from hardware buttons via LoRa (`CALL:RFx:ZxBy`)
- Displays active calls in a mobile dashboard
- Stores full local history in SQLite
- Sends local notifications (always) and push notifications (when backend + device build are configured)
- Sends ACK back to ESP32 and/or backend based on connection mode
- Supports full simulation mode (no hardware required)

---

## 2) High-Level Architecture

```text
[ESP32 Transmitter(s)]
  Buttons + RFID auth
          |
          | LoRa (433MHz)
          v
[ESP32 Receiver]
  LoRa RX + OLED + buzzer + HTTP server (/status, /ack, /ack-all)
          |
          | local LAN HTTP
          v
[Expo Mobile App]
  Dashboard / History / Settings
  Zustand + SQLite + Notifications
          |
          | optional cloud HTTP
          v
[Backend API]
  /api/call, /api/calls/ack, /api/calls/history, token registration
          |
          v
[FCM / Expo Push route]
```

---

## 3) Runtime Data Flow

### A) Call created on hardware

1. Operator presses a machine fault button on transmitter (`B1`..`B4`).
2. (RFID variants) badge authorization validates operator.
3. Transmitter sends LoRa payload like:
   - `CALL:RF1:Z1B2`
4. Receiver parses payload, marks zone/button active, updates OLED, beeps buzzer.
5. Mobile app polls receiver `/status` every ~3s and triggers local `receiveCall(...)` when it detects `OK -> CALL`.
6. Store writes event to SQLite and updates UI state.
7. App shows local notification if enabled.

### B) Call acknowledged from app

1. User taps `Acquitter` on zone or `Acquitter tout`.
2. Store updates SQLite + in-memory zone/history immediately (optimistic local success).
3. Depending on settings:
   - send ACK to ESP32 (`POST /ack` or `POST /ack-all`)
   - send ACK to backend (`POST /api/calls/ack` or `/api/calls/ack-all`)
4. Receiver clears active calls and updates OLED status.

---

## 4) Repository Structure (AI-Agent View)

```text
maintenance-call/
├── app/                           # Expo Router screens
│   ├── _layout.tsx                # App bootstrap + notification listeners + splash
│   ├── index.tsx                  # Redirects to dashboard
│   ├── +not-found.tsx
│   └── (tabs)/
│       ├── _layout.tsx            # Bottom tabs, badge with active call count
│       ├── dashboard.tsx          # Live machine status + ACK actions + ESP32 sync
│       ├── history.tsx            # Filterable event log from store/SQLite
│       └── settings.tsx           # Network/settings/simulation controls
│
├── components/                    # Reusable UI blocks
│   ├── ZoneCard.tsx               # Machine card with CALL/OK visual state
│   ├── StatusBadge.tsx            # Pending/Acknowledged badges
│   ├── ConfirmDialog.tsx          # Confirmation modal (ack-all, clear, etc.)
│   └── ConnectionStatus.tsx       # online/offline/local/connecting indicator
│
├── constants/
│   ├── zones.ts                   # Domain constants: zones, buttons, panne labels
│   └── theme.ts                   # Color/spacing/radius tokens
│
├── services/                      # IO boundaries and integration adapters
│   ├── database.ts                # SQLite schema + CRUD + acknowledgements
│   ├── notifications.ts           # Local + push notification integration
│   ├── esp32.ts                   # Local receiver HTTP client
│   ├── api.ts                     # Optional backend REST client
│   └── simulator.ts               # Simulation + LoRa message parser
│
├── store/
│   └── useMaintenanceStore.ts     # Zustand state machine and orchestration
│
├── types/
│   └── maintenance.ts             # Core domain types
│
├── esp32/                         # Arduino sketches
│   ├── receiver_8zones/receiver_8zones.ino
│   ├── transmitter_zone1_rf1/transmitter_zone1_rf1.ino
│   ├── transmitter_zone2_rf2/transmitter_zone2_rf2.ino
│   └── transmitter_2zones_4buttons/transmitter_2zones_4buttons.ino
│
├── SETUP.md                       # Practical setup + build notes
├── ESP32_EXPO_RUN.md              # Combined hardware/app run guide
└── package.json
```

---

## 5) Service Layer Contract

Think of services as edge adapters, and the store as orchestration core.

### `services/database.ts`

- Owns SQLite DB `maintenance_call.db`
- Initializes `calls` table and indexes
- Handles migration for old DBs (adds `button`, `panne_label`)
- Exposes:
  - `insertCall`
  - `acknowledgeZoneCalls`
  - `acknowledgeAllCalls`
  - `getAllCalls`, `getPendingCalls`, `clearAllHistory`, etc.

### `services/notifications.ts`

- Configures notification channel (`maintenance-alerts`)
- Supports local notifications in Expo Go and device builds
- Push token registration only in dev/prod builds (not Expo Go)
- Exposes listeners for foreground and response-tap behavior

### `services/esp32.ts`

- Local network client for receiver HTTP server
- Endpoints expected on ESP32:
  - `GET /status`
  - `POST /ack`
  - `POST /ack-all`
- Includes timeout protections and graceful failure behavior

### `services/api.ts`

- Optional backend integration
- Endpoint set expected:
  - `POST /api/calls/ack`
  - `POST /api/calls/ack-all`
  - `GET /api/calls/history`
  - `POST /api/devices/push-token`
  - `GET /api/status`
- Used when `backendApiUrl` is configured and mode allows cloud path

### `services/simulator.ts`

- Simulates calls without hardware
- Generates specific or random calls
- Contains LoRa parser for strings like `CALL:Z1B2`

---

## 6) State Management Model (`store/useMaintenanceStore.ts`)

Single global store with these responsibilities:

1. Initialization
   - Load settings from AsyncStorage
   - Configure service base URLs
   - Load history from SQLite
   - Rebuild active zone state from pending DB rows
   - Register notification + simulation pathways

2. Receive call (`receiveCall`)
   - Build `CallEvent`
   - Persist to SQLite
   - Update zone status to `CALL`
   - Prepend history in memory
   - Trigger local notification

3. Acknowledge call (`acknowledgeZone` / `acknowledgeAll`)
   - Persist ACK in SQLite
   - Set zones back to `OK`
   - Compute duration
   - Attempt hardware/backend ACK delivery based on mode

4. Settings + security
   - General settings in AsyncStorage
   - WiFi password in SecureStore
   - Runtime propagation to service adapters

---

## 7) Domain Model

Core types live in `types/maintenance.ts`:

- `ZoneId`: `Z1 | Z2`
- `ButtonId`: `B1 | B2 | B3 | B4`
- `ZoneStatus`: `OK | CALL | PENDING_ACK`
- `ConnectionMode`: `auto | local | cloud`
- `CallEvent`: normalized historical event model
- `AppSettings`: connection, simulation, push, and device settings
- `AckPayload`: `{ zone, acknowledgedBy, timestamp }`

---

## 8) Mobile App Screens

### Dashboard (`app/(tabs)/dashboard.tsx`)

- Polls ESP32 `/status` periodically
- Converts receiver status to store calls on edge transitions
- Displays active alert banner + per-zone cards
- Supports zone ACK and global ACK-all
- Shows connection badge and notification state

### History (`app/(tabs)/history.tsx`)

- Reads event history from store/SQLite
- Supports filtering by zone and status
- Shows source (`SIM`, `ESP32`, etc.), timestamps, and durations
- Supports full history clear

### Settings (`app/(tabs)/settings.tsx`)

- Local network config (SSID, ESP32 IP)
- Backend and MQTT URL fields
- Toggle simulation mode and notification behavior
- Manual connection test to ESP32 (`pingEsp32`)
- Simulation controls (`CALL:ZxBy`)

---

## 9) ESP32 Firmware Breakdown

## Receiver: `esp32/receiver_8zones/receiver_8zones.ino`

Responsibilities:

- LoRa receive and parse:
  - accepts `CALL:RFx:ZxBy` and legacy `CALL:ZxBy`
- Maintains active-call matrix for zone/button pairs
- Controls OLED display and buzzer feedback
- Runs local HTTP server:
  - `GET /status`: returns zone call state and active buttons
  - `POST /ack`: clears one zone
  - `POST /ack-all`: clears all zones

Important configuration:

- fill `WIFI_SSID` / `WIFI_PASSWORD`
- LoRa params must match transmitter (`433E6`, sync word, spreading factor)

## Transmitters

### `transmitter_zone1_rf1.ino` and `transmitter_zone2_rf2.ino`

- FreeRTOS-based button + RFID authorization workflow
- Press button -> wait for valid RFID badge -> send LoRa call
- Message format includes sender identity:
  - `CALL:RF1:Z1B2` or `CALL:RF2:Z2B3`

### `transmitter_2zones_4buttons.ino`

- Single board with 8 buttons across 2 zones
- Sends direct LoRa calls on button edge
- Also frames messages with `RF_ID`

---

## 10) Configuration and Operating Modes

Configured in app settings:

- `connectionMode: auto | local | cloud`
  - `local`: prioritize direct ESP32 ACK path
  - `cloud`: skip local ESP32 ACK path
  - `auto`: can attempt both depending on configured URLs
- `simulationMode: true|false`
  - true: test flows without hardware
  - false: real hardware sync

Key fields:

- `esp32IpAddress` -> used by `Esp32Service`
- `backendApiUrl` -> used by `ApiService`
- `mqttBrokerUrl` -> reserved for future MQTT path

---

## 11) Backend Expectations (Optional but Recommended)

This repository does not include backend code, but mobile service contracts assume:

- Ingest calls coming from receiver bridge:
  - `POST /api/call`
- Persist and expose history
- Forward high-priority notifications to registered devices
- Accept ACK events from app and propagate to system state

Recommended minimal endpoints:

- `POST /api/call`
- `POST /api/calls/ack`
- `POST /api/calls/ack-all`
- `GET /api/calls/history`
- `POST /api/devices/push-token`
- `GET /api/status`

---

## 12) Local Development

Install and run:

```bash
npm install
npx expo start --android
```

For no-hardware testing:

1. Open `Paramètres`
2. Enable simulation mode
3. Trigger call buttons (`CALL:Z1B1`, etc.)
4. Validate dashboard changes and history logs

---

## 13) Build and Push Notification Notes

- Real remote push requires device build (`EAS`) and proper `projectId`
- Expo Go supports local notifications but not full remote push token path
- Configure `app.json -> extra.eas.projectId` before production push rollout

---

## 14) AI-Agent Onboarding Checklist

If another AI agent continues this project, it should verify in this order:

1. **Store orchestration**
   - Inspect `store/useMaintenanceStore.ts` first (core behavior is here).
2. **Hardware contracts**
   - Confirm receiver endpoints and LoRa formats in `esp32/receiver_8zones/receiver_8zones.ino`.
3. **Service boundaries**
   - Keep side effects in `services/*`, not inside screen components.
4. **State schema**
   - Reuse `types/maintenance.ts` for any new features.
5. **Persistence safety**
   - Any event model change must include SQLite migration logic.
6. **Mode correctness**
   - Ensure `connectionMode` behavior stays consistent when adding cloud/MQTT features.

---

## 15) Known Gaps / Extension Points

- MQTT path is scaffolded but not implemented end-to-end in app runtime
- Backend integration is contract-based (adapter exists; server implementation external)
- No automated test suite in this repository yet
- Current domain constants define 2 zones, while some UI/theme comments still mention 4-zone language

---

## 16) Quick File Index

- Entry and routing: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`
- Core logic: `store/useMaintenanceStore.ts`
- Data model: `types/maintenance.ts`
- Zone config: `constants/zones.ts`
- Local DB: `services/database.ts`
- Local ESP32 API client: `services/esp32.ts`
- Cloud API client: `services/api.ts`
- Notifications: `services/notifications.ts`
- Simulation: `services/simulator.ts`
- Receiver firmware: `esp32/receiver_8zones/receiver_8zones.ino`
- Transmitters: `esp32/transmitter_zone1_rf1/transmitter_zone1_rf1.ino`, `esp32/transmitter_zone2_rf2/transmitter_zone2_rf2.ino`, `esp32/transmitter_2zones_4buttons/transmitter_2zones_4buttons.ino`

