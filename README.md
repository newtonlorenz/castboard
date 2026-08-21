# Castboard

Castboard is a configurable, plugin-based dashboard for Cast-enabled smart displays. It ships with two touch-friendly screens:

- **Home** — focus, solar, clock, weather, recovery, media, stocks, calendar, camera, and a briefing strip.
- **Briefing** — an auto-rotating editorial view with categories, a headline wire, full-story reader, and ticker.

The project intentionally has no runtime dependencies or build step. Node.js serves the UI and loads first-party plugins from `plugins/`; browsers load each plugin's widget module on demand.

## Quick start

Requirements: Node.js 20 or newer. Casting additionally requires [`catt`](https://github.com/skorokithakis/catt).

```sh
cp castboard.config.example.json castboard.config.json
npm start
```

Open [http://localhost:8787](http://localhost:8787) and [http://localhost:8787/briefing](http://localhost:8787/briefing). The example configuration is fully functional offline.

To cast a configured screen:

```sh
npm run cast -- home
npm run cast -- briefing
```

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
