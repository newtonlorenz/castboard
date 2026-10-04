# ESP32 and other small displays

Castboard supports two receiver protocols. Both use the same screens, panel tap
behaviours and reusable modal compositions configured in Studio.

| Mode | How it works | Use it for |
| --- | --- | --- |
| Image | A separate Chromium worker renders the screen. The receiver downloads RGB565 pixels or JPEG and sends tap coordinates. | Browser widgets, exact fonts and colours, existing plugin controls and complex layouts. |
| Native | The server sends a small JSON scene. The receiver draws text, metrics, lists and buttons using LVGL. | Lower bandwidth and a display that keeps its last scene during a connection failure. |

Native mode is a separate plugin view, not an HTML interpreter. It uses the
receiver's available fonts and drawing primitives. Charts, camera/video, arbitrary
HTML, external artwork and animations are not automatically translated. Use image
mode for those designs. Image mode is limited to assets served from the configured
Castboard origin; remote assets should be proxied by a trusted plugin.

## 1. Build screens and details

In **Screens**, select a panel and open **On tap**. Choose a modal, another screen,
Back, Close, or a plugin action. **New modal** creates an ordinary reusable screen
composition: add plugins, arrange panels and style it like any screen. A modal has
its own preferred dimensions and appearance. Links can nest up to four modals.
The browser keeps underlying widgets running until navigation replaces the screen.
Native receivers show the modal composition as a detail page with a Close control.

Studio's **Preview** follows these links but blocks provider actions. **Reset
preview** returns to the screen being edited. Plugin actions may include a
confirmation; the browser and reference native receiver show explicit Cancel and
Confirm controls. Existing widget-specific controls continue to work in live
browser/image mode.

## 2. Register the receiver

Open **Displays → Add display**, enter its name, screen, resolution, drawing mode
and refresh interval. A display can reach its assigned screen and compositions
linked from that screen. Enable plugin actions only when that display should be
able to operate its assigned sources. Disabling touch leaves it view-only.

Save and copy the one-time connection details into the receiver. Only a hash of the
key is stored in Castboard's private configuration. **New key** immediately revokes
the previous one. **Remove** revokes access without deleting the screen design.
Display health shows recent requests; this does not prove physical rendering,
legibility or touch response. Check those on the hardware.

Set `server.publicUrl` to the address the device can reach. Use HTTPS with a trusted
CA, or HTTP on a trusted local network. Connection keys grant access to the
assigned content; keep them outside Git and public screenshots. If an installation
uses a private gateway, expose only `/api/devices/…` to embedded receivers. Do not
open an existing browser/Cast allowlist or expose the entire admin service just to
connect a microcontroller.

## 3. Optional image renderer

The main server retains its dependency-free runtime. The worker is a separate
service with Playwright and Sharp. See `services/frame-renderer/Dockerfile` and
`examples/embedded/compose.yaml`. Set the same private random token (at least 32
characters) on both sides:

```json
{
  "embedded": {
    "rendererUrl": "http://frame-renderer:8791",
    "rendererToken": "${CASTBOARD_RENDERER_TOKEN}"
  }
}
```

Worker environment:

- `CASTBOARD_APP_ORIGIN`: the fixed, internal Castboard origin, such as
  `http://castboard:8787`.
- `CASTBOARD_RENDERER_TOKEN`: the worker's private service credential.
- `CASTBOARD_RENDERER_LIMIT`: simultaneous device sessions, default 8, maximum 32.
- `HOST`, `PORT`: worker listener; Docker uses port 8791 on its private network.
- `CASTBOARD_CHROMIUM_PATH`: optional existing Chromium executable for local use.

The worker must not be published to the LAN or internet. It accepts only a device
ID and bounded viewport, never arbitrary URLs or JavaScript. Each device gets an
isolated browser context with a scoped credential. Contexts expire after five
minutes without requests; reconnection opens the assigned screen. Configuration
or key changes replace the context. Browser crashes cause a failed update and
retry; the receiver keeps the previous image. The included Docker example restarts
failed services. Size the session limit to the host's memory.

## 4. Receiver library

`receivers/esp32` contains an Arduino ESP32 library for LVGL 8.4 and 9.x, a generic
integration example and a Freenove FNK0104B board port. It supports RGB565 image
mode and native scenes, with background network I/O, bounded downloads, stale-touch rejection and last-view retention. JPEG is
available in the protocol for receivers that provide their own decoder; the
included library uses RGB565.

Use the board's existing working LCD and touch driver. Supply `board_begin()` and
`board_loop()` in the example's `board_port.h`; keep resolution, orientation and
calibration consistent with Displays. Different ESP32 boards use different buses,
LCD controllers, touch chips and memory wiring. The generic example deliberately
assumes no GPIO map and does not include a flashing script. The
[Freenove FNK0104B example](../receivers/esp32/examples/freenove_fnk0104b/README.md)
provides a 320 × 240 ILI9341 / FT6336U port using LVGL 8.4 and a compile-only
script with board-local settings. Preserve a known-good firmware
and configuration before installing a receiver build on hardware.

