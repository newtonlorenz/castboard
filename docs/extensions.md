# Extending Castboard

Castboard owns configuration, rendering lifecycle, delivery, administration and HTTP transport. Modules own their data contracts, actions and presentation. Screen types own layout. A deployment can use arbitrary combinations of those packages; the built-in dashboard is one example.

## Packages and instances

Configure trusted extension roots relative to the configuration file:

```json
{
  "extensions": {
    "plugins": ["extensions/plugins"],
    "screenTypes": ["extensions/screen-types"],
    "protocols": ["extensions/protocols"]
  },
  "plugins": {
    "north-weather": {"type":"weather", "provider":"demo"},
    "south-weather": {"type":"weather", "provider":"demo"},
    "summary": {"type":"my-summary", "bindings":{"weather":"north-weather"}}
  }
}
```

Roots supplement the built-in directories. Duplicate definition IDs fail startup. Directory IDs are lowercase letters, digits and hyphens, beginning with a letter. A definition exports `createPlugin({config,context})` and returns its **definition** ID. The runtime assigns the configured **instance** ID and makes it available as `context.instanceId`. Existing configurations that omit `type` retain their original behavior.

A source needs `getData` and no browser widget. A view needs `widget.js` and can omit `getData`. A hybrid can provide both. Several panels can share one source; several independently configured instances can use one definition. Panels select a source with `source` and override module bindings with `bindings`.

```json
{"id":"forecast","plugin":"summary","source":"south-weather","bindings":{"weather":"south-weather"},"options":{"title":"South"}}
```

Server context provides `configDir`, `root`, `logger`, `instanceId`, `bindings`, `getPlugin(id)` and `read(id,{url,req})`. Use `read` to benefit from in-flight request deduplication, optional `cacheMs` and output validation. Cache entries are capped at 256; successful actions invalidate that instance's reads. Caching is disabled by default. Restart for changes to provider configuration or extension code; editor design saves preserve integration clients and state.

## Contracts and schemas

A source can declare `contract: 'forecast@1'`, `dataSchema` and `capabilities`. A view can declare `inputContract: 'forecast@1'`; selecting an incompatible source fails validation. Contracts describe extension-owned semantics, including currencies, units, timezone, freshness and missing values. The core does not impose a financial, calendar or news model. Bindings can join multiple independent contracts inside one view.

`optionSchema`, screen-type `layoutSchema`, `positionSchema` and `sizeSchema` drive editor controls and server validation. `actionSchemas` maps allowed action names to request schemas. Advanced JSON fields remain available.

The supported JSON Schema subset is `type` (object, array, string, boolean, number, integer), `required`, `properties`, `additionalProperties:false`, `items`, numeric `minimum` / `maximum`, and `enum`. UI metadata supports `title`, `description` and `default`; admin settings also support `enumLabels`, `showWhen` and `sensitive`. See [plugin manifests and admin installation](PLUGINS.md#package-metadata). Defaults are editor suggestions; modules must supply runtime defaults. This is deliberately a subset, not a general JSON Schema implementation. Use extension validation hooks for richer constraints.

## Browser lifecycle

Export `mount({element,config,context,panel})`; `config` merges the explicit `publicConfig()` with panel options. A returned cleanup function is run on page exit. `context.onDispose(fn)` registers additional cleanup.

- `context.data(parameters)` reads the panel's selected source, or its own instance.
- `context.source(aliasOrId)` returns `{id,data,action,resource,asset}` for a bound instance.
- `context.action(name,payload)` posts an action to the selected source.
- `context.resource(parameters)` constructs the selected source's stream URL.
- `context.asset(relativePath)` constructs the view package's asset URL.
- `context.listen(target,event,listener,options)` automatically removes listeners.
- `context.schedule(load,milliseconds)` runs immediately and then periodically, avoiding overlapping invocations.
- `context.signal` aborts reads and actions when the view closes.
- `context.getPlugin(aliasOrId)`, `app`, `screen`, `panel`, `bindings`, and `announce` provide public context.

Reads time out after 30 seconds; actions after 60 seconds. Polling widgets should handle their own errors. `options.keepLastGood:true` explicitly retains their last successful response and shows a stale-data label; otherwise errors propagate. A source's own stale timestamps/status still belong to its contract.

## Presentation and assets

Declare public files in `assets:['style.css','helpers.js','font.woff2']`. Files must be relative, exactly allowlisted, and resolve inside the real package directory. Undeclared files, server implementations and symlinks outside the package are never public assets. `styles:['style.css']` automatically loads declared styles when that view is on the selected screen. First-party styles now live with their plugins; the core stylesheet holds shared frame and state styles.

Use instance-independent selectors (the panel class is `widget-<definition ID>`) or isolate markup with a shadow root. Plugins can consume a shared theme package through bindings, use custom assets/fonts and render arbitrary DOM. No core changes are needed for a new visual design. Browser scripts stay same-origin; inline styles support dynamic plugin layouts. The default policy allows same-origin resources and HTTPS images; provider credentials belong on the server.

`publicConfig()` is an explicit synchronous JSON allowlist. Raw provider configuration, extension paths, targets, credentials and admin tokens are not automatically exposed. Extension metadata is public and must not contain secrets. External packages execute trusted server code; they are not sandboxed. Install only packages whose server code the deployment trusts.

## Screen types and protocols

A screen-type directory exports `createScreenType()` from `type.js` and `prepare({container,screen})`, `place({container,element,panel,screen})` from `renderer.js`. It may declare schemas, assets and `validateScreen(screen,id)`. `prepare` may return cleanup. Layout and placement structures belong to the renderer.

A delivery protocol exports `createProtocol({config,context})` from `protocol.js` and supplies `id`, `name`, `cast({target,url,screenId,screenType})`. Enable it under `casting.protocols`. Google Cast retries a failed saved address using the friendly name, with bounded attempts and timeouts. `resetBeforeCast:true` adds a receiver-session reset; `resetDelayMs` defaults to 3000 milliseconds and is capped at 10000. Enable this only for a dashboard receiver that needs a fresh DashCast session. URL and webhook delivery remain independent alternatives.

Trusted plugins can implement `handleRequest(req,res,{url})` for compatibility endpoints, returning true if handled. Core administration, public configuration, static code, plugin APIs and screen paths take precedence. Streaming plugins should release resources when clients disconnect. `proxyStream` forwards MP4 Range requests and preserves 206 / 416 headers.

## Operations and examples

`GET /api/health` is lightweight. `/api/runtime-config` aliases public configuration for deployments whose legacy `/api/config` must keep another contract. `server.trustedProxyAddresses` can explicitly trust a loopback proxy to forward receiver identity for diagnostics; it does not grant admin access to receivers. `/api/admin/health` requires existing admin authorization and reports page requests and client heartbeats without widget values. Displays send panel loading/freshness states every 15 seconds. Extension `dispose()` runs once when the server closes. SIGTERM/SIGINT close connections and release integrations.

See [the flexible example](../examples/flexible/README.md): two independently configured sources each feed two visually different views through one contract and an external renderer. It contains no private dashboard dependencies.
