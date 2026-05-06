#include <SPI.h>
#include <LoRa.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ====================== PINS ======================
#define LORA_NSS    5
#define LORA_RST    14
#define LORA_DIO0   27
#define LORA_FREQUENCY 433E6
#define LORA_SYNC_WORD 0xF3
#define LORA_SF 12

#define OLED_MOSI   25
#define OLED_CLK    26
#define OLED_DC     2
#define OLED_CS     17
#define OLED_RESET  4

#define BUZZER_PIN  12
#define ACK_BUTTON  16

// ====================== WiFi ======================
// Fill with your local WiFi used by phone + ESP32
const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
WebServer server(80);

// ====================== OLED ======================
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, OLED_MOSI, OLED_CLK, OLED_DC, OLED_RESET, OLED_CS);

// ====================== Variables ======================
// 2 machines (Z1, Z2) x 4 panne buttons (B1..B4)
bool callActive[3][5] = {false};
int callCount[3][5] = {0};

String currentStatus = "System ready - waiting";
String lastRfId = "RF?";

void showWaitingScreen();
void resetAllZones();
void updateOLED();
void handleNewCall(const String &rfId, int zoneNum, int btnNum);
bool parseCallMessage(const String &message, String &rfId, int &zoneNum, int &btnNum);
void setupWifiAndHttp();
void handleHttpStatus();
void handleHttpAck();
void handleHttpAckAll();
void handleHttpNotFound();
bool extractZoneFromJson(const String &body, int &zoneNum);
bool extractFieldValue(const String &body, const String &key, String &value);
int firstActiveButtonForZone(int zoneNum);

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("=== Receiver - 2 machines x 4 pannes ===");

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(ACK_BUTTON, INPUT_PULLUP);

  // LoRa
  LoRa.setPins(LORA_NSS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(LORA_FREQUENCY)) {
    Serial.println("[LoRa][ERR] init failed");
    while (1) {
    }
  }
  LoRa.setSyncWord(LORA_SYNC_WORD);
  LoRa.setSpreadingFactor(LORA_SF);
  LoRa.enableCrc();
  Serial.println("[LoRa] ready");

  // OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC)) {
    Serial.println("OLED error");
    while (1) {
    }
  }
  showWaitingScreen();
  setupWifiAndHttp();
}

void loop() {
  server.handleClient();

  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String received = "";
    while (LoRa.available()) {
      received += (char)LoRa.read();
    }
    received.trim();

    Serial.print("[RX] ");
    Serial.println(received);
    String rfId = "";
    int zoneNum = 0;
    int btnNum = 0;
    if (parseCallMessage(received, rfId, zoneNum, btnNum)) {
      handleNewCall(rfId, zoneNum, btnNum);
    } else {
      Serial.println("[RX][WARN] Invalid format. Expected CALL:RFx:ZxBy or CALL:ZxBy");
    }
  }

  if (digitalRead(ACK_BUTTON) == LOW) {
    resetAllZones();
    delay(300);
  }

  delay(20);
}

// ====================== Alarm handling ======================
void handleNewCall(const String &rfId, int zoneNum, int btnNum) {
  callActive[zoneNum][btnNum] = true;
  callCount[zoneNum][btnNum]++;
  lastRfId = rfId;

  currentStatus = rfId + " Z" + String(zoneNum) + "B" + String(btnNum) + " active!";

  tone(BUZZER_PIN, 1400, 500);
  updateOLED();
}

void updateOLED() {
  display.clearDisplay();

  // Header
  display.fillRect(0, 0, 128, 15, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK);
  display.setTextSize(1);
  display.setCursor(15, 4);
  display.println("MAINTENANCE");

  // Status text
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(5, 20);
  display.println(currentStatus);

  // Render 2 machines x 4 pannes
  for (int machine = 1; machine <= 2; machine++) {
    for (int btn = 1; btn <= 4; btn++) {
      int idx = (machine - 1) * 4 + btn;  // 1..8 for grid placement only
      int y = 32 + ((idx - 1) / 2) * 10;
      int x = ((idx - 1) % 2 == 0) ? 4 : 68;

      if (callActive[machine][btn]) {
        display.fillRect(x, y, 60, 9, SSD1306_WHITE);
        display.setTextColor(SSD1306_BLACK);
        display.setCursor(x + 2, y + 2);
        display.print("Z");
        display.print(machine);
        display.print("B");
        display.print(btn);
        display.print("(");
        display.print(callCount[machine][btn]);
        display.print(")");
      } else {
        display.setTextColor(SSD1306_WHITE);
        display.setCursor(x + 6, y + 2);
        display.print("Z");
        display.print(machine);
        display.print("B");
        display.print(btn);
      }
    }
  }
  display.display();
}

void showWaitingScreen() {
  currentStatus = "System ready - waiting";
  updateOLED();
}

void resetAllZones() {
  for (int machine = 1; machine <= 2; machine++) {
    for (int btn = 1; btn <= 4; btn++) {
      callActive[machine][btn] = false;
    }
  }
  currentStatus = "All calls acknowledged";
  showWaitingScreen();
}

