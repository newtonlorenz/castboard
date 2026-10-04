# Plugin release readiness

Castboard 0.13.0 covers all 37 bundled packages. Existing IDs stay stable; names shown in admin and per-copy defaults can change. Private aliases and installation collectors remain outside the public tree; their reusable counterparts and contracts ship here.

## Evidence

- All 37 manifests include meaningful names, descriptions, licence, categories, per-copy names and settings. Generated package guides and catalog are checked by `npm run check`.
- Every display package installs with its required dependencies and mounts at 320×240, 390×844 and 1440×960 using sample data. The gallery also checks horizontal bounds, new date/message editors, news reading and external-label escaping.
- Unit checks cover news selection, source credential privacy, display default forwarding, independent companion sources, units, missing/zero measurements, local file bounds, scheduled notices and countdown state. The full local suite passes with browser tests enabled separately.
- Browser checks cover Studio navigation/action isolation, receiver scoping, package configuration, camera failure/recovery and closing, forecast pages, compact layouts and plugin settings. Representative demonstration screenshots were inspected; long announcements intentionally scroll on short displays.
- Clean-install initialization was run twice; the second run preserved configuration bytes. Both starter and shared-space sample configurations load without external services.
- The renderer lockfile audit reports zero known advisories. The [security review](PLUGIN-SECURITY-REVIEW.md) records resolved findings and trust boundaries. Private credentials, installation configuration and provisioned firmware are excluded.
- The publishing process requires Node 20/22, the complete browser suite and ESP32 compile checks on the release PR before merge/tag/release. See [Publishing](PUBLISHING.md).

## Package coverage

| Package | Default source | Rendering / role |
| --- | --- | --- |
| [Camera Alerts](../plugins/ambient-alerts/README.md) | Local / connected sources | Browser + image |
| [Calendar Timeline](../plugins/ambient-calendar/README.md) | Local / connected sources | Browser + image |
| [Calendar Adapter](../plugins/ambient-calendar-source/README.md) | services | Source / support |
| [Camera Panel](../plugins/ambient-camera/README.md) | Local / connected sources | Browser + image |
| [Clock Panel](../plugins/ambient-clock/README.md) | Local / connected sources | Browser + image |
| [Shared Display Settings](../plugins/ambient-config-source/README.md) | Local / connected sources | Source / support |
| [Focus Strip](../plugins/ambient-focus/README.md) | Local / connected sources | Browser + image |
| [Display Link Launcher](../plugins/ambient-launch-source/README.md) | Local / connected sources | Source / support |
| [Speaker Controls](../plugins/ambient-media/README.md) | Local / connected sources | Browser + image |
| [Speaker Source](../plugins/ambient-media-source/README.md) | demo | Source / support |
| [News Reader](../plugins/ambient-news/README.md) | demo | Browser + image; native for canonical sources |
| [Portfolio Panel](../plugins/ambient-portfolio/README.md) | Local / connected sources | Browser + image |
| [Portfolio Adapter](../plugins/ambient-portfolio-source/README.md) | services | Source / support |
| [Wellbeing Panel](../plugins/ambient-recovery/README.md) | Local / connected sources | Browser + image |
| [Wellbeing Adapter](../plugins/ambient-recovery-source/README.md) | services | Source / support |
| [Camera Resources](../plugins/ambient-resources/README.md) | demo | Source / support |
| [Display Runtime](../plugins/ambient-runtime/README.md) | Local / connected sources | Source / support |
| [Shared Service Connector](../plugins/ambient-services/README.md) | demo | Source / support |
| [Energy Panel](../plugins/ambient-solar/README.md) | Local / connected sources | Browser + image |
| [Energy Adapter](../plugins/ambient-solar-source/README.md) | services | Source / support |
| [Dashboard Theme](../plugins/ambient-theme/README.md) | Local / connected sources | Source / support |
| [Current Weather Panel](../plugins/ambient-weather/README.md) | Local / connected sources | Browser + image |
| [Weather Adapter](../plugins/ambient-weather-source/README.md) | services | Source / support |
| [Calendar Agenda](../plugins/calendar/README.md) | demo | Browser + image + native |
| [Camera Viewer](../plugins/camera/README.md) | demo | Browser + image + native |
| [Clock](../plugins/clock/README.md) | Local / connected sources | Browser + image + native |
| [Countdown](../plugins/countdown/README.md) | demo | Browser + image + native |
| [Focus Agenda](../plugins/focus/README.md) | Local / connected sources | Browser + image + native |
| [News & Briefings](../plugins/news/README.md) | demo | Browser + image + native |
| [Noticeboard](../plugins/noticeboard/README.md) | demo | Browser + image + native |
| [Recovery & Wellbeing](../plugins/recovery/README.md) | demo | Browser + image + native |
| [Energy Monitor](../plugins/solar/README.md) | demo | Browser + image + native |
| [Sonos Player](../plugins/sonos/README.md) | demo | Browser + image + native |
| [Spotify Player](../plugins/spotify/README.md) | demo | Browser + image + native |
| [Markets & Portfolio](../plugins/stocks/README.md) | demo | Browser + image + native |
| [Vehicle Status](../plugins/vehicle/README.md) | demo | Browser + image + native |
| [Weather & Forecast](../plugins/weather/README.md) | demo | Browser + image + native |

## Compatibility and limits

News Reader replaces the old Office Wire presentation; instance IDs can remain unchanged. Existing provider payloads remain supported. New settings and panel overrides inherit sensible defaults. Endpoint authentication belongs in headers; configured HTTP URLs reject embedded credentials. String/date constraints are enforced when configuration loads or saves.

Browser and image layouts support rich typography, scrolling and video. Native views use a deliberately smaller representation and available receiver fonts. Companion camera demo mode shows a setup/empty state instead of a fabricated live camera. Noticeboard native output is capped at 12 notices and receivers may truncate long text. Image mode is appropriate for full announcements and rich companion layouts.

No new physical boards were verified by this release. CI compile checks and browser interaction tests do not establish physical touch response or legibility on every board. Installing a hardware plugin still requires compatible receiver firmware and drivers.
