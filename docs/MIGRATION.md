# Migration from Mission Control

The original system should remain in place until Castboard has run beside it for several days. The new repository does not import or modify any live file.

## Module map

| Original module | Castboard plugin | Suggested provider |
| --- | --- | --- |
| Mission clock and location | `clock` | Browser-local |
| Calendar/WHOOP focus lane | `focus` | Composes `calendar` + `recovery` |
| Open-Meteo weather | `weather` | `open-meteo` |
| Fronius power flow | `solar` | `fronius` |
| WHOOP fetch script/cache | `recovery` | A small canonical JSON file or HTTP collector |
| Sonos API + Spotify playback | `spotify` | `sonos-http` |
| IBKR/crypto merged holdings | `stocks` | Canonical `file-json` produced by the existing collector |
| Merged caches + ICS bridge | `calendar` | Prefer a single `ics` bridge; use canonical JSON if source labels must be preserved |
| Camera discovery/MJPEG service | `camera` | `camera-service` |
| Daily vault Markdown briefs | `news` | `markdown-directory` initially; canonical JSON for categories and full metadata |
| Office Wire screen | Full-grid panel | `news` plugin with `view: "wire"` |

## Recommended adapter phase

Keep the existing collectors that already authenticate to IBKR, WHOOP, calendars, Sonos/Spotify, and the camera vendor. Change their final output to the canonical contracts instead of moving credentials into Castboard. This sharply reduces the initial migration risk.

Example private configuration (values intentionally generic):

```json
{
  "plugins": {
    "weather": { "enabled": true, "provider": "open-meteo", "latitude": 0, "longitude": 0, "label": "Home" },
    "solar": { "enabled": true, "provider": "fronius", "baseUrl": "${FRONIUS_URL}" },
    "recovery": { "enabled": true, "provider": "file-json", "path": "../private/recovery.json" },
    "spotify": { "enabled": true, "provider": "sonos-http", "baseUrl": "${SONOS_API_URL}" },
    "stocks": { "enabled": true, "provider": "file-json", "path": "../private/portfolio.json", "currency": "EUR" },
    "calendar": { "enabled": true, "provider": "ics", "url": "${CALENDAR_ICS_URL}" },
    "camera": { "enabled": true, "provider": "camera-service", "baseUrl": "${CAMERA_SERVICE_URL}", "preferredId": "${CAMERA_ID}" },
    "news": { "enabled": true, "provider": "markdown-directory", "path": "../private/briefings" }
  }
}
```

## Cutover checklist

1. Copy the example config to the ignored private config and enable one real provider at a time.
2. Compare every provider response with `docs/PLUGIN-CONTRACTS.md`; normalize in the collector if it contains account- or vendor-specific fields.
3. Test every configured screen route in ordinary browsers at the exact display viewports.
4. Run the server on a stable LAN address and confirm both displays can load `/api/health`.
5. Cast each screen manually with `npm run cast -- <screen>`.
6. Observe provider failures, stream recycling, and media actions for several days.
7. Only then replace the old startup job. Keep the old system available for rollback through the first release.

## Intentionally not migrated

Apple Reminders, Super Productivity task mutation, system-health/webhook signals, trading theses, and World Monitor launch behavior were present in the backend but not essential to the two current display compositions. They are better added later as independent plugins rather than retained as dormant core routes.
