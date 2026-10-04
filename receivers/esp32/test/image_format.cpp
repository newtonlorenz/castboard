#include <cassert>
#include <cstdint>
#include "../src/lvgl_compat.h"

int main() {
  // Red, green, blue and white in the protocol's little-endian RGB565 order.
  uint8_t pixels[] = {0x00, 0xf8, 0xe0, 0x07, 0x1f, 0x00, 0xff, 0xff};
  castboard_lvgl::Image image{};
  castboard_lvgl::setImage(image, pixels, sizeof(pixels), 2, 2);
  assert(image.header.w == 2 && image.header.h == 2);
  assert(image.data_size == sizeof(pixels) && image.data == pixels);
#if LVGL_VERSION_MAJOR == 8
  assert(image.header.always_zero == 0);
  assert(image.header.cf == LV_IMG_CF_TRUE_COLOR);
#else
  assert(image.header.magic == LV_IMAGE_HEADER_MAGIC);
  assert(image.header.cf == LV_COLOR_FORMAT_RGB565);
  assert(image.header.stride == 4);
#endif
#if LVGL_VERSION_MAJOR == 8 && LV_COLOR_16_SWAP
  const uint8_t expected[] = {0xf8, 0x00, 0x07, 0xe0, 0x00, 0x1f, 0xff, 0xff};
#else
  const uint8_t expected[] = {0x00, 0xf8, 0xe0, 0x07, 0x1f, 0x00, 0xff, 0xff};
#endif
  for (size_t i = 0; i < sizeof(pixels); ++i) assert(pixels[i] == expected[i]);
}