bool parseCallMessage(const String &message, String &rfId, int &zoneNum, int &btnNum) {
  // Supported formats:
  // 1) CALL:RF1:Z1B2
  // 2) CALL:Z1B2 (legacy)
  if (!message.startsWith("CALL:")) return false;

  int zoneIndex = message.indexOf(":Z");
  if (zoneIndex == -1) {
    // legacy path: "CALL:Z1B2"
    zoneIndex = 4;
  }

  String zonePart = message.substring(zoneIndex + 1);  // "Z1B2"
  if (zonePart.length() != 4) return false;
  if (zonePart.charAt(0) != 'Z' || zonePart.charAt(2) != 'B') return false;

  char zoneChar = zonePart.charAt(1);
  char btnChar = zonePart.charAt(3);
  if (zoneChar < '1' || zoneChar > '2') return false;
  if (btnChar < '1' || btnChar > '4') return false;

  zoneNum = zoneChar - '0';
  btnNum = btnChar - '0';

  if (zoneIndex > 4) {
    rfId = message.substring(5, zoneIndex);  // between "CALL:" and ":Z"
    if (rfId.length() == 0) rfId = "RF?";
  } else {
    rfId = "RF?";
  }

  return true;
}

void setupWifiAndHttp() {
  if (String(WIFI_SSID) == "YOUR_WIFI_SSID") {
    Serial.println("[WiFi][WARN] SSID not configured. HTTP API disabled.");
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[WiFi] connecting");
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 30) {
    delay(500);
    Serial.print(".");
    retries++;
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi][ERR] connect failed. HTTP API disabled.");
    return;
  }

  Serial.print("[WiFi] connected. IP: ");
  Serial.println(WiFi.localIP());

  server.on("/status", HTTP_GET, handleHttpStatus);
  server.on("/ack", HTTP_POST, handleHttpAck);
  server.on("/ack-all", HTTP_POST, handleHttpAckAll);
  server.onNotFound(handleHttpNotFound);
  server.begin();
  Serial.println("[HTTP] server started on port 80");
}

void handleHttpStatus() {
  int z1Btn = firstActiveButtonForZone(1);
  int z2Btn = firstActiveButtonForZone(2);

  String json = "{";
  json += "\"zones\":{";
  json += "\"Z1\":\"";
  json += (z1Btn > 0) ? "CALL" : "OK";
  json += "\",";
  json += "\"Z2\":\"";
  json += (z2Btn > 0) ? "CALL" : "OK";
  json += "\"},";
  json += "\"activeButtons\":{";
  json += "\"Z1\":\"";
  json += (z1Btn > 0) ? ("B" + String(z1Btn)) : "";
  json += "\",";
  json += "\"Z2\":\"";
  json += (z2Btn > 0) ? ("B" + String(z2Btn)) : "";
  json += "\"},";
  json += "\"buzzer\":";
  json += "false";
  json += ",";
  json += "\"lastRfId\":\"";
  json += lastRfId;
  json += "\"";
  json += "}";

  server.send(200, "application/json", json);
}

void handleHttpAck() {
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"Missing JSON body\"}");
    return;
  }

  int zoneNum = 0;
  if (!extractZoneFromJson(server.arg("plain"), zoneNum)) {
    server.send(400, "application/json", "{\"error\":\"Invalid zone. Use Z1 or Z2\"}");
    return;
  }

  for (int btn = 1; btn <= 4; btn++) {
    callActive[zoneNum][btn] = false;
  }
  currentStatus = "ACK from mobile on Z" + String(zoneNum);
  updateOLED();
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleHttpAckAll() {
  resetAllZones();
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleHttpNotFound() {
  server.send(404, "application/json", "{\"error\":\"Not found\"}");
}

bool extractZoneFromJson(const String &body, int &zoneNum) {
  String zoneValue = "";
  if (!extractFieldValue(body, "zone", zoneValue)) return false;
  zoneValue.trim();
  if (zoneValue == "Z1") {
    zoneNum = 1;
    return true;
  }
  if (zoneValue == "Z2") {
    zoneNum = 2;
    return true;
  }
  return false;
}

bool extractFieldValue(const String &body, const String &key, String &value) {
  String token = "\"" + key + "\"";
  int keyIndex = body.indexOf(token);
  if (keyIndex < 0) return false;
  int colonIndex = body.indexOf(':', keyIndex + token.length());
  if (colonIndex < 0) return false;

  int firstQuote = body.indexOf('"', colonIndex + 1);
  if (firstQuote < 0) return false;
  int secondQuote = body.indexOf('"', firstQuote + 1);
  if (secondQuote < 0) return false;

  value = body.substring(firstQuote + 1, secondQuote);
  return true;
}

int firstActiveButtonForZone(int zoneNum) {
  if (zoneNum < 1 || zoneNum > 2) return 0;
  for (int btn = 1; btn <= 4; btn++) {
    if (callActive[zoneNum][btn]) return btn;
  }
  return 0;
}
