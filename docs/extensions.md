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

Server context provides `configDir`, `root`, `logger`, `instanceId`, `bindings`, `getPlugin(id)`, `read(id,{url,req})` and `action(id,payload,request)`. Use `read` to benefit from in-flight request deduplication, optional `cacheMs` and output validation. Cache entries are capped at 256; successful actions invalidate that instance's reads. Caching is disabled by default. Plugin settings saved through admin are validated and applied live. Restart after editing provider configuration files manually or changing extension code. Editor design saves preserve integration clients and state.

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

### Adding panels in custom layouts

A browser renderer may export `editor.add(screen, panel)`. Studio calls it with a cloned draft; the hook assigns layout-specific placement, appends the panel and updates layout geometry. A thrown error leaves the original draft intact. Studio also rejects a result if the user changed screens or edited the draft while the hook was running. Renderers without this hook retain the schema-based placement flow. Supply layout-schema defaults so a new screen can render immediately. The named-area example demonstrates vacant-area reuse, rectangular splitting and row growth.

### Editable record lists

Plugin settings arrays with an object `items` schema containing scalar properties render as labeled rows in admin. `required`, scalar bounds and enums apply to each row. Optional `itemLabel`, `addLabel` and `emptyLabel` provide task-specific wording. `maxItems` limits additions. For a legacy string-or-record format, use `items.anyOf` with string and object alternatives and `stringItemProperty` to identify the corresponding record property (for example `url`). The editor retains unknown record fields. Arbitrary nested structures retain the JSON fallback. Server schema validation supports `anyOf`, `minItems` and `maxItems`.


## Owned settings and shared inputs

Each configured instance owns its provider settings, credentials and refresh
policy. A display may provide its own data or select an independently configured
source when sharing is useful. Sources are plugin instances; there is no separate
data-connection configuration object. Manage them in Plugins and select them in
Studio. Screen delivery and hardware belong in Delivery and Displays.

Declare named inputs with `connectionSchema`, including their contracts and
`data`, `action` or `stream` capabilities. Validation rejects missing, disabled,
incompatible and cyclic active connections. Use `internalBindings` for runtime
and theme assets; these stay out of the shared-source controls. Use
`packageDependencies` when a factory imports another package's code without
installing a configured copy. An installed instance dependency is a different
requirement. See [plugin ownership and manifest fields](PLUGINS.md).

New companion displays install without the old catch-all service or shared
settings package. Those packages remain under Support for existing configurations.
The [ambient example](../examples/ambient/castboard.config.json) demonstrates
independent bundled providers; the flexible example demonstrates an external
source contract shared by different views.
