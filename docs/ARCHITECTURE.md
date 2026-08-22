# Architecture and source-system audit

## What the original system does

The source installation is a capable personal command centre assembled incrementally around two Google Cast displays.

### Kitchen display: Mission Control

The primary screen is a fixed bento layout with:

1. A focus lane derived from current/upcoming calendar events and recovery.
2. Fronius solar generation, household load, grid import, and export.
3. Clock, date, location, and timezone.
4. Open-Meteo weather.
5. WHOOP recovery.
6. Spotify playback routed through a local Sonos control service, including transport, speaker, playlist, volume, radio, and DJ actions.
7. An IBKR/crypto portfolio table enriched with live quotes, FX conversion, daily P&L, total P&L, data freshness, and gateway status.
8. A merged calendar from local cached sources plus an ICS bridge.
9. A selected outdoor-camera MJPEG stream from a separate camera service.
10. A collapsible briefing dock backed by daily Markdown brief files.

### Office display: Office Wire

The secondary screen aggregates three briefing channels into stories and presents:

- Category filters and story counts.
- A lead-story headline and excerpt.
- A selectable headline wire.
- Previous, next, play/pause, and automatic rotation.
- A full-story reader.
- A continuously moving headline ticker.

### Runtime and casting

The original runtime combines a Node HTTP server, a Python Cast-safe proxy, a Python Sonos API, shell launch supervision, `catt`, local JSON/Markdown caches, command execution, and several LAN services. A launch script starts missing processes, finds the Mac's LAN address, chooses one of two configured Cast targets, and retries DashCast.

## Why the source is not directly publishable

The functionality is strong, but the boundaries reflect one household rather than a distributable product:

- A 3,285-line HTML file owns layout, style, state, polling, vendor normalization, and controls.
- A 1,409-line server owns unrelated provider logic, filesystem conventions, command execution, routing, caching, and static files.
- LAN IPs, device names, geographic coordinates, local absolute paths, service ports, and source-specific filenames appear in defaults or source.
- Frontend JavaScript calls machine-specific services directly, bypassing a consistent privacy and error boundary.
- The portfolio model is tightly coupled to IBKR snapshots and the briefing model to one vault naming scheme.
- Process management is macOS- and `screen`-specific, with multiple PID/log conventions.
- `Access-Control-Allow-Origin: *` is broader than needed for a same-origin LAN application.
- The cast-safe server duplicates serving behavior to work around a local runtime/network problem.
- There is no stable plugin contract, schema validation, first-run demo, automated test suite, or contributor-facing documentation.

## Target architecture

```text
Cast display(s)
  ├─ /                  configured default screen
  └─ /screens/:screen   any additional configured grid
          │
          ▼ same-origin JSON/action/stream routes
Node core
  ├─ config loading + environment expansion
  ├─ plugin discovery + lifecycle
  ├─ safe static serving + security headers
  └─ standardized provider error handling
          │
          ▼
First-party plugins
  clock · focus · weather · solar · recovery
  spotify · stocks · calendar · camera · news
          │
          ▼
Demo / canonical JSON / files / ICS / Fronius / LAN services
```

The core knows nothing about IBKR, WHOOP, Fronius, Spotify, Sonos, Bloomberg, or a particular camera. A plugin owns normalization and an optional widget. Each screen declares a grid and any number of panels; every panel selects a plugin plus its position, size, and presentation options. News is not a screen type—it is the same plugin whether rendered as a small strip, a list, or a full-screen wire. Removing a plugin removes its code path without changing the core.

## Deliberate decisions

- **No build step or runtime packages.** A clone can run with Node alone, and smart displays receive ordinary browser modules.
- **Demo-first.** Every visual module renders without accounts or network access.
- **Canonical contracts.** Household-specific collectors remain replaceable; they only need to emit documented JSON.
- **Server-side integration settings.** Headers, paths, and upstream URLs are not serialized to the display.
- **Same-origin proxying.** Camera streams and actions go through Castboard, avoiding CORS requirements and most credential leakage.
- **Failure isolation.** Each widget owns its loading/unavailable state and refresh cadence.
- **LAN scope.** Authentication is not pretended away; internet exposure is explicitly out of scope for the initial release.

## Remaining optional work before a public hosted release

For a public repository, the current version is suitable as an initial tagged release. A hosted or multi-user product would additionally need authentication/authorization, CSRF protection for action routes, rate limits, structured observability, plugin package signing or an allowlist, richer config schemas, and browser compatibility CI against actual Cast firmware.
