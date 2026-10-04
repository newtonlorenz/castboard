#pragma once
// Implement these using your board manufacturer's LVGL 9 display/touch port.
// Copy this file to board_port.h. Deliberately no assumed pins or flashing step:
// ESP32 displays have different LCD controllers, buses, touch chips and PSRAM.
void board_begin();
void board_loop();
