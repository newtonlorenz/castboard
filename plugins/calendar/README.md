# Calendar Agenda

Show upcoming events from an ICS calendar or JSON source. Choose an event horizon, calendars, locations and update timing.

Package ID: `calendar`. Category: Display plugins. MIT licensed. Names shown in admin can be changed for each installed copy; package IDs stay stable.

## Set up

Install from **Plugins → Library**. Select the installed copy, give it a name, choose its content source and save its settings. Multiple copies can use separate sources and defaults.

Available sources: **Sample data** (`demo`), **Calendar feed (ICS)** (`ics`), **Web endpoint (JSON)** (`http-json`), **Local file (JSON)** (`file-json`).

Start with **Sample data** to try the layout without an external service. HTTP and file JSON must match the [canonical contracts](../../docs/PLUGIN-CONTRACTS.md). File paths are relative to the Castboard configuration. JSON files and HTTP responses are limited to 1 MiB. See the [configuration guide](../../docs/CONFIGURATION.md) for environment references and secret values.

Add the installed copy to a screen with **Add to a screen**. Screen Studio can override the display settings below for each panel. Browser rendering supports phones, tablets, kiosks and Cast displays; image mode renders the same view for an embedded receiver. Native mode is supported only by packages with a native view; use image mode for camera/video and rich companion panels.

A provider failure is isolated to its panel. It retries on the configured refresh cadence. Core data widgets show an unavailable state; RSS news can retain its previous update and label it as stale. Demo values are illustrative. Camera demo mode does not contact a live camera.

## Connection settings

| Setting | Key | Accepted values | Default | Notes |
| --- | --- | --- | --- | --- |
| Name in admin | `displayName` | string; up to 100 characters | — | Name this copy for its purpose, such as Lobby weather or Workshop energy. Its connection ID stays the same. |
| Data source | `provider` | Sample data, Calendar feed (ICS), Web endpoint (JSON), Local file (JSON) | demo | Choose where this copy gets its data. Sample data lets you try the display before connecting a service. |
| Display title | `title` | string | — | Default heading on the display. A screen panel can override it. |
| Response cache · milliseconds | `cacheMs` | integer; min 0; max 3600000 | — | How long server responses are reused. 0 bypasses this response cache; a provider may also have its own refresh interval. |
| Request timeout · milliseconds | `timeoutMs` | integer; min 500; max 120000 | — | Maximum wait for an upstream response before showing an unavailable state. |
| Calendar feed URL | `url` | string | — | Endpoint returning the documented JSON data format for this plugin. |
| JSON file path | `path` | string | — | Path on the Castboard server, relative to its configuration folder. In Docker, this must be a mounted path. |
| Request headers | `headers` | object | — | Optional request headers as a JSON object. Saved values are hidden and never sent to displays. |
| Default number of events | `maxEvents` | integer; min 1; max 100 | — |  |
| Compact layout | `compact` | boolean | false | Use the layout designed for small screens. |
| Look ahead · days | `daysAhead` | integer; min 0; max 365 | 0 | 0 includes all upcoming events supplied by the source. |
| Include all-day events | `showAllDay` | boolean | true |  |
| Show calendar name | `showSource` | boolean | true |  |
| Show event location | `showLocation` | boolean | false |  |
| Exclude calendars | `excludeSources` | array; up to 50 items | — | One calendar/source name per line, matched without regard to case. |
| Check for updates · seconds | `refreshSeconds` | integer; min 15; max 3600 | 60 | How often the display requests data. The response cache can reduce upstream requests. |
| Time zone | `timeZone` | string | — | An IANA name such as Europe/Madrid or America/New_York. Empty uses the screen’s time zone. |
| Change pages automatically | `autoRotate` | boolean | false | Useful on screens without touch. Reading or interacting pauses the timer. |
| Time per page · seconds | `rotationSeconds` | integer; min 5; max 600 | 20 |  |
| Agenda layout | `layout` | Fit the panel (pages when needed), Pages, Scrollable list | auto |  |
| Events per page | `eventsPerPage` | integer; min 0; max 20 | 0 | 0 fits the available height. Increase for a denser agenda. |
| Show page controls | `showControls` | boolean | true |  |

## Panel overrides

Panel overrides affect only that panel. Source credentials and content settings remain on the installed plugin.

| Setting | Key | Accepted values | Default | Notes |
| --- | --- | --- | --- | --- |
| Display title | `title` | string | — | Default heading on the display. A screen panel can override it. |
| Events to show | `maxEvents` | integer; min 1; max 100 | — |  |
| Compact layout | `compact` | boolean | false | Use the layout designed for small screens. |
| Look ahead · days | `daysAhead` | integer; min 0; max 365 | 0 | 0 includes all upcoming events supplied by the source. |
| Include all-day events | `showAllDay` | boolean | true |  |
| Show calendar name | `showSource` | boolean | true |  |
| Show event location | `showLocation` | boolean | false |  |
| Exclude calendars | `excludeSources` | array; up to 50 items | — | One calendar/source name per line, matched without regard to case. |
| Check for updates · seconds | `refreshSeconds` | integer; min 15; max 3600 | 60 | How often the display requests data. The response cache can reduce upstream requests. |
| Time zone | `timeZone` | string | — | An IANA name such as Europe/Madrid or America/New_York. Empty uses the screen’s time zone. |
| Change pages automatically | `autoRotate` | boolean | false | Useful on screens without touch. Reading or interacting pauses the timer. |
| Time per page · seconds | `rotationSeconds` | integer; min 5; max 600 | 20 |  |
| Agenda layout | `layout` | Fit the panel (pages when needed), Pages, Scrollable list | auto |  |
| Events per page | `eventsPerPage` | integer; min 0; max 20 | 0 | 0 fits the available height. Increase for a denser agenda. |
| Show page controls | `showControls` | boolean | true |  |

## Privacy and maintenance

Private headers and tokens stay on the server; source connections are separate from display options. Use environment references for credentials; keep local configuration and personal data out of Git. Installing an external plugin loads trusted server code.

See [the catalog](../../docs/PLUGIN-CATALOG.md), [source contracts](../../docs/PLUGIN-CONTRACTS.md), [panel bridge contracts](../../docs/AMBIENT-PLUGINS.md) and [authoring guide](../../docs/PLUGINS.md). Report reproducible issues with the package ID, provider type and redacted data shape.

<!-- Generated by scripts/plugin-docs.mjs; update plugin.json and regenerate. -->