At 320 × 240, one RGB565 frame is 153,600 bytes; at 800 × 480 it is 768,000 bytes.
Downloading a replacement while keeping the displayed image needs roughly two frames plus LVGL/network memory;
PSRAM is strongly recommended. Native scenes are capped at 128 KiB. The reference
receiver uses bundled Montserrat fonts; frame mode preserves arbitrary web fonts.
It reports a resolution mismatch instead of drawing to incorrect coordinates.

Compile the API/link harness (does not operate a physical panel):

```sh
pio run -d receivers/esp32/test/compile
python3 receivers/esp32/test/image_format.py
```

The harness builds against LVGL 9.4 and LVGL 8.4, including the swapped-colour
configuration. For a real board, depend on this library, pin LVGL 8.4 or 9.x in
your board project and enable the desired font sizes, then follow its
manufacturer's flashing and recovery procedure. LVGL 8 requires 16-bit colour;
the receiver converts incoming RGB565 pixels when `LV_COLOR_16_SWAP` is enabled.
`secrets.h`, build files and board-local ports are ignored by Git.

## Protocol version 1

All requests carry `Authorization: Bearer <connection-key>`. No key belongs in a
URL. Route prefix: `/api/devices/<id>`.

| Request | Response |
| --- | --- |
| `GET /config` | `castboard-device/1`, dimensions, mode, format, refresh and controls. |
| `GET /scene` | `castboard-scene/1`: `sceneId`, panels, appearance, text lines, control IDs and optional confirmation. Native mode only. |
| `POST /events` | JSON `{sceneId,eventId,event}`. Returns the next native scene. |
| `GET /frame` | Raw RGB565 little-endian pixels, row-major with no header, or JPEG. `X-Frame-Id`, `X-Frame-Width`, `X-Frame-Height`, `X-Frame-Format` headers. Image mode only. |
| `POST /touch` | JSON `{frameId,eventId,x,y}` in configured pixel coordinates. Returns a new frame. |

RGB565 encodes red in bits 15–11, green 10–5, blue 4–0. Swap bytes in a board
adapter only if its display driver requires big-endian pixel transfers. Do not
rotate touch coordinates a second time after the board driver has calibrated them.

Send `If-None-Match` with the frame ETag to receive `304` when unchanged. Do not
clear the display on a failed request. `401` requires a new/valid key, `409` means
busy or stale input (fetch fresh state), `422` means incompatible configuration,
`429` asks the receiver to back off, and `503` means the renderer is unavailable.
A tap uses the revision of the image/scene the person actually saw. An `eventId`
is a unique 8–80 character identifier; reuse it only when retrying that same
request. Sessions remember the most recent 128 event IDs. Navigation is per
device. Mode, assignment, design or key changes reset it.

Native control IDs resolve to configured interactions on the active composition.
The client cannot supply an arbitrary plugin action, target screen or payload.
Frame sessions route plugin requests through the same device scope and reject
unassigned sources and disabled actions. A native plugin can read only assigned
sources; declare reusable dependencies using plugin/panel `bindings`.

## Add native support to an extension

A plugin may provide a server-side `nativeView({data, options, panel, screen,
branding, now, read})` hook. Return a JSON-safe view:

```js
nativeView({data, options}) {
  return {
    title: options.title || 'Temperature',
    lines: [
      {text: `${data.temperatureC}°C`, kind: 'metric'},
      {text: data.condition, kind: 'body'},
    ],
  };
}
```

`data` comes from the panel's selected source. `read(alias)` resolves explicit
bindings. Lines are limited to 16, with 240 characters each; kinds are `metric`,
`body` or `muted`. Castboard supplies bounds, appearance, freshness and the panel's
configured interaction. Optional `controls` (up to eight) contain `label`,
`action`, optional `payload` and optional `confirmation`. They operate only the
panel's assigned source and appear only when device actions are enabled. Spotify
and Sonos provide Previous, Play/Pause and Next this way. Provider errors render an unavailable state rather than
made-up values. Standard Clock, Weather, Calendar, News, Stocks, Solar, Recovery,
Focus, Spotify and Sonos include text views. Focus needs its Calendar/Recovery
sources assigned through bindings or another panel. Other plugins use image mode
until their own native view is supplied.

A screen type may provide `nativeLayout(screen, {width,height})`, returning one
`{id,x,y,width,height}` rectangle per panel. Fixed grid, responsive flow and single
panel layouts include this hook. Flow content can scroll on native receivers.
Keep every rectangle finite and within the native coordinate limit.

## Verification

```sh
npm test
npm run check
npm ci --prefix services/frame-renderer
# Install Chromium once, or set CASTBOARD_CHROMIUM_PATH to an existing binary.
npx --prefix services/frame-renderer playwright install chromium
CASTBOARD_BROWSER_TESTS=1 node --test services/frame-renderer/test/browser.test.js
```

The browser suite exercises rendering, modal touches, duplicate/stale inputs,
independent sessions, native parity, safe preview and one-time registration keys.
Physical board support still requires a successful board build, installation and
observed display/touch checks on that board; a protocol test does not establish it.
