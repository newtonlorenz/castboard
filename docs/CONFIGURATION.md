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
- `server.publicUrl`: optional `http(s)` base URL used in cast plans when auto-detecting a LAN address is unsuitable (reverse proxy, HTTPS, VLAN, or container routing).
- `server.allowedHosts`: optional custom DNS hostnames accepted by the HTTP server. Direct IPs, localhost, single-label names, `.local`, `.home.arpa`, and the `publicUrl` hostname work automatically.
- `branding.name`, `subtitle`, `location`, `accent`, `timeZone`: public display settings.
- `defaultScreen`: screen shown at `/` when that path does not identify another configured screen.

## Admin studio

The visual editor is enabled by default at `/admin`, but its API accepts requests only from loopback addresses. To disable it completely:

```json
"admin": { "enabled": false }
```

To use it from another trusted device on the LAN, require an environment-backed bearer token:

```json
"admin": { "enabled": true, "allowLan": true, "token": "${CASTBOARD_ADMIN_TOKEN}" }
```

The token is entered when the studio opens and retained only in that browser tab. Do not enable LAN editing without a token, and do not expose the studio to the public internet.

`CASTBOARD_ADMIN_TOKEN` is also a runtime override that enables token-protected LAN editing without placing the token in the JSON file. The Docker Compose setup uses this path because requests crossing the container network are not loopback requests. LAN tokens must contain at least 16 characters.

## Screens

A configuration must contain at least one screen and may contain any number. Every screen has its own route, screen type, targets, layout settings, and panels:

```json
"kitchen": {
  "path": "/screens/kitchen",
  "title": "Kitchen",
  "type": "grid",
  "castProtocol": "google-cast",
  "targets": [
    { "name": "Kitchen Hub", "device": "Kitchen Display" },
    { "name": "Wall tablet", "protocol": "http-webhook", "endpoint": "${TABLET_WEBHOOK}" }
  ],
  "layout": { "columns": 12, "rows": 8, "gap": 8, "padding": 8 },
  "panels": [
    {
      "id": "forecast",
      "plugin": "weather",
      "position": { "column": 1, "row": 1, "width": 4, "height": 2 },
      "options": { "label": "Coast" }
    }
  ]
}
```

For `grid` screens, coordinates are one-based and `width`/`height` are grid spans. Panels must fit inside the configured grid, and panel IDs must be unique within a screen. Panels may reuse a plugin; `options` change only that panel's presentation. Set `options.fitContent` to `true` to let Castboard reduce that panel's typography when its rendered content would otherwise overflow; it never enlarges text beyond the configured font scale. `flow` screens instead accept optional panel `size` spans, while `single` screens require exactly one panel.

Screen `layout`, panel `position`/`size`, and panel `options` are display configuration and are returned to the browser. Do not put credentials, private upstream URLs, or device identifiers in them.

Optional screen `appearance` controls the visual theme:

| Setting | Values |
| --- | --- |
| `fontFamily`, `headingFontFamily` | `sans`, `rounded`, `serif`, or `mono` |
| `fontScale` | percentage from 60 to 180 |
| `background`, `panelBackground`, `accent` | six- or eight-digit hex colors |
| `textColor`, `mutedColor` | primary and secondary text hex colors |
| `positiveColor`, `negativeColor` | semantic value hex colors |
| `borderColor` | panel and internal-divider hex color |
| `radius`, `panelPadding` | numbers from 0 to 48 |
| `borderWidth` | number from 0 to 4 |
| `shadow` | `none`, `soft`, or `deep` |

A screen accent overrides the shared branding accent. Panels inherit the screen appearance and may provide their own `appearance` object with `fontFamily`, `headingFontFamily`, `fontScale`, `background`, `accent`, `textColor`, `mutedColor`, `positiveColor`, `negativeColor`, `borderColor`, `radius`, `padding`, `borderWidth`, and `shadow`.

```json
{
  "id": "markets",
  "plugin": "stocks",
  "appearance": {
    "fontFamily": "mono",
    "fontScale": 90,
    "background": "#101820",
    "accent": "#65d9e8",
    "radius": 6
  }
}
```

`targets` stays server-side and accepts zero, one, or many structured targets. The screen's `castProtocol` is the default; a target's `protocol` overrides it. Run `npm run cast -- screen-id`, `npm run cast -- --all`, or temporarily override every selected target with `npm run cast -- screen-id --protocol url`.

Protocol options may appear before or after the screen ID. Protocol and target `timeoutMs` settings must be positive. Every configured protocol reference is checked before casting begins.

### News panel views

News is an ordinary plugin-backed panel. Its `options.view` may be:

- `compact`: a rotating one-row headline strip.
- `list`: a simple headline list for medium panels.
- `wire`: the editorial lead story, categories, headline rail, controls, reader, and ticker.

```json
{ "id": "markets", "plugin": "news", "position": { "column": 1, "row": 1, "width": 12, "height": 8 }, "options": { "view": "wire", "title": "Bloomberg", "rotationSeconds": 18 } }
```

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

Enabled first-party plugins validate their provider and required connection settings during startup. JSON, ICS, and Markdown provider bodies are limited to 1 MiB each, and HTTP timeouts cover both headers and body reads.

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
