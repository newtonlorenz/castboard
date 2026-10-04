# Castboard MCP

Configure Castboard from an AI assistant using the Model Context Protocol (MCP).
The server exposes 16 tools, the project guides and bundled plugin guides as
resources, and a `configure-castboard` workflow prompt. It runs locally using
Node.js 20+ and adds no runtime dependencies.

The MCP process is a bridge to a running Castboard app. Start the app separately;
configuration changes use the same validation, authorization, revision checks,
atomic saves and live plugin lifecycle as Studio. Documentation remains available
when the app is offline.

This release includes the embedded display tools:
`castboard_get_devices`, `castboard_change_device` and
`castboard_get_display_adapters`. The bundled `embedded-displays` and `display-adapters` guides are available as documentation resources.
These tools configure screen assignment, dimensions, refresh, native/image mode,
touch/actions and adapter settings. Create/rotate returns a one-time secret
connection key for provisioning the receiver. Updating ordinary settings keeps
the existing key. Receiver firmware installation and physical wiring remain host
setup tasks. Renderer settings and existing devices also support targeted patches.

## Connect an assistant

From the repository:

```sh
npm run init
npm start
```

In another terminal, register the bridge with Codex. Replace the example path
with the absolute path to your checkout:

```sh
codex mcp add castboard -- node /absolute/path/to/castboard/src/mcp.js
codex mcp get castboard
```

If your desktop app cannot find Node, use its absolute executable path. On a
Homebrew Mac, that is commonly `/opt/homebrew/bin/node`. Reopen the chat or
reload your client's MCP connections after registering the server. The MCP
process does not automatically start or restart Castboard.

For clients with an `mcpServers` JSON configuration:

```json
{
  "mcpServers": {
    "castboard": {
      "command": "node",
      "args": ["/absolute/path/to/castboard/src/mcp.js"],
      "env": { "CASTBOARD_URL": "http://127.0.0.1:8787" }
    }
  }
}
```

Run the actual Node entrypoint, rather than `npm run mcp`, in the client command:
npm may print its script banner on stdout, where MCP expects only protocol data.
`npm run mcp` is available for manual launch.

The bridge reads these variables from its **process environment**:

| Variable | Default | Purpose |
| --- | --- | --- |
| `CASTBOARD_URL` | `http://127.0.0.1:8787` | App origin, without a path, embedded credentials or query |
| `CASTBOARD_ADMIN_TOKEN` | Unset | Optional bearer token for authorized admin access |

For another port:

```sh
codex mcp add castboard --env CASTBOARD_URL=http://127.0.0.1:9000 -- node /absolute/path/to/castboard/src/mcp.js
```

The bridge does not load the app's `.env`. The app loads its own environment and
`.env` as usual. Give a remote bridge its token through your client's secret or
environment mechanism; do not commit credentials to MCP configuration examples.
Non-loopback connections carrying a token require HTTPS. LAN administration must
also be enabled on the app, with its existing token and allowed-host settings.
For a container running on the same computer, published `localhost` ports still
cross container networking, so the app may require an admin token.

## What an AI can configure

All JSON configuration sections can be changed through targeted patches:

- Branding, default screen, routes, screen types, layouts and appearance.
- Panels, geometry, options, plugin sources and bindings.
- Provider settings, credentials as environment references, and plugin instances.
- Display targets, Google Cast, URL delivery, webhooks and custom protocol settings.
- Server addresses, proxy settings, admin access and trusted extension directories.

Installing a plugin tool creates an instance of a package already present in the
local library. It can also add its declared dependencies. It does not download
packages or generate extension code. New integrations still need a reviewed
package on disk; the assistant can configure its extension root and instances.

Example requests after connecting:

> Configure weather for Madrid using Open-Meteo, and put it beside the clock on Home.

> Create a single-panel news screen at /news using the existing RSS provider.

> Show which integrations still use demo data and explain what each needs.

> Connect my Kitchen Display to Home, then send Home to it.

## Tools

| Tool | Purpose |
| --- | --- |
| `castboard_get_configuration` | Read all configuration, redacted protected fields and the current revision |
| `castboard_patch_configuration` | Validate or save targeted changes to any configuration section |
| `castboard_get_design` | Read the Studio design and installed panel/layout/source schemas |
| `castboard_save_design` | Save a complete Studio design; preserve provider and existing delivery settings |
| `castboard_get_plugins` | Discover packages, instances, schemas, dependencies and usage |
| `castboard_change_plugin` | Install, configure, enable or remove an instance |
| `castboard_get_delivery` | List screen URLs and display targets |
| `castboard_change_delivery` | Add a Google Cast receiver or remove a target |
| `castboard_send_screen` | Send a screen to one configured target now |
| `castboard_get_status` | Read setup diagnostics and runtime/client health |
| `castboard_test_plugin` | Test one integration without returning its data payload |
| `castboard_discover_devices` | Discover Cast receivers with the configured `catt` tool |
| `castboard_read_documentation` | Read a guide by topic, including while offline |

All saves share a revision with Studio, Plugins and Connections. Read again after
every save. If a revision conflict occurs, read the latest state and rebuild the
intended change; do not blindly retry an old complete design.

`castboard_save_design` replaces the design: omitting a screen removes it. Prefer
targeted patches for small edits. Plugin removal/disable operations prevent removing
an instance still used by panels or bindings. Whole-configuration patches validate
the final state, so related additions/removals can be made together in one batch.

## Safe configuration workflow

1. Read `mcp` and relevant guides. Inspect configuration, installed schemas and usage.
2. Build targeted `set`/`remove` operations with the revision from that read.
3. Call `castboard_patch_configuration` with `dryRun: true` (the default).
4. If valid, send the same operations and revision with `dryRun: false`.
5. Read the resulting state; test changed provider connections and inspect health.
6. If `restartRequired` is true, restart the app through its normal service manager.
7. Send a screen only when the user asks to control a display.

