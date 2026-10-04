#pragma once
#include <lvgl.h>

// Keep board projects on their working LVGL version. All version-dependent
// receiver APIs live here; the display/touch driver remains the board's job.
#if LVGL_VERSION_MAJOR == 9
#include <src/misc/cache/instance/lv_image_cache.h>
#elif LVGL_VERSION_MAJOR != 8 || LVGL_VERSION_MINOR < 4
#error "Castboard requires LVGL 8.4 or 9.x"
#endif
#if LVGL_VERSION_MAJOR == 8 && LV_COLOR_DEPTH != 16
#error "Castboard RGB565 images require LV_COLOR_DEPTH=16 with LVGL 8"
#endif

namespace castboard_lvgl {
#if LVGL_VERSION_MAJOR == 8
using Image = lv_img_dsc_t;
inline lv_obj_t* screen() { return lv_scr_act(); }
inline lv_indev_t* input() { return lv_indev_get_act(); }
inline int width(lv_obj_t* obj) { return lv_disp_get_hor_res(lv_obj_get_disp(obj)); }
inline int height(lv_obj_t* obj) { return lv_disp_get_ver_res(lv_obj_get_disp(obj)); }
inline void clearFlag(lv_obj_t* obj, lv_obj_flag_t flag) { lv_obj_clear_flag(obj, flag); }
inline void dropImage(Image* image) { lv_img_cache_invalidate_src(image); }
inline lv_obj_t* imageObject(lv_obj_t* parent, Image* image) {
  auto* obj = lv_img_create(parent); lv_img_set_src(obj, image); return obj;
}
inline lv_obj_t* button(lv_obj_t* parent) { return lv_btn_create(parent); }
#else
using Image = lv_image_dsc_t;
inline lv_obj_t* screen() { return lv_screen_active(); }
inline lv_indev_t* input() { return lv_indev_active(); }
inline int width(lv_obj_t* obj) { return lv_display_get_horizontal_resolution(lv_obj_get_display(obj)); }
inline int height(lv_obj_t* obj) { return lv_display_get_vertical_resolution(lv_obj_get_display(obj)); }
inline void clearFlag(lv_obj_t* obj, lv_obj_flag_t flag) { lv_obj_remove_flag(obj, flag); }
inline void dropImage(Image* image) { lv_image_cache_drop(image); }
inline lv_obj_t* imageObject(lv_obj_t* parent, Image* image) {
  auto* obj = lv_image_create(parent); lv_image_set_src(obj, image); return obj;
}
inline lv_obj_t* button(lv_obj_t* parent) { return lv_button_create(parent); }
#endif
inline void setImage(Image& image, uint8_t* pixels, size_t length, int width, int height) {
  image = {};
#if LVGL_VERSION_MAJOR == 8
  image.header.cf = LV_IMG_CF_TRUE_COLOR;
#if LV_COLOR_16_SWAP
  // The wire format is always little-endian RGB565. Convert once to LVGL's
  // configured in-memory colour format; the board still owns the SPI transfer.
  for (size_t i = 0; i + 1 < length; i += 2) {
    const auto byte = pixels[i]; pixels[i] = pixels[i + 1]; pixels[i + 1] = byte;
  }
#endif
#else
  image.header.magic = LV_IMAGE_HEADER_MAGIC;
  image.header.cf = LV_COLOR_FORMAT_RGB565;
  image.header.stride = width * 2;
#endif
  image.header.w = width;
  image.header.h = height;
  image.data_size = length;
  image.data = pixels;
}
} // namespace castboard_lvgl
