# Camera Viewer

Show a live stream or refreshing snapshots from a camera service or Home Assistant. Control image fit, titles and update timestamps.

Package ID: `camera`. Category: Display plugins. MIT licensed. Names shown in admin can be changed for each installed copy; package IDs stay stable.

## Set up

Install from **Plugins → Library**. Select the installed copy, give it a name, choose its content source and save its settings. Multiple copies can use separate sources and defaults.

Available sources: **Sample data** (`demo`), **Direct camera stream** (`stream`), **Camera service** (`camera-service`), **Home Assistant** (`home-assistant`).

Start with **Sample data** to try the layout without an external service. See the [configuration guide](../../docs/CONFIGURATION.md) for environment references and secret values.

Add the installed copy to a screen with **Add to a screen**. Screen Studio can override the display settings below for each panel. Browser rendering supports phones, tablets, kiosks and Cast displays; image mode renders the same view for an embedded receiver. Native mode is supported only by packages with a native view; use image mode for camera/video and rich companion panels.

A provider failure is isolated to its panel. It retries on the configured refresh cadence. Core data widgets show an unavailable state; RSS news can retain its previous update and label it as stale. Demo values are illustrative. Camera demo mode does not contact a live camera.

## Connection settings

| Setting | Key | Accepted values | Default | Notes |
| --- | --- | --- | --- | --- |
| Name in admin | `displayName` | string; up to 100 characters | — | Name this copy for its purpose, such as Lobby weather or Workshop energy. Its connection ID stays the same. |
| Data source | `provider` | Sample data, Direct camera stream, Camera service, Home Assistant | demo | Choose where this copy gets its data. Sample data lets you try the display before connecting a service. |
| Display title | `title` | string | — | Default heading on the display. A screen panel can override it. |
| Response cache · milliseconds | `cacheMs` | integer; min 0; max 3600000 | — | How long server responses are reused. 0 bypasses this response cache; a provider may also have its own refresh interval. |
| Request timeout · milliseconds | `timeoutMs` | integer; min 500; max 120000 | — | Maximum wait for an upstream response before showing an unavailable state. |
| Service URL | `baseUrl` | string | — | Base address of the compatible service, reachable from the Castboard server. |
| Camera stream URL | `streamUrl` | string | — |  |
| Camera label | `name` | string | — |  |
| Camera list path | `listPath` | string | — |  |
| Stream path template | `streamPath` | string | — |  |
| Preferred camera ID | `preferredId` | string | — |  |
| Request headers | `headers` | object | — | Optional request headers as a JSON object. Saved values are hidden and never sent to displays. |
| Snapshot URL (optional) | `snapshotUrl` | string | — |  |
| Home Assistant token | `token` | string | — | Authentication token kept on the server. Leave empty when editing to keep the saved value. |
| Camera entity | `entity` | string | — |  |
| Show | `displayMode` | Live stream, Snapshots, Camera shortcut | — |  |
| Snapshot refresh · seconds | `refreshSeconds` | integer; min 1; max 300 | — | How often the display checks for new data. Server caching may reuse the previous response. |
| Show Refresh image button | `showRefresh` | boolean | — |  |
| Image fit | `fit` | Fill panel, Show whole image | — |  |
| Show camera title | `showTitle` | boolean | — |  |
| Show update time over image | `overlayTimestamp` | boolean | — | Place the update time at the top of the image. Hide the Refresh image button to give the image more room. |
| Update time zone | `timeZone` | string | — | Empty uses the screen’s time zone. For example Europe/Madrid or America/New_York. |

## Panel overrides

Panel overrides affect only that panel. Source credentials and content settings remain on the installed plugin.

| Setting | Key | Accepted values | Default | Notes |
| --- | --- | --- | --- | --- |
| Display title | `title` | string | — | Default heading on the display. A screen panel can override it. |
| Camera label | `name` | string | — |  |
| Show | `displayMode` | Live stream, Snapshots, Camera shortcut | — |  |
| Snapshot refresh · seconds | `refreshSeconds` | integer; min 1; max 300 | — | How often the display checks for new data. Server caching may reuse the previous response. |
| Show Refresh image button | `showRefresh` | boolean | — |  |
| Image fit | `fit` | Fill panel, Show whole image | — |  |
| Show camera title | `showTitle` | boolean | — |  |
| Show update time over image | `overlayTimestamp` | boolean | — | Place the update time at the top of the image. Hide the Refresh image button to give the image more room. |
| Update time zone | `timeZone` | string | — | Empty uses the screen’s time zone. For example Europe/Madrid or America/New_York. |

## Privacy and maintenance

Private headers and tokens stay on the server; source connections are separate from display options. Use environment references for credentials; keep local configuration and personal data out of Git. Installing an external plugin loads trusted server code.

See [the catalog](../../docs/PLUGIN-CATALOG.md), [source contracts](../../docs/PLUGIN-CONTRACTS.md), [panel bridge contracts](../../docs/AMBIENT-PLUGINS.md) and [authoring guide](../../docs/PLUGINS.md). Report reproducible issues with the package ID, provider type and redacted data shape.

<!-- Generated by scripts/plugin-docs.mjs; update plugin.json and regenerate. -->
