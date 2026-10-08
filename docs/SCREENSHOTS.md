# Public dashboard images

Repository screenshots show the running Castboard app, using
[`castboard.config.example.json`](../castboard.config.example.json). The capture
script uses the bundled demo news provider instead of fetching external feeds.
It does not read private deployment configuration, credentials or receiver data.

The hero is a direct Home dashboard capture. Studio and Plugins are captures of
the real admin interface. Use these captures as references when creating artwork
or device mockups; keep the dashboard's actual panels, layout, typography and
controls visible instead of inventing a replacement interface.

To refresh the assets, install the optional renderer dependencies and browser:

```sh
npm ci --prefix services/frame-renderer
cd services/frame-renderer && npx playwright install chromium && cd ../..
node scripts/capture-preview.mjs
```

An existing Chrome installation can be selected using `CASTBOARD_CHROMIUM_PATH`.
The script starts an isolated server on a temporary local port, then closes the
browser and server. Capture sizes are 1280 × 800 for dashboards and 1440 × 960
for admin pages. The clock and bundled demo providers may vary with capture time.

The logo source is `public/assets/castboard-logo.svg`; the PNG is rendered from
that vector source. Preserve its transparent background and clear space.
