#include <CastboardReceiver.h>
// Deliberately does not start the receiver or operate hardware. This links the
// library against real Arduino ESP32, ArduinoJson and LVGL APIs in CI.
CastboardReceiver receiver({"http://127.0.0.1:8787", "test", "compile-test-key-never-used-on-network"});
volatile bool startReceiver=false;
void setup(){if(startReceiver)receiver.begin();}
void loop(){receiver.loop();delay(1000);}
