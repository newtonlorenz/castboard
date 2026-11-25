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

## Later firmware updates

This receiver checks Castboard for a staged firmware update about once a minute.
OTA runs only when the receiver uses HTTPS with its configured trusted root CA.
Plain-HTTP display connections cannot install firmware: a digest received over
HTTP does not authenticate the firmware publisher. Configure authenticated TLS
before using remote updates.
After the first OTA-capable build is installed by USB, open **Displays**, choose
the ESP32 display, and upload the Arduino build's application `.bin` using
**Update firmware**. Do not upload the merged/full-flash image. Castboard serves
the image only to that display's connection key. The receiver checks its size
and SHA-256 while writing the inactive OTA partition, then reboots. The
`app3M_fat9M_16MB` partition layout has two 3 MiB application slots; uploads
larger than 3 MiB are rejected. Keep the full-flash backup and USB recovery
procedure in case the new firmware does not start.

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

## USB diagnostics

Open the USB serial console at 115200 baud and send `status`. The example reports
Wi-Fi state, signal strength, free heap, free PSRAM, active drawing mode, accepted
update count, accepted tap count, most recent input-to-update time, and receiver
errors. A queued tap shows “Updating…” immediately on the display; an existing
network download can still delay its response. Send `refresh` (or `fetch`) to request the current
configuration and view immediately in either mode. It does not operate plugins;
server-side source caching still applies. The example also
reports every 30 seconds. Credentials are never printed. These diagnostics do
not confirm that physical pixels or touch alignment are correct.

The board settings explicitly select HSPI, matching Freenove’s FNK0104B setup.
Do not remove `USE_HSPI_PORT`: the default TFT_eSPI FSPI register mapping can
crash at display initialization with Arduino ESP32 core 3.x.

## Bounded HTTP transfers

The receiver uses HTTP/1.0 and requires an explicit positive Content-Length.
Chunked, oversized, truncated and stalled responses are rejected rather than
leaving the network task waiting indefinitely. Transfers have a 15-second idle
timeout and a 60-second overall limit. A reverse proxy must preserve a valid
Content-Length and must not force chunked encoding for device responses.

Run the host-only regression harness without connecting a device:

```sh
c++ -std=c++17 receivers/esp32/test/bounded_body.cpp -o /tmp/castboard-body-test
/tmp/castboard-body-test
```

This covers successful reads, half-open sockets, zero-byte reads, trickle
responses, size limits, truncated bodies and clock rollover. It does not replace
firmware compilation or physical reconnect testing.

For a dedicated display, the receiver's optional fifth `Settings` argument
enables a restart when the network task makes no progress for over three
minutes. Normal polling, retries and disconnected Wi-Fi handling count as task
progress. The default is off so boards running other tasks retain control of
their restart policy. A firmware write and a watchdog restart are mutually
exclusive.
