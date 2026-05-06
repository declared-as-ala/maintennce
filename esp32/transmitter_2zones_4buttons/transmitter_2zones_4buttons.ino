#include <SPI.h>
#include <LoRa.h>

// ====================== LoRa pins ======================
#define LORA_NSS   5
#define LORA_RST   14
#define LORA_DIO0  27
#define LORA_FREQUENCY 433E6
#define LORA_SYNC_WORD 0xF3
#define LORA_SF 12

// ====================== Buttons ======================
// Zone 1 buttons (B1..B4)
#define Z1_B1_PIN 32
#define Z1_B2_PIN 33
#define Z1_B3_PIN 25
#define Z1_B4_PIN 26

// Zone 2 buttons (B1..B4)
#define Z2_B1_PIN 4
#define Z2_B2_PIN 12
#define Z2_B3_PIN 13
#define Z2_B4_PIN 15

// Optional onboard LED for TX feedback
#define LED_PIN 2

struct ButtonMap {
  uint8_t pin;
  const char *message;   // Must match receiver/app parser: CALL:ZxBy
  bool lastStateHigh;
  unsigned long lastDebounceMs;
};

ButtonMap buttons[] = {
  {Z1_B1_PIN, "CALL:Z1B1", true, 0},
  {Z1_B2_PIN, "CALL:Z1B2", true, 0},
  {Z1_B3_PIN, "CALL:Z1B3", true, 0},
  {Z1_B4_PIN, "CALL:Z1B4", true, 0},
  {Z2_B1_PIN, "CALL:Z2B1", true, 0},
  {Z2_B2_PIN, "CALL:Z2B2", true, 0},
  {Z2_B3_PIN, "CALL:Z2B3", true, 0},
  {Z2_B4_PIN, "CALL:Z2B4", true, 0},
};

const int BUTTON_COUNT = sizeof(buttons) / sizeof(buttons[0]);
const unsigned long DEBOUNCE_MS = 60;
const unsigned long SEND_GUARD_MS = 80;
unsigned long lastSendMs = 0;
const char *RF_ID = "RF1";  // Change to RF2 on second transmitter

bool sendLoRaMessage(const char *payload) {
  if (millis() - lastSendMs < SEND_GUARD_MS) return false;

  // Final format with transmitter ID:
  // CALL:RF1:Z1B2
  String framed = "CALL:";
  framed += RF_ID;
  framed += ":";
  framed += payload + 5;  // skip "CALL:" from static payload

  LoRa.beginPacket();
  LoRa.print(framed);
  int result = LoRa.endPacket();
  if (result == 0) {
    Serial.print("[TX][ERR] Failed: ");
    Serial.println(framed);
    return false;
  }

  Serial.print("[TX] ");
  Serial.println(framed);
  lastSendMs = millis();

  // Short LED pulse
  digitalWrite(LED_PIN, HIGH);
  delay(60);
  digitalWrite(LED_PIN, LOW);
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("=== ESP32 Transmitter - 2 zones x 4 buttons ===");

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Configure all buttons as INPUT_PULLUP (pressed = LOW)
  for (int i = 0; i < BUTTON_COUNT; i++) {
    pinMode(buttons[i].pin, INPUT_PULLUP);
    buttons[i].lastStateHigh = (digitalRead(buttons[i].pin) == HIGH);
    buttons[i].lastDebounceMs = 0;
  }

  // LoRa init
  LoRa.setPins(LORA_NSS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(LORA_FREQUENCY)) {
    Serial.println("[LoRa][ERR] init failed");
    while (1) {
      delay(100);
    }
  }

  LoRa.setSyncWord(LORA_SYNC_WORD);
  LoRa.setSpreadingFactor(LORA_SF);
  LoRa.enableCrc();
  Serial.println("[LoRa] ready");
}

void loop() {
  const unsigned long now = millis();

  for (int i = 0; i < BUTTON_COUNT; i++) {
    // INPUT_PULLUP -> pressed means LOW
    bool isHigh = (digitalRead(buttons[i].pin) == HIGH);

    // Detect edge: HIGH -> LOW (button press)
    if (buttons[i].lastStateHigh && !isHigh) {
      if (now - buttons[i].lastDebounceMs >= DEBOUNCE_MS) {
        sendLoRaMessage(buttons[i].message);
        buttons[i].lastDebounceMs = now;
      }
    }

    buttons[i].lastStateHigh = isHigh;
  }

  delay(10);
}

