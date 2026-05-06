# Run Expo + ESP32 Together

This project now supports 2 machines (`Z1`, `Z2`) with 4 panne buttons each (`B1`..`B4`).

## 1) Flash the ESP32 receiver code

Use:

- `esp32/receiver_8zones/receiver_8zones.ino`

In Arduino IDE:

1. Select your ESP32 board and COM port.
2. Install required libraries:
   - `LoRa` (Sandeep Mistry)
   - `Adafruit GFX Library`
   - `Adafruit SSD1306`
3. Upload the sketch.
4. Open Serial Monitor (115200) and verify you see `LoRa OK`.

## 2) Run the Expo app

From project root:

```bash
npm install
npx expo start --android
```

## 3) App settings for real hardware

Open the app and go to `Paramètres`:

- Turn **Simulation mode** OFF
- Set **Adresse IP ESP32** if your ESP32 exposes HTTP status/ack endpoints
- Keep connection mode on `auto` (or use `local` if only ESP32 local network is used)

## 4) Important integration note

Your current ESP32 receiver sketch is LoRa + OLED + buzzer only.
It does **not** expose HTTP endpoints (`/status`, `/ack`, `/ack-all`) yet.

So for full app-to-ESP32 ACK sync, add a WiFi + WebServer layer in ESP32 firmware.

Without that, the Expo app UI/history still works, but direct ACK calls to ESP32 will fail.

## 5) Test flow

1. Trigger LoRa packet like `CALL:Z1B2`.
2. ESP32 receiver prints `Received: CALL:Z1B2`.
3. In mobile app:
   - use simulation for end-to-end app test, or
   - connect backend/API bridge that forwards calls to app.
4. Acknowledge from dashboard and verify history updates.
