# Castboard Studio

Castboard Studio is the visual design surface at `/admin`. It edits the declarative screen model; it is not a second configuration system. The same `screens`, `layout`, `panels`, and `appearance` values remain readable, reviewable JSON on disk.

## What it edits

- Project branding and the default screen.
- One or many screens, including title, path, screen type, and visual appearance.
- Fixed grids through cell-based drag and resize plus numeric placement controls.
- Responsive flows through minimum panel dimensions, spans, and panel ordering.
- Single-plugin screens for immersive news, cameras, charts, or other modules.
- Any discovered custom screen type through generic layout, position, and size JSON.
- Plugin selection and per-panel options. News is in the same plugin library and follows the same placement and sizing rules as every other module.

The viewport menu changes only the design simulator. It helps check a layout at common Nest Hub, tablet, small-display, and TV aspect ratios; the real screen route remains responsive to its browser viewport.

## What it does not edit

Delivery and data access stay in the private configuration:

- Screen `targets`, `castProtocol`, and target-level protocol overrides.
- Casting protocol settings, executables, webhook endpoints, and headers.
- Plugin providers, integration URLs, tokens, filesystem paths, and camera addresses.
- The server bind address and port.

The admin API constructs a small design projection and never returns those fields. When a design is saved, the server merges it into the raw configuration so `${ENVIRONMENT_REFERENCES}` remain placeholders rather than expanded secrets. A new or duplicated screen starts with no delivery targets; add them in `castboard.config.json` before casting.

## Saving and concurrency

**Save & apply** performs these steps as one operation:

1. Require the revision that the editor originally loaded, preventing an older browser tab from overwriting a newer change.
2. Merge the design into the private raw configuration.
3. Expand environment values and run core, screen-type, and plugin validation.
4. Write a mode-`0600` temporary file and atomically rename it into place.
5. Replace the running public screen configuration. Open displays detect a changed design and refresh within five seconds, without restarting or recasting Castboard. A changed route moves the existing display to its new path.

If Castboard started from `castboard.config.example.json`, the first save creates the gitignored `castboard.config.json`. The tracked example is never overwritten.

## Access control

Requests from the same machine are allowed by default. The editor can be disabled:

```json
"admin": { "enabled": false }
```

For a trusted LAN only, set a bearer token through the environment:

```json
"admin": {
  "enabled": true,
  "allowLan": true,
  "token": "${CASTBOARD_ADMIN_TOKEN}"
}
```

The browser asks for this token and stores it in session storage for the current tab. Do not publish the admin route through an internet-facing proxy.
