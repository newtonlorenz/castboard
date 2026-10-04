#include <WiFi.h>
#include <CastboardReceiver.h>
#include "secrets.h" // Copy secrets.example.h; never commit connection details.
#include "freenove_display.h"

CastboardReceiver receiver({CASTBOARD_SERVER, CASTBOARD_DEVICE_ID, CASTBOARD_KEY, CASTBOARD_ROOT_CA});

void printStatus() {
  Serial.printf("Wi-Fi: %s | signal: %d dBm | heap: %u | PSRAM free: %u | receiver: %s\n",
    WiFi.status() == WL_CONNECTED ? "connected" : "offline", WiFi.RSSI(),
    ESP.getFreeHeap(), ESP.getFreePsram(), *receiver.status() ? receiver.status() : "ready");
}

void setup() {
  Serial.begin(115200);
  Serial.println("Castboard FNK0104B receiver. Commands: status, help.");
  freenove_begin();
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  if (!receiver.begin()) Serial.println("Castboard receiver could not start");
}

void loop() {
  receiver.loop();
  freenove_loop();
  static uint32_t lastRetry = 0;
  if (WiFi.status() != WL_CONNECTED && uint32_t(millis() - lastRetry) >= 15000) {
    lastRetry = millis();
    WiFi.reconnect();
  }
  // Bounded local diagnostics; never print Wi-Fi or Castboard credentials.
  static String command;
  while (Serial.available()) {
    const char ch = Serial.read();
    if (ch == '\n' || ch == '\r') {
      command.trim();
      if (command == "status") printStatus();
      else if (command.length()) Serial.println("Commands: status, help.");
      command = "";
    } else if (command.length() < 32) command += ch;
  }
  static uint32_t lastStatus = 0;
  if (uint32_t(millis() - lastStatus) >= 30000) { lastStatus = millis(); printStatus(); }
  delay(5);
}
