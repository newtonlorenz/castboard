# Configuration

Copy `castboard.config.example.json` to the ignored `castboard.config.json`. Set `CASTBOARD_CONFIG` to load a different path.

## Environment values

Any string may include `${VARIABLE_NAME}`. Expansion happens before validation, on the server. A missing variable stops startup with a clear error. Raw plugin configuration is never returned by `/api/config`.

```json
{
  "plugins": {
    "calendar": {
      "enabled": true,
      "provider": "ics",
      "url": "${CALENDAR_ICS_URL}"
    }
  }
}
```

## Server and branding

- `server.host`: use `0.0.0.0` so a Cast device can reach the service.
- `server.port`: LAN port, from 1 to 65535.
- `branding.name`, `subtitle`, `location`, `accent`, `timeZone`: public display settings.
- `cast.targets`: screen ID to `catt` device name or address.

## Screens

A home widget descriptor needs `plugin` and `area`. `options` may override that plugin's public display options for one placement.

```json
{ "plugin": "weather", "area": "weather", "options": { "label": "Coast" } }
```

The supplied CSS defines areas for all first-party widgets. A custom theme may define any new grid areas.

The briefing screen uses `sourcePlugin` and `rotationSeconds`.

## Provider examples

### Open-Meteo weather

```json
"weather": { "enabled": true, "provider": "open-meteo", "latitude": 40.4, "longitude": -3.7, "label": "Madrid" }
```

### Fronius solar

```json
"solar": { "enabled": true, "provider": "fronius", "baseUrl": "http://192.168.1.20" }
```

### ICS calendar

```json
"calendar": { "enabled": true, "provider": "ics", "url": "${CALENDAR_ICS_URL}", "timeoutMs": 12000 }
```

### Sonos-backed Spotify/media card

```json
"spotify": { "enabled": true, "provider": "sonos-http", "baseUrl": "${SPOTIFY_BACKEND_URL}", "statusPath": "/api/sonos/status" }
```

The backend may override `actions.previous`, `actions.toggle`, `actions.next`, `actions.play`, and `actions.pause`.

### Canonical JSON over HTTP

```json
"stocks": { "enabled": true, "provider": "http-json", "url": "${STOCKS_JSON_URL}", "headers": { "Authorization": "Bearer ${STOCKS_TOKEN}" } }
```

The same `http-json` and `file-json` providers work for weather, solar, recovery, stocks, calendar, and news. Files resolve relative to the configuration file.

### Camera stream

```json
"camera": { "enabled": true, "provider": "stream", "name": "Driveway", "streamUrl": "${CAMERA_STREAM_URL}" }
```

For a discovery service returning `{ "cameras": [{ "id", "name", "status" }] }`:

```json
"camera": { "enabled": true, "provider": "camera-service", "baseUrl": "http://camera-bridge.local:3001", "preferredId": "driveway", "streamPath": "/api/cameras/{id}/mjpeg" }
```

### Markdown briefing directory

```json
"news": { "enabled": true, "provider": "markdown-directory", "path": "./briefings", "maxFiles": 10 }
```

Each `## Heading` becomes one story. For richer categories and metadata, use canonical JSON.
