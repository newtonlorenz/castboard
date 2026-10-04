# Camera

Show a camera as a browser stream or periodically refreshed snapshots. Install
from **Plugins → Library**, configure the installed copy, then add it to a screen.
Use **On tap → Modal** in Studio to open a larger camera panel from another panel.

Choose one data source:

- **Home Assistant:** enter the service URL, a token and a `camera.*` entity.
  Castboard uses the authenticated camera proxy routes on the server.
- **Direct camera stream:** provide a browser-compatible image/MJPEG URL, an
  optional JPEG/PNG snapshot URL, and any required request headers. A snapshot URL
  can be used alone. Select **Snapshots** for a still-image-only source.
- **Camera service:** provide a base URL, camera list path, preferred camera ID
  and stream path template. A listed camera may provide `snapshotUrl` and
  `streamUrl`; otherwise the template is appended to the base URL.
- **Sample data:** an explicitly labelled placeholder; no camera is contacted.

The default stream template is `/api/cameras/{id}/mjpeg`. Tokens, headers and
upstream camera URLs remain server-side. Browser and embedded receivers use
Castboard's scoped resource route; never put credentials in panel options.

Studio exposes title, camera label, title visibility, stream/snapshot mode,
snapshot interval (1–300 seconds), image fit and a **Refresh image** button.
Shared defaults are also available under Plugins. **Fill panel** crops the image;
**Show whole image** preserves its full aspect ratio. Refresh works in Preview
without enabling provider actions.

A decoded replacement takes over only after it loads. A failed update keeps the
previous image with an explicit status; an initial failure shows **Image
unavailable**. Streams release their upstream connection when the panel closes.
Snapshot extraction accepts JPEG, PNG or one MJPEG part, with a 2 MiB limit and a
request deadline. Unsupported formats require a camera-side bridge.

## Embedded displays

Image mode captures the browser camera view at the display's configured refresh
interval. It is not a full-rate video transport.

Native mode requests one RGB565 snapshot per scene update and supports a local
**Refresh image** control even when provider actions are disabled. It needs the
optional image renderer and matching receiver firmware with native image support.
The display's refresh interval controls native polling; the panel's snapshot
interval controls the browser widget. A native view can use an MJPEG source, but
extracts one frame per update rather than decoding a continuous video stream on
the microcontroller. The reference receiver retains a failed image's previous
pixels across unrelated data updates and recovers a missing image in
place. A changed camera, assignment, configuration, size or screen does not reuse
pixels from the previous resource.

See [embedded displays](../../docs/embedded-displays.md),
[provider payloads](../../docs/PLUGIN-CONTRACTS.md) and
[plugin authoring](../../docs/PLUGINS.md).

Code is covered by the project's [MIT licence](../../LICENSE). Share code and
assets; keep deployment settings and credentials private.
