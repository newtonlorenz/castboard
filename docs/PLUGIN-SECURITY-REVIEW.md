# Plugin release security review

Reviewed for 0.13.0 on 2026-10-04. Scope: the bundled plugin library, shared provider helpers, configuration validation, browser rendering, public asset access, admin/action authorization and release diff. Improvements were applied under the requested plugin-readiness work.

## Findings resolved

| Severity | Confidence | Finding | Evidence and resolution |
| --- | --- | --- | --- |
| Medium | High | External calendar source labels could inject HTML into the timeline. | `plugins/ambient-calendar/widget.js` interpolated a source label into HTML. It now escapes that label. The browser regression supplies an HTML-like label and verifies it remains text with no injected element. Existing CSP also restricts executable content. |
| Medium | High | A file provider read the complete file before checking its size. | `src/core/providers.js` now allocates at most the configured byte limit plus one and stops reading at that boundary. Unit checks cover the exact limit, oversized input and safe missing-file errors. |
| Low | High | Invalid bridge prefixes and URL credentials were accepted until request time. | HTTP source validation rejects unsupported schemes and URL user information. Service prefixes reject query/fragment components; authentication belongs in protected headers. Local-network HTTP sources remain supported intentionally. |

## Verification

The core has no third-party runtime dependencies. `npm audit --package-lock-only --audit-level=high` for the renderer lockfile reported zero known vulnerabilities across 34 dependency entries. GitHub CI independently installs the lockfile and runs its audit. An advisory check cannot prove the absence of unknown vulnerabilities.

A location-only scan of the tracked and new release files found no private keys, GitHub tokens, AWS access keys or Google API keys. Address/path matches were existing generic tests, a documented example inverter address and the public `castboard-home.jpg` filename. Configuration files, environment secrets and board credentials remain ignored. No private installation configuration, screenshots or provisioned firmware are included in this release.

Source credentials are excluded from schema-derived display defaults and verified by registry/provider tests. New Noticeboard and Countdown responses retain only documented content fields. News, announcements and calendar labels are escaped; story markup uses a restricted renderer. Dynamic camera resources retain origin/path allowlists, and media/service actions retain explicit action/route allowlists. External executable arguments use the existing shell-free command runner.

Regression tests cover provider-size bounds, supported URL schemes, settings constraints, configured source copies, source privacy, browser text escaping, widget disposal and receiver authorization. Existing admin authorization, application-host checks and scoped embedded-device keys remain in place.

## Trust and limits

Administrators deliberately select local files, service endpoints and commands. External plugin and hardware packages load trusted server code. This review does not convert those features into a sandbox or certify a private integration service. Do not publish personal feed contents, tokens or account payloads as canonical display data. Physical board behavior needs separate device testing; browser and compile checks verify software behavior only.

## 0.14 universal plugins

The additional data packages reuse bounded HTTP/file readers and private server-side headers. Canonical record projection removes unrecognized source fields; text is escaped before display. Public image and embed addresses reject active schemes and embedded credentials. Images load directly in the display browser and receive no source authentication headers. The Web Page iframe is sandboxed: scripts/forms are opt-in, and same-origin privileges, popups and top-level navigation are never granted. Embedding restrictions remain controlled by the target site. No dependency was added.

Display pages permit configured Web Page origins and HTTP/HTTPS image loads, so local-network pictures work without changing admin restrictions. Studio’s isolated preview permits public HTTP/HTTPS frames for unsaved embed options. Admin retains its same-origin frame policy. A browser test uses a second local origin to verify image loads, script-enabled frame rendering, blocked access to the parent and unchanged admin policy.
