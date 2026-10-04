# Contributing

Thanks for helping improve Castboard.

1. Discuss substantial UI, provider, or plugin-contract changes in an issue first.
2. Keep the core dependency-free unless a dependency removes significantly more risk than it adds.
3. Never commit credentials, private feed URLs, household coordinates, account IDs, or device addresses.
4. Add or update tests for config, routing, normalization, and security-sensitive behavior.
5. Run `npm test` and `npm run check` before opening a pull request.

Plugins should fail soft: a missing backend should produce a useful unavailable state without taking down a screen.

## Browser and receiver checks

The core has no runtime npm dependencies. Browser integration tests use the
optional renderer's locked dependencies and Node.js 22 or later:

```sh
npm ci --prefix services/frame-renderer
npx --prefix services/frame-renderer playwright install chromium
CASTBOARD_BROWSER_TESTS=1 node --test services/frame-renderer/test/*.test.js
```

`CASTBOARD_BROWSER_TESTS=1` enables the browser cases that the default `npm test`
run skips. Set `CASTBOARD_CHROMIUM_PATH` to use an existing Chromium executable.
Optional `CASTBOARD_CAPTURE_DIR` saves review screenshots; use a temporary folder
outside the repository and only demonstration data.

Receiver changes also need the compile and image-format checks described in
[Embedded displays](docs/embedded-displays.md). The image-format harness uses
`CXX` if supplied, otherwise `c++`. A passing compile does not verify a physical
board's display, touch calibration or reconnect behaviour.
