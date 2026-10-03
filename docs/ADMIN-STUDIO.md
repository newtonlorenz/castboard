# Castboard Studio

Castboard Studio is the visual design surface at `/admin`. It edits the declarative screen model; it is not a second configuration system. The same `screens`, `layout`, `panels`, and `appearance` values remain readable, reviewable JSON on disk.

Use Connections at `/setup` for configuration checks and explicit connection tests. It checks optional executables, shows which providers are demos or require adapters, tests provider connections, reports target counts, and performs user-triggered Cast discovery. It never returns configured receiver names, URLs, headers, tokens, or file paths.

## What it edits

- Project branding and the default screen.
- One or many screens, including title, path, screen type, and visual appearance.
- Fixed grids through cell-based drag and resize plus numeric placement controls.
- Responsive flows through minimum panel dimensions, spans, and panel ordering.
- Single-plugin screens for immersive news, cameras, charts, or other plugins.
- Any discovered custom screen type through generated schema controls and optional layout, position, and size JSON.
- Plugin selection and per-panel options. News is in the same plugin library and follows the same placement and sizing rules as every other plugin.
- Screen-wide typography, palette, density, borders, corners, and shadows. Castboard, Midnight Blue, Warm Paper, Amber Terminal, and Ocean presets are editable starting points.
- Per-panel font, scale, background, accent, text, padding, border, radius, and shadow overrides. Clearing an override returns that panel to the screen theme.
- Optional per-panel auto-fit, which reduces typography only when live content would overflow its panel.

The viewport menu changes only the design simulator. The unsaved draft preview renders at that viewport's real pixel dimensions and then scales the finished screen to fit Studio, so typography and responsive breakpoints match the selected device instead of the editor's canvas size. The real screen route remains responsive to its browser viewport.

Font choices are offline-safe stacks: modern sans, rounded, editorial serif, and monospace. Castboard does not fetch a third-party webfont from a display. Text scale is a percentage from 60 to 180 and changes widget typography without altering the screen grid itself.

## Editing a draft

Studio uses the installed screen renderer for both the editable canvas and the preview. Changes appear before saving, including on new screens. Preview controls are disabled; previewing does not issue receiver heartbeats or run provider actions through the widget SDK.

Select a panel on the canvas or in the panel list. Fixed-grid panels snap to cells at any fit scale. Moving or enlarging one panel rearranges neighbouring panels into free space; if the layout cannot fit, the change is rejected without overlap. Drag a shared edge to resize neighbouring panels together. Named-area layouts can opt into swapping occupied areas and adjusting row/column weights; the example also places new panels automatically by reusing vacant areas, splitting occupied rectangles and growing rows; responsive flow panels support drag reordering and corner resizing. Escape cancels an active drag. Each completed gesture is one undo step. Other renderers expose placement through their schemas or JSON. A new screen asks for a name and layout; its address is generated and remains editable under Advanced. Creation opens the panel picker. Use Add panel to search installed view plugins; a compatible data source is selected when one is available. Panel options and appearance stay in the contextual Panel inspector beside the canvas. Font and heading-font overrides, editable hex colours and zero padding/radius/border values are supported. Supported renderers update draft geometry and appearance in place, retaining running media and module instances.

Undo and Redo apply to design edits. Native text-field undo remains available inside inputs. Discard returns to the saved design. Unsaved valid draft state is stored for this tab and offered for restoration after a reload. Unfinished invalid text is not persisted; correct it before switching selection or saving. A revision conflict leaves the draft intact. **Review latest changes** keeps unrelated saved changes and asks which version to keep where edits overlap; it does not save automatically. The same check runs when restoring a stale draft. Drafts from older versions without a saved baseline require an explicit whole-design choice. Download draft remains available before reconciliation.

On smaller screens, Studio opens on the canvas. Screens & panels, Canvas and Settings switch the visible tools, and selecting a panel opens its settings. Shared settings, advanced layout arrays and appearance controls are collapsible. Keyboard shortcuts: Cmd/Ctrl+S to save; Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z outside text fields to undo and redo.

Screens, Plugins and Connections share the same navigation and control styles. In Plugins, the installed list stays beside the selected plugin’s settings on larger screens. The Library view offers search and category filters, with display plugins listed before supporting sources. Changes remain explicit: use Save settings to apply a plugin draft or Save changes to apply a screen draft.

Plugins keeps a separate draft for each configured copy in the current tab. Switching copies or reloading restores ordinary settings and unfinished invalid input; Reset draft discards that copy’s edits. Passwords, tokens, protected headers and credential-bearing URLs are kept only in memory. After a reload, a notice names the protected values that need re-entry and offers to keep their saved values instead. A save stays blocked until those omissions are resolved. Browser storage must be available for recovery; closing the tab ends the session.

When another window changes plugin settings, **Review latest settings** merges unrelated changes and presents choices for overlapping edits. Protected values remain hidden and need an explicit choice when touched by the draft. Review the reconciled draft before saving. Removing an unused plugin confirms inline and removes its saved private connection values as well.

## What it does not edit

Studio preserves private delivery settings. Plugin data access has its own admin surface:

- Screen `targets`, `castProtocol`, and target-level protocol overrides.
- Casting protocol settings, executables, webhook endpoints, and headers.
- Plugin providers, integration URLs, tokens, filesystem paths, and camera addresses are managed separately in **Plugins** at `/admin/plugins`; protected fields are hidden.
- The server bind address and port.

The admin API constructs a small design projection and never returns those fields. When a design is saved, the server merges it into the raw configuration so `${ENVIRONMENT_REFERENCES}` remain placeholders rather than expanded secrets. A new or duplicated screen starts with no delivery targets. Open **Screen → Set up a display** to manage them in Connections. This opens separately so the editor keeps its draft. Display setup always uses the saved screen.

Plugin defaults and per-panel overrides are distinct: the inspector shows the effective installed defaults, and **Use plugin defaults** removes panel display overrides. **Plugin settings** opens the configured copy’s connection settings and usage.

## Saving and concurrency

**Save changes** performs these steps as one operation:

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

## Connect a display

In **Connections → Your displays**, choose **Set up display** beside a screen.

- **Browser link** gives tablets, TVs and kiosks a copyable address. A local-only server explains that `server.publicUrl` must point to an address the display can reach. URLs containing credentials or query parameters stay on the server.
- **Add a Cast display** lets you discover a device or enter its name/IP address. Give it a friendly display name. Adding saves the connection; it does not start casting.
- **Send screen** sends the saved screen to that configured destination. A successful response confirms the send operation; check the actual display to verify rendering.
- **Remove** asks inline before removing a connection and leaves the receiver's currently displayed screen alone.

Custom protocol targets remain usable. Their endpoints, headers and executable settings stay in server configuration. Disabled protocols must be enabled there before sending. Display changes share the same revision safeguards as screen and plugin saves; refresh after a conflict. Names entered in an unfinished display form survive a refresh within the page.
