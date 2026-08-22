# Screen types

Screen types control layout only. They do not know which plugins provide panel content or which protocol delivers the screen to a device.

## Built-in types

### `grid`

A fixed grid suited to known display dimensions. Configure `layout.columns`, `layout.rows`, optional `gap`/`padding`, and a `position` for every panel.

```json
{
  "type": "grid",
  "layout": { "columns": 12, "rows": 8, "gap": 8, "padding": 8 },
  "panels": [
    { "id": "weather", "plugin": "weather", "position": { "column": 1, "row": 1, "width": 4, "height": 2 } }
  ]
}
```

### `flow`

A responsive, scrollable auto-fit layout for tablets, browsers, and displays with unknown dimensions. Configure `minPanelWidth`, `minPanelHeight`, `gap`, and `padding`. A panel may provide `size.columns` and `size.rows` spans.

### `single`

One plugin-backed panel fills the screen. This is useful for a camera, news wire, chart, map, or another immersive module. Exactly one panel is required.

## Adding a type

Create a directory under `screen-types/` whose name is a lowercase ID:

```text
screen-types/timeline/
  type.js
  renderer.js
```

`type.js` is loaded on the server and validates private configuration:

```js
export function createScreenType() {
  return {
    id: 'timeline',
    name: 'Timeline',
    validateScreen(screen, screenId) {
      if (!screen.layout?.axis) throw new Error(`screens.${screenId}.layout.axis is required`);
    }
  };
}
```

`renderer.js` is served to the display and positions panels:

```js
export function prepare({ container, screen }) {
  container.style.display = 'flex';
  container.style.flexDirection = screen.layout.axis === 'vertical' ? 'column' : 'row';
}

export function place({ element, panel }) {
  element.style.order = panel.position?.order || 0;
  element.style.flex = panel.size?.grow || 1;
}
```

Only `screen.type`, `screen.layout`, and panel display data reach this renderer. Targets and casting settings remain server-side.