For example, first read the configuration. Then validate this call, substituting
the returned revision:

```json
{
  "revision": "REVISION_FROM_LAST_READ",
  "dryRun": true,
  "operations": [
    { "op": "set", "path": "/plugins/weather/provider", "value": "open-meteo" },
    { "op": "set", "path": "/plugins/weather/latitude", "value": 40.4 },
    { "op": "set", "path": "/plugins/weather/longitude", "value": -3.7 },
    { "op": "set", "path": "/plugins/weather/label", "value": "Madrid" }
  ]
}
```

This assumes the `weather` instance is installed. Discover/install it first if
necessary. To apply the validated change, repeat with `dryRun: false`. A successful
save returns a new revision, `applied: true`, the changed paths and restart status.
Dry runs do not save or change the active configuration; they do instantiate
changed trusted plugins to validate their startup contracts, then dispose them.

Patch paths use JSON Pointer escaping: `~` becomes `~0`, `/` becomes `~1`.
`set` replaces the addressed value and can create missing object parents;
`remove` deletes an existing field. Arrays, such as panels, feeds and targets,
must be replaced as a whole. Individual array-index patches are rejected.
Each batch allows 1–100 operations. The entire final configuration must validate:
screen geometry, enabled plugin references, provider settings, source contracts,
bindings, screen types and referenced casting protocols.

Most settings apply immediately, including provider clients, layouts and delivery.
Changes to `server.host` or `server.port` are saved but the current listener stays
at its old address until restart; keep the old MCP URL until then, then update it.
After changing the app's environment or `.env`, restart the app to load new values.
Turning off admin access or changing authorization can prevent subsequent MCP calls.

## Credentials and access

The bridge uses the existing admin API; it does not bypass authorization or edit
configuration files behind a running app. Loopback access follows Castboard's local
admin rules. Remote access uses a bearer token. There is no additional public MCP
HTTP listener: clients launch a local stdio bridge. A bridge may connect to an
authorized remote Castboard origin.

Configuration reads use raw JSON, never environment-expanded JSON. Known sensitive
keys, credential-bearing URLs and fields marked sensitive in plugin schemas return
`[REDACTED]` with their paths in `protectedPaths`. A single `${ENV_NAME}` or
`Bearer ${ENV_NAME}` reference may be shown because it contains no credential.
Arbitrary custom fields should declare `sensitive: true` in their plugin schema;
redaction cannot infer every custom secret. Omitted fields in a targeted patch
retain their exact existing values. Saving `[REDACTED]` is rejected.

Use this pattern for new credentials:

```json
{ "op": "set", "path": "/plugins/stocks/apiKey", "value": "${ALPHA_VANTAGE_API_KEY}" }
```

Set the value in the app's ignored `.env` or service environment and restart the
app before validating the reference. The MCP does not read or edit `.env`, install
executables, authenticate Spotify, execute arbitrary shell commands, or manage the
app service. Those one-time host tasks use their existing installation flows.
Extension roots load trusted executable code: adding one should refer to a package
you have reviewed. Custom plugin startup hooks may have side effects during validation.

## Documentation available to AI

`resources/list` discovers the project guides and every bundled plugin README.
`resources/read` reads their `castboard://docs/...` URIs. Clients that do not surface
resources can use `castboard_read_documentation` instead. Common topics:

| Topic | Guide |
| --- | --- |
| `mcp` | This setup and tool reference |
| `readme` | Project overview and quick start |
| `configuration` | JSON configuration and providers |
| `admin-studio` | Screen editing and visual design |
| `plugins` | Plugin authoring and management |
| `plugin-contracts` | Canonical provider data |
| `screen-types` | Layout extensions and geometry |
| `cast-protocols` | Delivery protocols |
| `extensions` | Instance, source, binding and lifecycle contracts |
| `plugin/weather` | A bundled plugin's own guide |

Resources are allowlisted shipped Markdown files; arbitrary filesystem paths and
private configuration files cannot be fetched through documentation tools. The
`configure-castboard` prompt accepts a required `goal` string and produces the
inspect → validate → apply → verify workflow for a client that supports MCP prompts.

## Troubleshooting and verification

| Symptom | Fix |
| --- | --- |
| Cannot reach Castboard | Start/restart the app and check `CASTBOARD_URL` and port |
| Endpoint unavailable | Restart the app from this version; an older running process lacks the configuration endpoint |
| Admin access denied | Check admin is enabled; use loopback or the correct LAN bearer token |
| Host rejected | Configure the remote hostname in the app's `server.allowedHosts` |
| Missing environment variable | Set it in the app environment or `.env`, then restart the app |
| Revision conflict | Read again and rebuild the change against current state |
| Protected array/object contains `[REDACTED]` | Leave that object unchanged or deliberately reconstruct it with environment references |
| No receivers found | Install/configure `catt` and check receiver/network reachability |
| Provider validation fails | Read that plugin's guide and settings schema; supply its required connection fields |
| Client prints protocol parse errors | Launch `node src/mcp.js` directly and keep logs off stdout |

Run `npm test` and `npm run check` to verify protocol framing, tool discovery,
documentation access, redaction, dry-run/save behavior, authorization, revision
conflicts and existing Studio/plugin/delivery behavior. Tests use temporary
configuration files and local test servers, without controlling actual displays.

Implementation: [MCP bridge](../src/mcp.js), [configuration patch and redaction](../src/core/ai-config.js),
and the authenticated `/api/admin/configuration` route in [the app server](../src/server.js).
Protocol reference: [MCP tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
and [stdio transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
