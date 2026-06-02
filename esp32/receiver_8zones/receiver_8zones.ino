#include <SPI.h>
#include <LoRa.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ====================== PINS ======================
#define LORA_NSS       5
#define LORA_RST       14
#define LORA_DIO0      27
#define LORA_FREQUENCY 433E6
#define LORA_SYNC_WORD 0xF3
#define LORA_SF        12

#define OLED_MOSI   25
#define OLED_CLK    26
#define OLED_DC     2
#define OLED_CS     17
#define OLED_RESET  4

#define BUZZER_PIN  12
#define ACK_BUTTON  16

// ====================== WiFi ======================
const char *WIFI_SSID     = "Nouri";
const char *WIFI_PASSWORD = "nouriazza";
WebServer server(80);

// ====================== OLED ======================
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT,
                         OLED_MOSI, OLED_CLK, OLED_DC,
                         OLED_RESET, OLED_CS);

// ====================== Variables ======================
// [zone 1..2][bouton 1..4], index 0 inutilisé
bool zoneActive[3][5] = {false};
int  callCount[3][5]  = {0};

String lastRfId = "RF?";

// ====================== Prototypes ======================
void showWaitingScreen();
void resetAllZones();
void updateOLED();
void handleNewCall(const String &rfId, int zoneNum, int btnNum);
bool parseCallMessage(const String &message, String &rfId,
                      int &zoneNum, int &btnNum);
void setupWifiAndHttp();
void handleHttpStatus();
void handleHttpAck();
void handleHttpAckAll();
void handleHttpNotFound();
bool extractZoneNum(const String &body, int &zoneNum);
bool extractFieldValue(const String &body, const String &key, String &value);
int  firstActiveBtn(int zoneNum);
bool isZoneActive(int zoneNum);

// ====================== Setup ======================
void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(ACK_BUTTON, INPUT_PULLUP);

  LoRa.setPins(LORA_NSS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(LORA_FREQUENCY)) {
    Serial.println("[LoRa][ERR] init failed");
    while (1) {}
  }
  LoRa.setSyncWord(LORA_SYNC_WORD);
  LoRa.setSpreadingFactor(LORA_SF);
  LoRa.enableCrc();
  Serial.println("[LoRa] ready");

  if (!display.begin(SSD1306_SWITCHCAPVCC)) {
    Serial.println("OLED error");
    while (1) {}
  }
  showWaitingScreen();
  setupWifiAndHttp();
}

// ====================== Loop ======================
void loop() {
  server.handleClient();

  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String received = "";
    while (LoRa.available()) received += (char)LoRa.read();
    received.trim();

    Serial.print("[RX] "); Serial.println(received);

    String rfId = "";
    int zoneNum = 0, btnNum = 0;
    if (parseCallMessage(received, rfId, zoneNum, btnNum))
      handleNewCall(rfId, zoneNum, btnNum);
    else
      Serial.println("[RX][WARN] format invalide");
  }

  if (digitalRead(ACK_BUTTON) == LOW) {
    resetAllZones();
    delay(300);
  }

  delay(20);
}

// ====================== Alarm ======================
void handleNewCall(const String &rfId, int zoneNum, int btnNum) {
  zoneActive[zoneNum][btnNum] = true;
  callCount[zoneNum][btnNum]++;
  lastRfId = rfId;
  tone(BUZZER_PIN, 1400, 500);
  updateOLED();
}

void resetAllZones() {
  for (int z = 1; z <= 2; z++)
    for (int b = 1; b <= 4; b++)
      zoneActive[z][b] = false;
  showWaitingScreen();
}

bool isZoneActive(int zoneNum) {
  for (int b = 1; b <= 4; b++)
    if (zoneActive[zoneNum][b]) return true;
  return false;
}

// Returns first active button (1..4) for zone, or 0 if none
int firstActiveBtn(int zoneNum) {
  for (int b = 1; b <= 4; b++)
    if (zoneActive[zoneNum][b]) return b;
  return 0;
}

// ====================== OLED ======================
void updateOLED() {
  display.clearDisplay();

  display.fillRect(0, 0, 128, 14, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK);
  display.setTextSize(1);
  display.setCursor(18, 3);
  display.print("MAINTENANCE");

  int total = 0;
  for (int z = 1; z <= 2; z++)
    for (int b = 1; b <= 4; b++)
      total += callCount[z][b];

  display.setTextColor(SSD1306_WHITE);
  display.setCursor(4, 16);
  display.print("Total appels: ");
  display.print(total);

  for (int btn = 1; btn <= 4; btn++) {
    int y = 26 + (btn - 1) * 9;

    for (int zone = 1; zone <= 2; zone++) {
      int x = (zone == 1) ? 0 : 64;

      display.drawRect(x + 1, y, 62, 9, SSD1306_WHITE);

      if (zoneActive[zone][btn]) {
        display.fillRect(x + 2, y + 1, 60, 7, SSD1306_WHITE);
        display.setTextColor(SSD1306_BLACK);
        display.setCursor(x + 3, y + 2);
        display.print("Z"); display.print(zone);
        display.print("B"); display.print(btn);
        display.print("(");  display.print(callCount[zone][btn]);
        display.print(")");
      } else {
        display.setTextColor(SSD1306_WHITE);
        display.setCursor(x + 3, y + 2);
        display.print("Z"); display.print(zone);
        display.print("B"); display.print(btn);
        display.print(" OK");
      }
    }
  }

  display.display();
}

