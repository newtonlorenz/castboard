# Castboard

Castboard is a configurable, plugin-based dashboard for Cast-enabled smart displays. Configure one screen or many, assign one or many Cast targets to each, and place any plugin-backed panel anywhere on that screen's grid. It ships with two starter layouts:

- **Home** — focus, solar, clock, weather, recovery, media, stocks, calendar, camera, and a briefing strip.
- **Office** — a full-grid instance of the same news plugin, rendered as an auto-rotating wire with categories, reader, and ticker.

The project intentionally has no runtime dependencies or build step. Node.js serves the UI and loads first-party plugins from `plugins/`; browsers load each plugin's widget module on demand.

## Quick start

Requirements: Node.js 20 or newer. Casting additionally requires [`catt`](https://github.com/skorokithakis/catt).

```sh
cp castboard.config.example.json castboard.config.json
npm start
```

Open [http://localhost:8787](http://localhost:8787) and [http://localhost:8787/screens/office](http://localhost:8787/screens/office). The example configuration is fully functional offline.

Docker is optional:

```sh
docker compose up --build
```

The supplied Compose service runs the demo as an unprivileged user. For a private configuration, mount it read-only at `/app/castboard.config.json`, set `CASTBOARD_CONFIG` to that path, and supply integration environment variables through your secret manager or an ignored `.env` file.

To cast a configured screen:

```sh
npm run cast -- home
npm run cast -- office
npm run cast -- --all
```

Each screen's `targets` is an array, so the same layout can be cast to several displays. Panel placement is declarative: choose a plugin and set its grid column, row, width, and height. The same plugin can appear more than once and use different presentation options in each panel. For example, `news` can be a one-row headline strip, a list, or a full-screen Bloomberg-style wire.

Version 0.2 uses the generalized `screens.<id>.grid`, `panels`, and `targets` schema. The previous special-purpose `widgets` and briefing-screen fields are intentionally retired; [docs/CONFIGURATION.md](docs/CONFIGURATION.md) contains the complete replacement format.

## Configure integrations

Every integration is opt-in and independently configurable. Values such as `${CALENDAR_ICS_URL}` are expanded from the process environment at startup and are never included in the browser configuration response.

Supported provider modes include:

| Plugin | Providers |
| --- | --- |
| Weather | `demo`, `open-meteo`, `http-json`, `file-json` |
| Solar | `demo`, `fronius`, `http-json`, `file-json` |
| Recovery | `demo`, `http-json`, `file-json` |
| Spotify/media | `demo`, `sonos-http`, `http-json` |
| Stocks | `demo`, `http-json`, `file-json` |
| Calendar | `demo`, `ics`, `http-json`, `file-json` |
| Camera | `demo`, `stream`, `camera-service` |
| News | `demo`, `http-json`, `file-json`, `markdown-directory` |

HTTP and file providers consume the canonical JSON contract documented in [docs/PLUGIN-CONTRACTS.md](docs/PLUGIN-CONTRACTS.md). See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for complete settings and [docs/MIGRATION.md](docs/MIGRATION.md) for the migration from the original two-display installation.

## Plugin model

Each folder in `plugins/` may export a backend plugin from `plugin.js` and a browser widget from `widget.js`. The core discovers these folders, validates IDs, exposes standardized API routes, and serves only the widget module—not backend source or private configuration.

```text
plugins/my-plugin/
  plugin.js   # metadata, public config, getData/action/stream hooks
  widget.js   # mount({ element, api, config, context })
```

See [docs/PLUGINS.md](docs/PLUGINS.md) for a minimal plugin and lifecycle details.

## Security model

Castboard is designed for a trusted home LAN, not direct internet exposure. Integration URLs, headers, filesystem paths, and device addresses remain server-side. Only explicitly returned `publicConfig` reaches the display. Review [SECURITY.md](SECURITY.md) before enabling camera or control plugins.

## Development

```sh
npm test
npm run check
```

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md).
