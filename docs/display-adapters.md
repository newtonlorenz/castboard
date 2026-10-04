# Display plugins

A display plugin adapts Castboard to a receiver without baking one board into the
application. It can provide resolution and refresh defaults, editable settings,
image conversion, native scene encoding and input translation. ESP32, other
microcontrollers, single-board computers and custom receiver software can use
this contract. A plugin does not install firmware or supply an LCD driver unless
its author includes that separate receiver code.

## Install and use

1. Open **Displays → Display plugins**. The Plugins page also links here.
2. Download the example, or obtain a ZIP from an author you trust.
3. Expand **Upload a display plugin**, select the ZIP, confirm trust and install.
4. Add or edit a display. Select its **Display plugin**, choose its screen and
   review the defaults and generated settings. Save and copy its connection key
   into matching receiver firmware.

The included Standard receiver supports RGB565/JPEG image output and JSON native
scenes. Freenove FNK0104B provides defaults for the reference 320 × 240 board port.
**Download example** supplies a working RGB565-to-monochrome converter: 128 × 64,
row-major, MSB-first, 1 = white, with threshold and inversion settings. Its README
specifies the receiving format. It is an encoder example, not ready-made firmware
for every OLED or e-paper controller.

Installation requires admin access. Uploaded JavaScript runs with the server's
permissions; it is trusted code, not a sandbox. Keep integration passwords in
server-side content providers. Display settings and `configure` output are sent
to the assigned receiver and must not contain integration credentials.

An assigned plugin cannot be removed, including when its display is disabled.
Choose a different plugin or remove those display registrations first. Removal
retains the files for recovery. To replace an uploaded package: remove it,
**restart Castboard**, then upload the replacement. Restart unloads Node's cached
modules. If package code fails to load during installation, its files are removed
and the same package ID also requires a restart before retrying. There is no in-place upgrade or automatic firmware update.

## Package layout

```text
my-display/
  adapter.json
  adapter.mjs       # optional for defaults-only packages
  README.md
  LICENSE
```

ZIP the files at the archive root or inside one folder. Supporting source and
receiver examples can be included. Dependencies must be included as ordinary
relative modules; the installer does not run npm or install scripts. `node_modules`,
links, path traversal, duplicate names, encrypted/split ZIPs and ZIP64 are rejected.
Limits: 8 MiB compressed, 8 MiB per file, 24 MiB expanded, 256 entries, 32 KiB
manifest. CRCs and expanded sizes are checked before writing. Do not package
private `secrets.h`, `config.local.h`, `.env`, keys or household configuration.

Packages are stored beside the active private configuration under
`extensions/displayAdapters/<id>/`. Preserve this directory in your Docker volume.
Bundled packages live in `display-adapters/`; configured local extension paths use
`extensions.displayAdapters`, following the other [extension contracts](extensions.md).
IDs are unique across installed packages. Hidden installation/recovery directories
are excluded from discovery. Removed files stay under `.removed-*` in the upload
root; deleting those retained backups is an operator decision.

## Manifest

```json
{
  "id": "my-display",
  "name": "My display",
  "version": "1.0.0",
  "description": "A receiver for my panel controller.",
  "entry": "adapter.mjs",
  "modes": ["frame", "native"],
  "formats": ["rgb565"],
  "sourceFormat": "rgb565",
  "defaults": {
    "width": 320, "height": 240, "refreshMs": 5000,
    "mode": "frame", "format": "rgb565", "touch": true
  },
  "defaultOptions": { "rotation": 0 },
  "optionSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "rotation": { "type": "integer", "title": "Rotation", "enum": [0, 90, 180, 270] }
    }
  },
  "instructions": "Describe the required firmware, pixel order and connection steps."
}
```

`id` starts with a lowercase letter and contains at most 64 lowercase letters,
digits or hyphens. `name` is at most 80 characters. Use a semantic version such as
`1.0.0`. `entry`, when provided, is exactly `adapter.mjs` (ES module). `modes`
contains `frame`, `native`, or both. `formats` lists supported output format IDs;
custom image formats require `encodeFrame`. `sourceFormat` selects the renderer's
input to the encoder: `rgb565` (default) or `jpeg`.

