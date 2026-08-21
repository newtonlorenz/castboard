# Writing a plugin

A plugin folder is discovered when it has a valid lowercase ID, a `plugin.js`, and an enabled configuration entry of the same name.

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

The companion widget exports `mount()`:

```js
// plugins/air-quality/widget.js
import { getPluginData, title } from '/widget-kit.js';

export async function mount({ element, config, context }) {
  const data = await getPluginData('air-quality');
  element.innerHTML = `${title(config.title)}<strong>${data.aqi} · ${data.label}</strong>`;
}
```

Add the plugin to `plugins` and a screen's `widgets`, then add its grid area to the theme. A plugin may be backend-only or browser-only, but `plugin.js` is always required as its manifest and privacy boundary.

## Lifecycle and error behavior

- `createPlugin()` runs once during startup and may validate settings or prepare a client.
- `getData()` runs for each standardized data request.
- `action()` must allowlist actions and validate its payload.
- `stream()` owns the response lifecycle.
- Throw an `Error` with a non-sensitive message for upstream failure. The core converts it to a structured provider error.
- Widgets should use `unavailable()` and continue refreshing after transient failure.
