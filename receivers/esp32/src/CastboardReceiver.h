#pragma once
#include <Arduino.h>
#include <atomic>
#include "lvgl_compat.h"
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

// Call begin() after Wi-Fi, the board's LVGL display and touch driver are ready.
// Call loop() from the same task as lv_timer_handler(). Network I/O runs in a
// separate task; no LVGL calls cross task boundaries. Keep this object alive.
class CastboardReceiver {
 public:
  struct Settings {
    const char* server;
    const char* deviceId;
    const char* connectionKey;
    const char* rootCA; // Mandatory for an https:// server.
    Settings(const char* serverValue, const char* idValue, const char* keyValue, const char* caValue=nullptr)
      : server(serverValue), deviceId(idValue), connectionKey(keyValue), rootCA(caValue) {}
  };
  explicit CastboardReceiver(Settings settings) : settings_(settings) {}
  CastboardReceiver(const CastboardReceiver&) = delete;
  CastboardReceiver& operator=(const CastboardReceiver&) = delete;
  bool begin(lv_obj_t* parent = nullptr);
  void loop();
  const char* status() const { return status_.c_str(); }
 private:
  struct Event { bool native; char control[96]; char revision[40]; char id[40]; int x; int y; };
  struct Result { uint8_t* bytes=nullptr; size_t length=0; bool native=false; int width=0; int height=0; String revision; String error; };
  Settings settings_;
  QueueHandle_t events_=nullptr, results_=nullptr;
  TaskHandle_t task_=nullptr;
  lv_obj_t* parent_=nullptr;
  lv_obj_t* statusLabel_=nullptr;
  lv_obj_t* canvas_=nullptr;
  castboard_lvgl::Image image_{};
  uint8_t* pixels_=nullptr;
  String revision_, status_;
  bool native_=false;
  std::atomic<bool> connected_{false};
  static void networkTask(void* self);
  static void inputEvent(lv_event_t* event);
  void network();
  void display(Result* result);
  void send(const char* control, int x=0, int y=0);
};