void showWaitingScreen() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(12, 18);
  display.println("SYSTEME MAINTENANCE");
  display.setCursor(30, 38);
  display.println("EN ATTENTE");
  display.display();
}

// ====================== LoRa parsing ======================
bool parseCallMessage(const String &msg, String &rfId,
                      int &zoneNum, int &btnNum) {
  if (!msg.startsWith("CALL:")) return false;

  int zIdx = msg.indexOf(":Z");
  if (zIdx == -1) zIdx = 4;

  String zPart = msg.substring(zIdx + 1);
  if (zPart.length() < 4) return false;
  if (zPart.charAt(0) != 'Z' || zPart.charAt(2) != 'B') return false;

  char zc = zPart.charAt(1);
  char bc = zPart.charAt(3);
  if (zc < '1' || zc > '2') return false;
  if (bc < '1' || bc > '4') return false;

  zoneNum = zc - '0';
  btnNum  = bc - '0';
  rfId    = (zIdx > 4) ? msg.substring(5, zIdx) : "RF?";
  if (rfId.length() == 0) rfId = "RF?";
  return true;
}

// ====================== WiFi / HTTP ======================
void setupWifiAndHttp() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[WiFi] connecting");
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 30) {
    delay(500); Serial.print("."); retries++;
  }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi][ERR] HTTP disabled."); return;
  }
  Serial.print("[WiFi] IP: "); Serial.println(WiFi.localIP());

  server.on("/status",  HTTP_GET,  handleHttpStatus);
  server.on("/ack",     HTTP_POST, handleHttpAck);
  server.on("/ack-all", HTTP_POST, handleHttpAckAll);
  server.onNotFound(handleHttpNotFound);
  server.begin();
  Serial.println("[HTTP] started");
}

// GET /status
// Returns the format the mobile app expects:
// {"zones":{"Z1":"CALL","Z2":"OK"},"activeButtons":{"Z1":"B2","Z2":""},"buzzer":false,"lastRfId":"RF1"}
void handleHttpStatus() {
  int z1btn = firstActiveBtn(1);
  int z2btn = firstActiveBtn(2);

  String json = "{";
  json += "\"zones\":{";
  json += "\"Z1\":\""; json += isZoneActive(1) ? "CALL" : "OK"; json += "\",";
  json += "\"Z2\":\""; json += isZoneActive(2) ? "CALL" : "OK"; json += "\"";
  json += "},";
  json += "\"activeButtons\":{";
  json += "\"Z1\":\""; json += (z1btn > 0) ? ("B" + String(z1btn)) : ""; json += "\",";
  json += "\"Z2\":\""; json += (z2btn > 0) ? ("B" + String(z2btn)) : ""; json += "\"";
  json += "},";
  json += "\"buzzer\":false,";
  json += "\"lastRfId\":\""; json += lastRfId; json += "\"";
  json += "}";

  server.send(200, "application/json", json);
}

// POST /ack   body: {"zone":"Z1", ...}
// Clears all buttons for the given zone.
// Response is sent BEFORE updating OLED to avoid HTTP timeout.
void handleHttpAck() {
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"Missing body\"}");
    return;
  }
  int z = 0;
  if (!extractZoneNum(server.arg("plain"), z)) {
    server.send(400, "application/json", "{\"error\":\"Use zone Z1 or Z2\"}");
    return;
  }
  for (int b = 1; b <= 4; b++) zoneActive[z][b] = false;
  // Send response first — OLED update happens after so it doesn't block the HTTP reply
  server.send(200, "application/json", "{\"ok\":true}");
  updateOLED();
}

// POST /ack-all
void handleHttpAckAll() {
  for (int z = 1; z <= 2; z++)
    for (int b = 1; b <= 4; b++)
      zoneActive[z][b] = false;
  // Send response first, then update OLED
  server.send(200, "application/json", "{\"ok\":true}");
  showWaitingScreen();
}

void handleHttpNotFound() {
  server.send(404, "application/json", "{\"error\":\"Not found\"}");
}

// Extracts zone number from JSON body. Accepts {"zone":"Z1",...}
bool extractZoneNum(const String &body, int &zoneNum) {
  String zv = "";
  if (!extractFieldValue(body, "zone", zv)) return false;
  zv.trim();
  if (zv == "Z1") { zoneNum = 1; return true; }
  if (zv == "Z2") { zoneNum = 2; return true; }
  return false;
}

bool extractFieldValue(const String &body, const String &key, String &value) {
  String token = "\"" + key + "\"";
  int ki = body.indexOf(token);
  if (ki < 0) return false;
  int ci = body.indexOf(':', ki + token.length());
  if (ci < 0) return false;
  int q1 = body.indexOf('"', ci + 1);
  if (q1 < 0) return false;
  int q2 = body.indexOf('"', q1 + 1);
  if (q2 < 0) return false;
  value = body.substring(q1 + 1, q2);
  return true;
}