`defaults` can set only the fields shown above. Display dimensions range from
16 to 1920 pixels per side with a 1920 × 1080 pixel budget; refresh ranges from
1 second to 1 hour. Choose a screen design that fits the actual resolution.
Native layouts reserve 48 pixels for Back/Close after navigation; compact layouts
must leave room for this and their own padding. A hardware plugin does not
redesign content automatically.

`optionSchema` uses Castboard's existing [JSON Schema subset](extensions.md).
Admin generates labeled controls for strings, numbers, booleans, enums, objects
and arrays. Settings are saved per display, validated and merged over
`defaultOptions`. Settings are limited to 16 KiB. `description` and `instructions`
are plain text, each limited to 4,000 characters.

## Optional hooks

All hooks may be async. They receive a context with `{ id, device, options }`.
`device` contains this display's settings without its hashed connection key;
`options` merges package defaults and saved settings. These are convenience
boundaries, not isolation from trusted server code.

```js
export function configure({ device, options }) {
  return { rotation: options.rotation, width: device.width, height: device.height };
}

export function encodeFrame(frame, context) {
  // frame: { data: Buffer, format, width, height, frameId }
  // RGB565 input is little-endian, row-major, two bytes per pixel.
  return { data: frame.data, contentType: 'application/octet-stream' };
}

export function encodeScene(scene, context) {
  return {
    data: Buffer.from(JSON.stringify(scene)),
    contentType: 'application/json; charset=utf-8'
  };
}

export function decodeInput(bytes, context) {
  // context also includes contentType. Preserve the server revision and event ID.
  return JSON.parse(bytes.toString('utf8'));
}
```

- `configure` returns an object of at most 16 KiB, sent in the authenticated
  `/api/devices/<id>/config` response under `adapter.configuration`. That response
  also includes the selected adapter ID, version and merged options.
- `encodeFrame` converts renderer output. Return a non-empty `Buffer` or
  `Uint8Array` in `data`, at most 8 MiB, with a MIME `contentType`. The response
  retains `X-Frame-Id`, dimensions and uses the configured format in
  `X-Frame-Format`. Cache with the response `ETag`, rather than constructing one
  from `X-Frame-Id`; the ETag also changes when encoder settings change. The reference ESP32 library decodes RGB565; custom formats
  need their own receiver decoder.
- `encodeScene` receives the bounded `castboard-scene/1` object after scope,
  layout and plugin-view checks. It returns the same binary result shape as
  `encodeFrame`. `X-Scene-Id` remains available for input. It cannot supply a
  missing content plugin's native view; use image mode or implement that view.
- `decodeInput` receives at most 512 KiB and returns a plain object of at most
  16 KiB. For image `/touch`, return `{ eventId, frameId, x, y }`. For native
  `/events`, return `{ eventId, sceneId, event }`, using a control ID supplied by
  the scene. Both retain authentication, enabled/touch/action permissions,
  scope, revision checks and duplicate-event handling. Invalid coordinates,
  stale revisions and unassigned actions remain rejected downstream.

Without a hook, standard behavior applies: JSON settings/scene/input or the
original RGB565/JPEG frame. Image mode still needs the optional renderer. The
HTTP receiver endpoints remain pull-based; MQTT, serial transports or other
networks need a separate bridge that uses these authenticated endpoints.

## Verify a package

Test the declared resolutions, every format, option changes, unsupported input,
repeated taps, reconnects and stale updates. Check colors/byte order and touch
coordinates on actual hardware. Keep physical validation separate from server
request telemetry. Share the adapter, receiver source, build instructions and
license without private connection details.

The bundled monochrome example and `test/display-adapters.test.js` demonstrate
installation, frame conversion, custom native encoding, translated events,
credential scope, recovery and archive validation. See
[embedded displays](embedded-displays.md) for the receiver protocol and board
integration guide.
