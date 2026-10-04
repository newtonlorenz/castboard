# Freenove FNK0104B receiver

A board-specific port for the 2.8-inch ESP32-S3 display: ILI9341 LCD, FT6336U
touch, 16 MB flash and 8 MB OPI PSRAM. Landscape resolution is **320 × 240**.
The generic receiver supports both image and native modes; choose the mode in
Castboard's **Displays** page. Image mode uses RGB565.

This example uses LVGL **8.4.0**, TFT_eSPI **2.5.43**, the
[FT6336U CTP Controller library](https://github.com/aselectroworks/Arduino-FT6336U)
**1.0.2**, ArduinoJson **7.4.3**, and Arduino ESP32 core **3.2.0**.
Install these in a dedicated Arduino library environment or use an existing board
project with those versions. Do not replace a working global LVGL installation to
build a different receiver example. The board port does not require the vendor's
JPEG decoder; Castboard renders image-mode content on the server.

1. Copy `secrets.example.h` to `secrets.h` and enter Wi-Fi and display connection
   details. Keep this file private.
2. Register a 320 × 240 display in Castboard. Match its orientation to this port.
3. Run `./build.sh`. This compiles only, using board-local settings rather than
   editing TFT_eSPI or LVGL files. Set `ARDUINO_CLI` or `CASTBOARD_BUILD_DIR` if
   needed. Additional arguments are extra library directories, for example
   `./build.sh /path/to/ArduinoJson`. This script cannot upload firmware.
4. Before installing, identify the physical board and preserve its current flash
   and private configuration. Keep the previous build and restoration procedure.
5. Install using the board's established USB flashing procedure. Then check text,
   colours, each screen edge, touch alignment, modal opening/closing, Wi-Fi loss
   and reconnect in **both modes**. A compile result does not verify these checks.

The touch driver maps coordinates to landscape exactly once. The flush callback
converts the LVGL colour byte order for the SPI display. Each 320 × 240 frame is
153,600 bytes; PSRAM is used for incoming frames where available. Data collection
and browser rendering run on the Castboard server, not on the microcontroller.

This is a receiver, not a copy of a household dashboard. Configure screens,
plugins, private data sources and tap behaviours in Castboard. Inventory any
existing firmware features before replacing it. Native mode has text, button and camera snapshot views. Snapshots need the
optional image renderer; they update at the configured display interval. Browser
widgets and their specific controls use image mode. Neither mode is a full-rate
video transport.
