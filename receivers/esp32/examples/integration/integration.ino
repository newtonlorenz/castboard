#include <WiFi.h>
#include <CastboardReceiver.h>
#include "secrets.h" // Copy secrets.example.h; keep secrets.h out of Git.
#include "board_port.h" // Your board's existing, working display/touch setup.

CastboardReceiver receiver({CASTBOARD_SERVER, CASTBOARD_DEVICE_ID, CASTBOARD_KEY, CASTBOARD_ROOT_CA});
void setup() {
  Serial.begin(115200);
  board_begin(); // Initialise LVGL, display resolution, orientation and touch.
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  if (!receiver.begin()) Serial.println("Castboard receiver could not start");
}
void loop() {
  receiver.loop(); // LVGL updates on this task; network runs in the background.
  board_loop();   // Call lv_timer_handler(), tick LVGL and service your driver.
  delay(5);
}
