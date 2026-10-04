#include <WiFi.h>
#include <CastboardReceiver.h>
#include "secrets.h" // Copy secrets.example.h; never commit connection details.
#include "freenove_display.h"

CastboardReceiver receiver({CASTBOARD_SERVER, CASTBOARD_DEVICE_ID, CASTBOARD_KEY, CASTBOARD_ROOT_CA});

void setup() {
  Serial.begin(115200);
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
  delay(5);
}
