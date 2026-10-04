#include <cassert>
#include <cstdint>
#include <memory>
#include <string>
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
  struct State {std::string resourceId;std::shared_ptr<uint8_t> bytes;size_t length;int width,height;};
  State old{"0123456789abcdef01234567",std::shared_ptr<uint8_t>(pixels,[](uint8_t*){}),sizeof(pixels),2,2};
  State failed{old.resourceId,{},0,2,2};castboard_lvgl::Image retained{};
  // A rebuilt scene with a failed download retains pixels and their byte order.
  assert(castboard_lvgl::retainImage(retained,failed,image,old));
  assert(failed.bytes==old.bytes && retained.data==pixels && retained.header.w==2);
  for(size_t i=0;i<sizeof(pixels);i++)assert(retained.data[i]==expected[i]);
  old.bytes.reset();assert(failed.bytes && failed.length==sizeof(pixels));
  // Resource reassignment, navigation or changed dimensions cannot reuse pixels.
  State reassigned{"abcdef0123456789abcdef01",{},0,2,2};
  assert(!castboard_lvgl::retainImage(image,reassigned,retained,failed));
  reassigned.resourceId=failed.resourceId;reassigned.width=1;
  assert(!castboard_lvgl::retainImage(image,reassigned,retained,failed));
  // Recovery must prefer its newly downloaded pixels, never the retained frame.
  uint8_t fresh[]={0,0,0,0,0,0,0,0};
  State recovered{failed.resourceId,std::shared_ptr<uint8_t>(fresh,[](uint8_t*){}),sizeof(fresh),2,2};
  assert(!castboard_lvgl::retainImage(image,recovered,retained,failed));
  castboard_lvgl::setImage(image,recovered.bytes.get(),recovered.length,2,2);
  assert(image.data==fresh && image.data[0]==0);

}
