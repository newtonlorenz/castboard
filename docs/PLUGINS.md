# Writing a plugin

A plugin folder is discovered when it has a valid lowercase ID, a `plugin.js`, and an enabled configuration entry of the same name. A plugin used by a screen panel must also provide `widget.js`; backend-only plugins may omit it.

```js
// plugins/air-quality/plugin.js
export function createPlugin({ config, context }) {
  return {
    id: 'air-quality',
    name: 'Air quality',
    publicConfig: () => ({ title: config.title || 'Air quality' }),
    async getData() {
      return { aqi: 24, label: 'Good' };
    },
    async action(payload) {
      // Optional, exposed only at POST /api/plugins/air-quality/action.
      return { accepted: payload.action };
    },
    async stream(req, res) {
      // Optional, exposed only at GET /api/plugins/air-quality/stream.
    }
  };
}
```

Only `publicConfig()` reaches the browser. Never return headers, tokens, private URLs, or local paths from it.
It must return a plain JSON-safe object. Plugin names and optional hooks are validated during startup; `publicConfig`, `getData`, `action`, and `stream` must be functions when present.

The companion widget exports `mount()`:

```js
// plugins/air-quality/widget.js
import { escapeHtml, title } from '/widget-kit.js';

export async function mount({ element, config, context }) {
  const data = await context.data();
  element.innerHTML = `${title(config.title)}<strong>${escapeHtml(data.aqi)} · ${escapeHtml(data.label)}</strong>`;
}
```

Add the plugin to `plugins` and place it in any screen's `panels` with an explicit position. A plugin may be used by multiple panels or screens, may be backend-only or browser-only, but `plugin.js` is always required as its manifest and privacy boundary.

## Lifecycle and error behavior

- `createPlugin()` runs once per configured instance during startup and may validate settings or prepare a client.
- `getData()` runs for standardized data requests; in-flight requests may be shared and optional `cacheMs` reuses successful reads.
- `action()` must allowlist actions and validate its payload.
- `stream()` owns the response lifecycle.
- Throw an `Error` with a non-sensitive message for upstream failure. The core converts it to a structured provider error.
- Widgets should use `unavailable()` and continue refreshing after transient failure. The shared `schedule()` helper prevents overlapping refreshes when a provider is slow.
- Use the bounded helpers in `src/core/providers.js` for remote or file-backed data. Do not call unbounded `response.text()`/`response.json()` for provider payloads.

For external packages, independently configured instances, separate sources and views, schema-driven options, declared assets and managed cleanup, see [extension contracts and lifecycle](extensions.md).

## Appearance and internal frames

Studio passes explicit screen and panel appearance to each widget as inline styles and CSS variables. Use `--font-family`, `--heading-font-family`, `--accent`, `--text`, `--muted`, `--good`, `--bad`, `--line` and the `--panel-*` properties rather than hardcoded presentation. Explicit panel values override screen values; omitted values preserve plugin defaults. `--castboard-text-scale` contains the combined screen/panel scale for modules with fixed-pixel typography.

A widget that draws its own frame may set `element.dataset.chrome = 'internal'` when mounting. This removes Castboard's default outer padding, border, background and shadow; explicit Studio frame styles are passed through the variables below to the internal frame, so padding and borders are applied once. Shadow-root modules should consume explicit `--castboard-fontFamily`, `--castboard-headingFontFamily`, `--castboard-background`, `--castboard-textColor`, `--castboard-mutedColor`, `--castboard-accent`, `--castboard-positiveColor`, `--castboard-negativeColor`, `--castboard-radius`, `--castboard-padding`, `--castboard-borderWidth`, `--castboard-borderColor` and `--castboard-shadow`, with their own defaults as fallbacks.

## Install and manage in admin

Open **Plugins** at `/admin/plugins`. Installed shows configured copies; Library shows bundled packages and trusted packages placed in `extensions/plugins/<package-id>` next to your configuration. Install creates a copy with its own ID, supplies defaults and connects declared dependencies. It reuses an enabled dependency of the same package type rather than replacing its settings.

