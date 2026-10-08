# Integration architecture

A plugin package can provide data, a display, actions, resources, or a combination.
Each configured copy owns its service settings, credentials and refresh policy.
Installing a display does not require configuring a catch-all integration for
unrelated services.

## When to share a source

A display can connect directly to its provider. An independent source is useful
when several panels share an account or dataset, or when different designs use
the same data. That source is an ordinary plugin instance with its own settings;
there is no second data-connection object redirecting to it.

For example, two calendar source copies can use different feeds and credentials.
Several calendar or focus panels can deliberately select either copy. Changing
one source does not change the other's settings. A panel's presentation remains
in Studio; its provider's connection settings remain in Plugins.

## Admin responsibilities

| Surface | Responsibility |
| --- | --- |
| Plugins | Install copies, configure providers, manage credentials, test connections and select named shared inputs |
| Studio | Layout, design, module display options and compatible source selection, with links to source settings |
| Delivery | Cast targets and delivery tools |
| Displays | Hardware, embedded devices and display adapters |

The redundant Data connections list is removed. Runtime and theme packages are
hidden implementation dependencies. Older shared-service and shared-settings
packages remain under Support for compatibility.

## Declared inputs and dependencies

`connectionSchema` describes named inputs, their contracts, their required
`data`, `action` or `stream` hooks, and any conditions that activate them.
Validation rejects incompatible, disabled, missing, self-referencing and cyclic
active inputs before a configuration is applied. Conditional defaults agree with
the provider mode shown in admin.

`internalBindings` separates asset/runtime inputs from editable shared sources.
`packageDependencies` requires another package's code without installing a
configured copy. Instance dependencies install the configured providers or assets
needed by a view. See [manifest fields and examples](PLUGINS.md).

Server-side forwarding uses `context.read` and `context.action`. Forwarded actions
receive the target's validation and invalidate its response cache. Providers keep
secrets on the server; public defaults and descriptors omit protected values.

## Bundled integrations and compatibility

All eleven companion displays install without `ambient-services` or
`ambient-config-source`. Calendar, weather, energy, recovery and portfolio sources
own their provider settings. Clock owns its time zone and location. Media selects
a speaker source and optional launcher. Camera panels own camera selection and
snapshot preferences; camera resources own delivery. Detections have their own
source. News Reader owns RSS, Markdown, JSON or briefing endpoint settings.

Explicit older bindings remain readable. Compatibility adapters may delegate to
independent owners while retaining existing caller payloads. New sources do not
read unrelated account or display configuration. The ambient example uses the
independent model; [the flexible example](../examples/flexible/README.md) shows
external sources shared by different views.

## Verification

Installation and fixture tests cover all companion displays, independent account
copies, deliberate sharing, secret redaction, source contracts and hook validation.
The public suite passes 197 tests, with 10 optional renderer/browser tests skipped
when their dependencies are unavailable. Generated guides and the catalog are
checked separately.

Admin desktop/mobile checks cover compatible source choices, source-settings
links, hidden runtime/theme inputs, camera settings, media inputs and News Reader
feeds. Private migration tests cover preserved layouts and credentials, scoped
actions executed once, compatibility reads, camera range seeking and briefing
isolation. Deployed checks confirm source reads, camera snapshots, media, news and
receiver telemetry. Physical device acceptance and long-term receiver recovery
remain separate from this software architecture verification.
