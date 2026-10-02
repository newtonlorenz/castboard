# One source, many designs

Run from the Castboard root:

```
CASTBOARD_CONFIG=examples/flexible/castboard.config.example.json npm start
```

Open http://localhost:8788. Two independent `readings` instances feed a number view and a gauge view each. The views share a data contract while owning completely different CSS. An external named-area renderer controls layout. None of these modules are required by Castboard's normal configuration.

Change source values in the configuration. Use the editor for panel options, named areas, row weights, and colors. The first editor save writes an ignored local `castboard.config.json` beside the example; use that path on subsequent starts to keep saved changes. Create another instance by adding a `plugins` entry with the same `type`. Add another renderer or module directory to extend the platform without changing its core.
