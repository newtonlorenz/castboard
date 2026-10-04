#include "freenove_display.h"
#include <Arduino.h>
#include <lvgl.h>
#include <TFT_eSPI.h>
#include <FT6336U.h>

#if LVGL_VERSION_MAJOR != 8 || LVGL_VERSION_MINOR < 4 || LV_COLOR_DEPTH != 16
#error "The FNK0104B board port uses LVGL 8.4 with 16-bit colour"
#endif

namespace {
constexpr int width = 320, height = 240;
TFT_eSPI tft(240, 320);
FT6336U touchController(16, 15, 18, 17);
lv_disp_draw_buf_t drawBuffer;
lv_color_t pixels[width * 24];
uint32_t previousTick;

void flush(lv_disp_drv_t* driver, const lv_area_t* area, lv_color_t* colors) {
  const uint32_t w = area->x2 - area->x1 + 1;
  const uint32_t h = area->y2 - area->y1 + 1;
  tft.startWrite();
  tft.setAddrWindow(area->x1, area->y1, w, h);
  tft.pushColors(reinterpret_cast<uint16_t*>(colors), w * h, !LV_COLOR_16_SWAP);
  tft.endWrite();
  lv_disp_flush_ready(driver);
}

void readTouch(lv_indev_drv_t*, lv_indev_data_t* data) {
  const auto point = touchController.scan();
  data->state = LV_INDEV_STATE_REL;
  if (point.touch_count == 0) return;
  const int x = point.tp[0].y;
  const int y = height - 1 - point.tp[0].x;
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  data->state = LV_INDEV_STATE_PR;
  data->point.x = x;
  data->point.y = y;
}
}

void freenove_begin() {
  lv_init();
  touchController.begin();
  tft.begin();
  tft.setRotation(1);
  lv_disp_draw_buf_init(&drawBuffer, pixels, nullptr, width * 24);
  static lv_disp_drv_t display;
  lv_disp_drv_init(&display);
  display.hor_res = width;
  display.ver_res = height;
  display.flush_cb = flush;
  display.draw_buf = &drawBuffer;
  lv_disp_drv_register(&display);
  static lv_indev_drv_t input;
  lv_indev_drv_init(&input);
  input.type = LV_INDEV_TYPE_POINTER;
  input.read_cb = readTouch;
  lv_indev_drv_register(&input);
  previousTick = millis();
}

void freenove_loop() {
#if !LV_TICK_CUSTOM
  const uint32_t now = millis();
  lv_tick_inc(now - previousTick);
  previousTick = now;
#endif
  lv_timer_handler();
}
