# Canonical plugin contracts

HTTP and file JSON providers should return the object shown under `data` directly. Castboard wraps it as `{ "ok": true, "data": ... }` for the browser.

All timestamps should be ISO 8601 strings.

## Weather

```json
{
  "temperatureC": 22.4, "condition": "Partly cloudy", "code": 2,
  "windKph": 14, "uvIndex": 3, "label": "Coast", "timeZone": "UTC",
  "updatedAt": "2026-01-01T10:00:00Z",
  "hourly": [{ "time": "2026-01-01T11:00:00Z", "temperatureC": 23,
    "code": 2, "condition": "Partly cloudy", "precipitationProbability": 10 }],
  "daily": [{ "date": "2026-01-01", "highC": 24, "lowC": 16,
    "code": 2, "condition": "Partly cloudy", "precipitationProbability": 20 }]
}
```

Forecast arrays are optional. Hourly times must include an offset; daily dates
are local `YYYY-MM-DD` values. Use null for unavailable measurements.

## Vehicle

```json
{ "batteryPercent": 72, "chargingKw": 4.8, "charging": true, "rangeKm": 286,
  "label": "Vehicle", "updatedAt": "2026-01-01T10:00:00Z" }
```

Measurements may be null. Battery must be 0–100; power and range non-negative.
When charging state is absent or null, a known charging power supplies the state.
Only this canonical payload reaches a display; connection settings and entity IDs
stay on the server.

## Solar

```json
{ "generatedKw": 3.8, "loadKw": 2.1, "gridImportKw": 0, "gridExportKw": 1.7, "updatedAt": "2026-01-01T10:00:00Z" }
```

## Recovery

```json
{ "score": 82, "status": "Ready", "detail": "Sleep 91% · HRV balanced", "updatedAt": "2026-01-01T10:00:00Z" }
```

## Spotify and Sonos playback

```json
{ "playing": true, "title": "Track", "artist": "Artist", "album": "Album", "artworkUrl": "https://…", "device": "Living room", "volume": 34, "updatedAt": "2026-01-01T10:00:00Z" }
```

## Stocks

```json
{
  "positions": [
    { "symbol": "ACME", "name": "Acme Systems", "quantity": 12, "price": 128.4, "value": 1540.8, "changePct": 1.8, "currency": "EUR" }
  ],
  "totalValue": 1540.8,
  "dailyChange": 27.2,
  "updatedAt": "2026-01-01T10:00:00Z"
}
```

Account IDs and full broker payloads should be removed by the collector before this boundary.

## Calendar

```json
{
  "events": [
    { "id": "event-1", "title": "Design review", "start": "2026-01-01T10:00:00Z", "end": "2026-01-01T11:00:00Z", "allDay": false, "source": "Work" }
  ],
  "updatedAt": "2026-01-01T09:55:00Z"
}
```

## News

```json
{
  "stories": [
    { "id": "story-1", "title": "Headline", "summary": "One-paragraph deck", "body": "Full story text", "category": "Research", "source": "Daily brief", "publishedAt": "2026-01-01T08:00:00Z", "url": "https://…" }
  ],
  "updatedAt": "2026-01-01T09:55:00Z"
}
```

Treat all provider text as untrusted. First-party widgets escape content before inserting it into HTML.

## Noticeboard

```json
{"notices":[{"id":"welcome","title":"Welcome","body":"Opening hours: 09:00–17:00\nPlease sign in at reception.","enabled":true,"startsAt":"2030-12-01T09:00:00Z","expiresAt":"2030-12-31T17:00:00Z"}],"updatedAt":"2030-12-01T09:00:00Z"}
```

`body` is required plain text, up to 12,000 characters. Headings are optional, up to 160 characters. The source may contain up to 100 notices. Disabled, future and expired notices are hidden. Schedules use ISO timestamps with a time-zone offset; expiry is exclusive. Browser views rotate notices and allow scrolling longer text. Native views show up to 12 notices and receivers may truncate long bodies; use image mode for long instructions. HTML is displayed as text.

## Countdown

```json
{"target":"2030-12-25T09:00:00+01:00","title":"Community gathering","description":"Main hall opens at 09:00","updatedAt":"2030-12-01T09:00:00Z"}
```

`target` is required and includes an explicit UTC or numeric offset. Optional `title` and `description` are text. Countdown calculations use the absolute instant; the display time zone affects the date label. Once reached, show the configured completion message or count time elapsed. Demo targets are fixed when the plugin starts, two days ahead; restarting creates a new sample target.
