# Ambient display collection

Install an Ambient display from **Plugins → Library**. Dependencies are installed or reused automatically. Add a panel in Studio; the typed source installed with the display is offered in its Source selector. Per-panel options override installed defaults. Appearance controls apply to the internal frame and shadow content through the same Studio variables as other plugins.

| Display | Options beyond title | Sources |
| --- | --- | --- |
| Clock | Seconds, 12-hour clock, time zone, location label, date | Configuration |
| Focus | Refresh, empty current/next messages | Calendar, recovery |
| Weather | Refresh, Celsius/Fahrenheit | Weather |
| Solar | Refresh, decimal places | Solar |
| Recovery | Refresh, sleep/strain visibility | Recovery |
| Calendar | Refresh, timeline hours | Calendar |
| Portfolio | Refresh, maximum positions | Portfolio |
| Camera | Preferred camera, image refresh | Configuration, resource proxy |
| Alerts | Refresh, maximum detections | Services, resource proxy |
| Media | Refresh, playback controls | Media, services, casting |
| News reader | Refresh, seconds per story, category list | Services, configuration, portfolio |

Clock uses the app time zone unless explicitly overridden. Empty categories use the configuration source. A category needs `key` and `name`; its service returns Markdown at `/api/briefings/<key>`. Portfolio uses the source's `summary.baseCurrency` and reported totals, with support for legacy EUR-valued fields. Provide an explicit exchange rate when using legacy mixed USD/EUR positions; the display does not invent one.

## Typed sources

Weather, Calendar, Recovery, Solar and Portfolio expose legacy display contracts, respectively `weather-source@1`, `calendar-source@1`, `recovery-source@1`, `solar-source@1`, `portfolio-source@1`. Their admin **Read data from** selector chooses Ambient services or a standard connected plugin. Adapters retain source values, map field names, and convert calendar times to the configured time zone. All-day events use exclusive end dates. The configuration source supplies `mission-config@1`; the media source supplies `media@1`. These contract identifiers remain stable for compatibility with existing extensions.

Standard provider payloads are documented in [PLUGIN-CONTRACTS.md](PLUGIN-CONTRACTS.md). Rich service payloads include:

```json
{
  "weather": { "temp": 22, "apparentTemp": 21, "code": 1, "humidity": 56, "windspeed": 12 },
  "calendar": { "events": [{ "id": "one", "title": "Review", "start": "10:00", "end": "11:00", "source": "Work" }] },
  "recovery": { "recovery": { "score": 82 }, "sleep": { "hours": 7.8 }, "strain": { "score": 4.2 } },
  "solar": { "ok": true, "generatedKw": 2.1, "usedSolarKw": 1.2, "usedGridKw": 0.3, "gridExportKw": 0.9 },
  "portfolio": { "positions": [{ "symbol": "ACME", "currency": "USD", "price": 120, "value": 1200, "changePct": 1.5 }], "summary": { "baseCurrency": "USD", "netLiquidation": 1200, "dailyPnl": 18 } }
}
```

Return each inner object from its respective route, not this combined example. Include `updatedAt`/`timestamp` where available. Ambient services accepts only declared calendar, weather, solar, recovery, portfolio, briefings, status, task/reminder and camera-alert routes; inspect its small `reads` allowlist for the full list. Task/reminder POST actions are separately allowlisted. Configure its HTTP base URL and optional protected headers in admin.

The resource proxy supports camera discovery, images, streams and health on declared paths under a single configured HTTP origin. Demo cameras intentionally have no feed. The media bridge accepts status, queue, playlists and speakers reads, plus bounded playback, speaker, volume and playlist actions; configure a compatible Sonos HTTP bridge. The launch source accepts only HTTP/HTTPS links and passes a configured device and URL as separate `catt` arguments. No shell command is assembled from the link.

## Sharing a package

Copy the package directory, preserving `plugin.json`, `plugin.js`, `widget.js` and declared assets. Ambient displays additionally require the package IDs named in `dependencies`; share those alongside the view or install them from this repository. Copy code and manifests only. Keep installation configuration, credentials, local collectors and personal data outside the shared package. The source boundaries are designed so deployments can supply their own services without forking the view.
