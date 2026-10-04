# Vehicle

Battery percentage, charging status/power and optional range. Works in browser,
image and native receiver modes. Install from **Plugins → Library** and configure
the installed copy; panel appearance and display options stay in Studio.

Choose sample data, a canonical JSON endpoint/file, or Home Assistant. Home
Assistant requires its URL, a private long-lived access token and a battery
percentage entity. Charging power, charging state and range entities are optional.
The token stays on the server. No vehicle-control actions are exposed.

Power sensors can use W or kW; range sensors can use km or mi. Unknown units and
unavailable values remain unavailable, rather than becoming zero. A configured
charging-state sensor takes precedence; otherwise positive power indicates
charging. A failed sensor can leave other available readings visible; a complete
connection failure reports unavailable. `updatedAt` is the oldest available sensor
report/update timestamp, not the time Castboard fetched it.

Panel options: title/label, charging power, range, distance unit and refresh.
Small panels use a compact summary. Use a separate detail composition for range
or larger type, linked through the panel's **On tap** setting.

JSON sources return `{batteryPercent, chargingKw, charging, rangeKm, updatedAt}`.
Measurements and `charging` may be null. Battery outside 0–100 and negative power
or range become unavailable. An optional `label` is plain text. Provider metadata,
entity IDs and credentials are not forwarded to the screen.

[Home Assistant REST API](https://developers.home-assistant.io/docs/api/rest/)
defines the state endpoint and Bearer-token authentication. Code is covered by
Castboard's [MIT licence](../../LICENSE). Keep private configuration out of shared
packages.