Configure a copy's provider, credentials and source connections here. **Save settings** validates and applies the changed clients immediately; unrelated clients keep running. A failed save leaves both the saved configuration and active clients intact. **Test connection** performs a data read, not a playback, casting or device action. A used copy cannot be disabled or removed. Removing an unused copy removes its configuration; package files remain available in Library.

Choose **Add to a screen** to open Studio with that copy in the panel picker. A plugin is the reusable package or configured copy; a panel is one placement on a screen. Installed display defaults apply to every panel that uses the copy. Per-panel options in Studio override those defaults.

Library does not download arbitrary code or claim to be a hosted marketplace. Trusted marketplace or package-manager integrations can place packages in the same extension directory. New packages appear on Reload; changes to an existing package's code require a server restart because Node caches imported code. Plugin code runs with the server's permissions.

### Package metadata

Add `plugin.json` alongside `plugin.js`. Admin reads this file without executing a factory. Existing packages without it continue to run, but need a manifest to be installable through Library.

```json
{
  "name": "Air quality",
  "description": "A display of your sensor's air quality reading.",
  "version": "1.0.0",
  "license": "MIT",
  "category": "Environment",
  "defaultConfig": { "provider": "demo" },
  "settingsSchema": {
    "type": "object",
    "properties": {
      "provider": { "type": "string", "title": "Data provider", "enum": ["demo", "http-json"] },
      "url": { "type": "string", "title": "Sensor URL", "showWhen": { "provider": ["http-json"] } },
      "headers": { "type": "object", "title": "Request headers", "sensitive": true },
      "title": { "type": "string", "title": "Default title" }
    }
  },
  "optionSchema": { "type": "object", "properties": { "title": { "type": "string", "title": "Title" } } }
}
```

`settingsSchema` describes server settings; `optionSchema` describes panel display options. Both use the supported schema subset in [extensions.md](extensions.md). `title`, `description`, `default`, `enumLabels` and `showWhen` improve the generated form. Set `advanced: true` on a setting to place it under Advanced connection settings. Inapplicable fields are hidden and excluded from browser validation; their saved values are preserved. Arrays with string items use one item per line in the admin form. `sensitive: true` hides saved values: leaving the field empty keeps the saved value, and **Clear saved value** removes it. Token/password/key/header fields and credential-bearing URLs are also protected automatically. Environment references stay in the raw configuration when unrelated settings change. Credential privacy in admin does not replace the plugin's `publicConfig()` allowlist.

`dependencies` lists required package IDs; `defaultBindings` maps source aliases to package IDs. A factory must validate provider requirements before creating resources and implement `dispose()` for clients it creates. Read connected data through `context.read()` after registry initialization, inside `getData()` or an action; don't read new dependencies inside the factory.

## Bundled collections

The original eleven plugins provide small, straightforward displays and built-in providers. Every one has editable admin settings and panel options. The **Ambient** collection adds eleven richer displays: Clock, Focus, Weather, Solar, Recovery, Calendar, Portfolio, Camera, Alerts, Media and News reader. They share a runtime and theme, with separate typed sources, a service bridge, a camera resource proxy, a media bridge and a casting action source. Each package includes its own README and MIT licence metadata.

Ambient Weather, Calendar, Solar, Recovery and Portfolio sources can use **Connected plugin** to adapt the standard providers, or **Ambient services** to read a compatible external JSON service. Only configured sources run; Castboard does not ship a broker login, health collector, camera server or music service. Demo sources ship sample data and empty camera/task states, clearly labelled; connect your service before expecting live feeds or actions. The camera and media bridges validate supported paths/actions. Launching a link requires an explicitly configured Cast device and `catt`.

For a complete reusable example, see [Ambient demo configuration](../examples/ambient/castboard.config.json). It contains no private addresses, accounts or credentials. See [Ambient contracts](AMBIENT-PLUGINS.md) for bridge payloads and per-display controls.
