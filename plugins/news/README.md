# News & Briefings

Show news from RSS, Atom, Markdown or JSON. Choose feeds, filter stories and control reading and update timing.

Package ID: `news`. Category: Display plugins. MIT licensed. Names shown in admin can be changed for each installed copy; package IDs stay stable.

## Set up

Install from **Plugins → Library**. Select the installed copy, give it a name, choose its content source and save its settings. Multiple copies can use separate sources and defaults.

Available sources: **Sample data** (`demo`), **RSS / Atom feeds** (`rss`), **Markdown folder** (`markdown-directory`), **Web endpoint (JSON)** (`http-json`), **Local file (JSON)** (`file-json`).

Start with **Sample data** to try the layout without an external service. HTTP and file JSON must match the [canonical contracts](../../docs/PLUGIN-CONTRACTS.md). File paths are relative to the Castboard configuration. JSON files and HTTP responses are limited to 1 MiB. See the [configuration guide](../../docs/CONFIGURATION.md) for environment references and secret values.

Add the installed copy to a screen with **Add to a screen**. Screen Studio can override the display settings below for each panel. Browser rendering supports phones, tablets, kiosks and Cast displays; image mode renders the same view for an embedded receiver. Native mode is supported only by packages with a native view; use image mode for camera/video and rich companion panels.

A provider failure is isolated to its panel. It retries on the configured refresh cadence. Core data widgets show an unavailable state; RSS news can retain its previous update and label it as stale. Demo values are illustrative. Camera demo mode does not contact a live camera.

## Connection settings

| Setting | Key | Accepted values | Default | Notes |
| --- | --- | --- | --- | --- |
| Name in admin | `displayName` | string; up to 100 characters | — | Name this copy for its purpose, such as Lobby weather or Workshop energy. Its connection ID stays the same. |
| Data source | `provider` | Sample data, RSS / Atom feeds, Markdown folder, Web endpoint (JSON), Local file (JSON) | demo | Choose where this copy gets its data. Sample data lets you try the display before connecting a service. |
| Display title | `title` | string | — | Default heading on the display. A screen panel can override it. |
| Response cache · milliseconds | `cacheMs` | integer; min 0; max 3600000 | — | How long server responses are reused. 0 bypasses this response cache; a provider may also have its own refresh interval. |
| Request timeout · milliseconds | `timeoutMs` | integer; min 500; max 120000 | — | Maximum wait for an upstream response before showing an unavailable state. |
| JSON endpoint | `url` | string | — | Endpoint returning the documented JSON data format for this plugin. |
| Markdown directory or JSON file | `path` | string | — | Path on the Castboard server, relative to its configuration folder. In Docker, this must be a mounted path. |
| Request headers | `headers` | object | — | Optional request headers as a JSON object. Saved values are hidden and never sent to displays. |
| RSS / Atom feeds | `feeds` | array; up to 20 items | — | Add up to 20 feeds, each with a source name and category. Pause a feed without removing its settings. |
| Markdown files to read | `maxFiles` | integer; min 1; max 100 | — |  |
| Maximum stories | `maxStories` | integer; min 1; max 200 | — |  |
| Feed refresh · minutes | `refreshMinutes` | integer; min 1; max 1440 | — | Minimum interval between requests to the upstream provider. Display checks can be more frequent. |
| Use example feeds when the list is empty | `useDefaultFeeds` | boolean | true | Uses the three BBC feeds only when you have not added feeds. Switch off to require your own sources. |
| Stories per feed | `maxStoriesPerFeed` | integer; min 1; max 200 | 200 |  |
| Include keywords | `includeKeywords` | array; up to 50 items | — | One phrase per line. Keep a story when its title or text contains any phrase; empty includes everything. |
| Exclude keywords | `excludeKeywords` | array; up to 50 items | — | One phrase per line. Excludes a story if its title or text contains any phrase. |
| Include categories | `categories` | array; up to 50 items | — | One category per line, matched without regard to case. Empty includes all categories. |
| Include sources | `sources` | array; up to 50 items | — | One source name per line. Empty includes every source. |
| Maximum story age · hours | `maxAgeHours` | integer; min 0; max 8760 | 0 | 0 keeps all dates. Stories without a publication date remain available. |
| Remove duplicate stories | `deduplicate` | boolean | true | Merge matching article URLs, including links with tracking parameters. |
| Story order | `sortOrder` | Keep source order, Newest first, Oldest first, Headline A–Z, Source A–Z | — | RSS defaults to newest first. Other providers keep their source order. |
| Layout | `view` | Rotating headline, Headline list, Reader with headline sidebar | — |  |
| Time per story · seconds | `rotationSeconds` | integer; min 1; max 300 | 18 |  |
| Rotate stories automatically | `autoRotate` | boolean | true |  |
| Show story summary | `showSummary` | boolean | true |  |
| Show headline ticker | `showTicker` | boolean | true |  |
| Check for updates · seconds | `refreshSeconds` | integer; min 15; max 3600 | 60 | How often the display checks for data. Feed refresh and response cache control upstream requests. |

## Panel overrides

Panel overrides affect only that panel. Source credentials and content settings remain on the installed plugin.

| Setting | Key | Accepted values | Default | Notes |
| --- | --- | --- | --- | --- |
| Display title | `title` | string | — | Default heading on the display. A screen panel can override it. |
| Layout | `view` | Rotating headline, Headline list, Reader with headline sidebar | — |  |
| Stories to show | `maxStories` | integer; min 1; max 200 | — |  |
| Time per story · seconds | `rotationSeconds` | integer; min 1; max 300 | 18 |  |
| Rotate stories automatically | `autoRotate` | boolean | true |  |
| Show story summary | `showSummary` | boolean | true |  |
| Show headline ticker | `showTicker` | boolean | true |  |
| Check for updates · seconds | `refreshSeconds` | integer; min 15; max 3600 | 60 | How often the display checks for data. Feed refresh and response cache control upstream requests. |

## Privacy and maintenance

Private headers and tokens stay on the server; source connections are separate from display options. Use environment references for credentials; keep local configuration and personal data out of Git. Installing an external plugin loads trusted server code.

See [the catalog](../../docs/PLUGIN-CATALOG.md), [source contracts](../../docs/PLUGIN-CONTRACTS.md), [panel bridge contracts](../../docs/AMBIENT-PLUGINS.md) and [authoring guide](../../docs/PLUGINS.md). Report reproducible issues with the package ID, provider type and redacted data shape.

<!-- Generated by scripts/plugin-docs.mjs; update plugin.json and regenerate. -->
