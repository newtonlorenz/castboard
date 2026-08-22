# Castboard

Castboard is a configurable, plugin-based dashboard for smart displays. Configure one screen or many, choose a screen type, assign one or many targets using the appropriate casting protocol, and place plugin-backed panels in that screen's layout. It ships with three starter layouts:

- **Home** — focus, solar, clock, weather, recovery, media, stocks, calendar, camera, and a briefing strip.
- **Office** — a full-grid instance of the same news plugin, rendered as an auto-rotating wire with categories, reader, and ticker.
- **Tablet** — a responsive flow of clock, weather, calendar, and news panels delivered as a URL for a kiosk browser.

The project intentionally has no runtime dependencies or build step. Node.js serves the UI and loads first-party plugins from `plugins/`; browsers load each plugin's widget module on demand.

## Quick start

Requirements: Node.js 20 or newer. Casting additionally requires [`catt`](https://github.com/skorokithakis/catt).

```sh
cp castboard.config.example.json castboard.config.json
npm start
```

Open [http://localhost:8787](http://localhost:8787), [http://localhost:8787/screens/office](http://localhost:8787/screens/office), and [http://localhost:8787/screens/tablet](http://localhost:8787/screens/tablet). The example configuration is fully functional offline.

Open [http://localhost:8787/admin](http://localhost:8787/admin) to design the screens visually. Castboard Studio can create, duplicate, and remove screens; switch screen types and simulated viewport sizes; add plugin panels; drag and resize fixed-grid panels; edit responsive flow spans and order; and tune typography, colors, sizes, spacing, borders, corners, and shadows. Five built-in themes provide useful starting points, while individual panels can override the screen theme. **Save & apply** validates the entire configuration, writes it atomically, and updates open screens within five seconds without restarting or recasting the server.

The studio deliberately receives only the public design layer. It never receives cast targets, protocol credentials, provider configuration, device addresses, or environment-backed secrets. Existing private fields are merged back into the saved file. When the example configuration is active, the first save creates the ignored `castboard.config.json` rather than changing the tracked example. See [docs/ADMIN-STUDIO.md](docs/ADMIN-STUDIO.md).

Docker is optional:

```sh
docker compose up --build
```

The supplied Compose service runs as an unprivileged user and seeds an editable configuration into the persistent `castboard-data` volume on first start. Set `CASTBOARD_ADMIN_TOKEN` in an ignored `.env` file to unlock Studio through container/LAN networking, then enter that token in the browser. For a separately managed private configuration, mount it at `/data/castboard.config.json` and supply integration values through your secret manager.

To cast a configured screen:

```sh
npm run cast -- home
npm run cast -- office
npm run cast -- --all
```

Each screen's `targets` is an array, so the same layout can be cast to several displays. Panel placement is declarative: choose a plugin and set its grid column, row, width, and height. The same plugin can appear more than once and use different presentation options in each panel. For example, `news` can be a one-row headline strip, a list, or a full-screen Bloomberg-style wire.

Built-in screen types are `grid`, responsive `flow`, and `single`; new types are discoverable modules under `screen-types/`. Built-in casting protocols are `google-cast`, `url`, and `http-webhook`; protocol drivers live under `cast-protocols/`. A screen chooses its default with `castProtocol`, and an individual target can override it.

See [docs/SCREEN-TYPES.md](docs/SCREEN-TYPES.md) and [docs/CAST-PROTOCOLS.md](docs/CAST-PROTOCOLS.md) for extension contracts. Version 0.5 adds full screen themes and per-panel appearance overrides; its underlying model remains `screens.<id>.type`, `layout`, `panels`, structured `targets`, and `casting.protocols`.

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
