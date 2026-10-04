#pragma once
// Apply to every library translation unit using build.sh. No global Arduino
// library or board settings need to be edited.
#define LV_CONF_SKIP
#define LV_COLOR_DEPTH 16
#define LV_COLOR_16_SWAP 0
#define LV_MEM_SIZE 65536
#define LV_FONT_MONTSERRAT_20 1
#define LV_FONT_MONTSERRAT_32 1
#define LV_TICK_CUSTOM 0
#define USER_SETUP_LOADED
// Some Freenove-distributed TFT_eSPI releases use this spelling.
#define USER_SETUP_LOADE
#define ILI9341_2_DRIVER
#define TFT_WIDTH 240
#define TFT_HEIGHT 320
#define TFT_RGB_ORDER TFT_BGR
#define TFT_INVERSION_ON
#define TFT_MISO 13
#define TFT_MOSI 11
#define TFT_SCLK 12
#define TFT_CS 10
#define TFT_DC 46
#define TFT_RST -1
#define TFT_BL 45
#define TFT_BACKLIGHT_ON 1
// Match the Freenove board setup; the default FSPI register mapping can
// crash TFT_eSPI on ESP32-S3 with Arduino core 3.x.
#define USE_HSPI_PORT
#define SPI_FREQUENCY 40000000
#define SPI_READ_FREQUENCY 20000000
