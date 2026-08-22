# Canonical plugin contracts

HTTP and file JSON providers should return the object shown under `data` directly. Castboard wraps it as `{ "ok": true, "data": ... }` for the browser.

All timestamps should be ISO 8601 strings.

## Weather

```json
{ "temperatureC": 22.4, "condition": "Partly cloudy", "code": 2, "windKph": 14, "label": "Coast", "updatedAt": "2026-01-01T10:00:00Z" }
```

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
