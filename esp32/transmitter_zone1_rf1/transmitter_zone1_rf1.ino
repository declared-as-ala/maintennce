#include <SPI.h>
#include <LoRa.h>
#include <MFRC522.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

// ====================== CONFIG ======================
#define RF_ID "RF1"
#define ZONE_ID "Z1"

// ====================== PINS ======================
// LoRa
#define LORA_NSS    5
#define LORA_RST    14
#define LORA_DIO0   27

// Buttons
#define BTN1 15
#define BTN2 32
#define BTN3 33
#define BTN4 12

// LEDs
#define LED1 13
#define LED2 26
#define LED3 25
#define LED4 2

// RFID
#define RFID_SS  21
#define RFID_RST 22

MFRC522 rfid(RFID_SS, RFID_RST);

String authorizedUIDs[] = {"5385ef95", "34534fa"};
const int numAuthorized = 2;

// Globals
bool requestPending = false;
unsigned long requestStartTime = 0;
int pendingButton = 0;

// Function prototypes
void Task_Buttons(void *pvParameters);
void Task_RFID(void *pvParameters);
void checkButton(int btnPin, int ledPin, int buttonNum, bool &lastState);
void checkRFIDAuthorization();
bool isAuthorized(String uid);
void resetLEDs();
bool sendLoRaMessage(const String &msg);

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("=== EMETTEUR RF1 - Zone 1 + RFID (FreeRTOS) ===");

  pinMode(BTN1, INPUT_PULLUP);
  pinMode(BTN2, INPUT_PULLUP);
  pinMode(BTN3, INPUT_PULLUP);
  pinMode(BTN4, INPUT_PULLUP);

  pinMode(LED1, OUTPUT); pinMode(LED2, OUTPUT);
  pinMode(LED3, OUTPUT); pinMode(LED4, OUTPUT);
  resetLEDs();

  SPI.begin();
  rfid.PCD_Init();
  Serial.println("[RFID] init OK");

  LoRa.setPins(LORA_NSS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(433E6)) {
    Serial.println("[LoRa][ERR] init failed");
    while (1) { delay(100); }
  }
  LoRa.setSyncWord(0xF3);
  LoRa.setSpreadingFactor(12);
  LoRa.enableCrc();
  Serial.println("[LoRa] ready");

  xTaskCreate(Task_Buttons, "Buttons", 3072, NULL, 1, NULL);
  xTaskCreate(Task_RFID,    "RFID",    4096, NULL, 3, NULL);

  Serial.println("[SYS] ready");
}

void loop() {
  vTaskDelay(pdMS_TO_TICKS(1000));
}

void Task_Buttons(void *pvParameters) {
  bool lastState[4] = {HIGH, HIGH, HIGH, HIGH};

  for (;;) {
    checkButton(BTN1, LED1, 1, lastState[0]);
    checkButton(BTN2, LED2, 2, lastState[1]);
    checkButton(BTN3, LED3, 3, lastState[2]);
    checkButton(BTN4, LED4, 4, lastState[3]);
    vTaskDelay(pdMS_TO_TICKS(25));
  }
}

void Task_RFID(void *pvParameters) {
  for (;;) {
    if (requestPending) {
      checkRFIDAuthorization();
    }
    vTaskDelay(pdMS_TO_TICKS(15));
  }
}

void checkButton(int btnPin, int ledPin, int buttonNum, bool &lastState) {
  bool current = digitalRead(btnPin);
  if (current == LOW && lastState == HIGH) {
    if (!requestPending) {
      requestPending = true;
      pendingButton = buttonNum;
      requestStartTime = millis();
      digitalWrite(ledPin, HIGH);
      Serial.println(String("[REQ] ") + ZONE_ID + " B" + String(buttonNum) + " -> scan badge");
    }
  }
  lastState = current;
}

void checkRFIDAuthorization() {
  if (millis() - requestStartTime > 8000) {
    requestPending = false;
    resetLEDs();
    Serial.println("[REQ] timeout");
    return;
  }

  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uid = "";
    uid.reserve(16);
    for (byte i = 0; i < rfid.uid.size; i++) {
      uid += String(rfid.uid.uidByte[i], HEX);
    }
    uid.toLowerCase();
    Serial.println(String("[RFID] UID: ") + uid);

    if (isAuthorized(uid)) {
      String msg = String("CALL:") + RF_ID + ":" + ZONE_ID + "B" + String(pendingButton);
      if (sendLoRaMessage(msg)) {
        Serial.println(String("[TX] ") + msg);
      } else {
        Serial.println(String("[TX][ERR] ") + msg);
      }
    } else {
      Serial.println("[RFID] unauthorized");
    }

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    delay(80);
    rfid.PCD_Init();

    requestPending = false;
    resetLEDs();
  }
}

bool sendLoRaMessage(const String &msg) {
  LoRa.beginPacket();
  LoRa.print(msg);
  int ok = LoRa.endPacket();
  return ok != 0;
}

bool isAuthorized(String uid) {
  for (int i = 0; i < numAuthorized; i++) {
    String allowed = authorizedUIDs[i];
    allowed.toLowerCase();
    if (uid == allowed) return true;
  }
  return false;
}

void resetLEDs() {
  digitalWrite(LED1, LOW);
  digitalWrite(LED2, LOW);
  digitalWrite(LED3, LOW);
  digitalWrite(LED4, LOW);
}
