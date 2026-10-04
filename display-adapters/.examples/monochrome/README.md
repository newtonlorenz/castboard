# Monochrome receiver example

Upload the ZIP from Castboard's Displays page, select **Monochrome display** when
adding a display, and configure its size and threshold. The reference defaults
are 128 × 64 pixels; they do not identify or initialise a particular panel.

Firmware fetches the normal authenticated `/api/devices/<id>/config` and `/frame`
endpoints. Frames contain rows of packed bits, most significant bit first,
1 = white, with each row padded to `ceil(width / 8)` bytes. Image mode needs the
private frame renderer. The adapter's `configure` hook describes this format.

If the device has input, enable touch in Admin. This example accepts JSON with
`sequence` (unique event ID), `revision` (the displayed X-Frame-Id), and `position`
(an [x, y] pair). Its `decodeInput` hook maps that into Castboard's normal event.

For your own display, change the package ID/name, output encoder, defaults and
settings schema. Supply receiver firmware using the board's actual display and
input drivers. Never include Wi-Fi passwords, connection keys or private feeds.
