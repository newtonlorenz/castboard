# Ambient Camera

Live camera images with automatic stream fallback.

Install from **Plugins → Library**, then configure the installed copy in admin. Use **Add to a screen** to place a panel; its options are also available in Studio.

Admin settings: Title, Preferred camera name, Image refresh · milliseconds.

Panel options: Title, Preferred camera name, Image refresh · milliseconds.

Camera health follows decoded images. Failed AI checks preserve a working fallback stream, and camera discovery retries if its service was unavailable at startup. Fallback connections renew periodically to recover stalled streams; AI images resume when their source recovers. The image refresh setting also determines how long a rendered AI image remains current.

Required packages: ambient-runtime, ambient-theme, ambient-config-source, ambient-services, ambient-resources. Admin connects these automatically when installing.

See [Ambient setup and contracts](../../docs/AMBIENT-PLUGINS.md). For package metadata, lifecycle and privacy, see [plugin authoring](../../docs/PLUGINS.md).

Code is covered by the project’s [MIT licence](../../LICENSE). Share code and assets; keep deployment settings and credentials private.
