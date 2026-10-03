# Product journey review

Status: complete for the admin UX goal, 3 October 2026. The final walkthrough found no remaining material issue in the reviewed primary journeys. Migration observation and GitHub publication are separate operational gates.

## Product and user

Castboard lets people build and maintain information screens for a home, office or shared space. Operators work with screens, content and connections. They need a real preview, reversible changes and a clear destination for the saved screen. Plugin developers need the same workflows to remain extensible. Admin styling remains independent of dashboard appearance.

A first session goes from a named screen to useful content without requiring IDs or JSON. Advanced transport and arbitrary extension structures remain available when needed. Ordinary configuration, tested data access and physical display acceptance are distinct states.

## Completion audit

| Journey | Current evidence | Result |
| --- | --- | --- |
| Create a screen | Browser-created fixed grid, responsive flow, single-panel and named-area screens, added content and saved. Numbered/accented names generate valid addresses. Empty cancel and reserved-path rejection work. A fresh starter also created and saved a custom layout without an editor adapter. | Pass |
| Add content | Picker search and labels work on desktop and at 390px. Installed plugins can open an unsaved panel directly in Studio. Named-area insertion reuses and splits space; regression tests cover repeated additions and full-layout handling. A schema-only test extension accepts panels and exposes its own placement field. | Pass |
| Arrange and style | Current browser checks: native pointer drag shuffles occupied grid panels; arrows move them; a keyboard separator resizes neighbours; undo restores geometry. Responsive flow supports keyboard reordering and Shift-arrow resizing. Font, hex background and zero padding/radius reached the real preview; clearing overrides restored inherited styles. Changing a custom gauge source updated its meter to the selected source’s value. Named-area geometry regression cases pass. | Pass |
| Install a plugin | Browser-installed an independent Clock copy, rejected a duplicate ID inline and successfully retried. Dependency regression tests cover disabled dependencies without partial changes, reuse by type and cycle rejection. Local packages remain extensible; the library does not claim to download marketplace code. | Pass |
| Configure a plugin | Provider-specific controls, booleans, text/numeric settings, line lists and protected values retain their existing schema semantics. Feed/category records now use ordinary rows. Browser checks cover required URL validation, add/remove/reload/save, independent copies, inherited defaults and copy removal. Advanced arbitrary structures retain the JSON fallback. Legacy URL-only feeds and record limits have regression coverage. | Pass |
| Add plugin to screen | Browser handoff after restoring a draft preserves its original screen edits and adds the panel to the requested destination. Discarding a recovered draft follows the same destination. Full single-panel and deleted destinations show recovery messages without adding content to another screen. | Pass |
| Keep work safe | Separate plugin drafts survive switching and reload. Two-window tests cover unrelated changes, explicit overlapping choices, removed copies across reload and replacement by another plugin with recovery as a separate copy. Protected values are omitted from storage; a concurrent clear requires an explicit choice and removes only the chosen key. An offline save retained its draft and retry succeeded. Studio reconciles stale recovery records against their original baseline. | Pass |
| Connect and deliver | Browser-tested discovery, add/send, offline receiver failure, duplicate validation, cancel removal and form-preserving refresh with a simulated receiver. API tests cover revision conflict, tampered recipient/URL, authentication, private-field projection, concurrent sends and removal. Studio setup opens separately and preserves the draft. Fresh starter Connections clearly identifies sample data and has empty saved-display states. | Pass |
| Keyboard and small screens | Keyboard panel movement/resizing, native labeled inputs and conflict radio choices verified. At 390px Studio has no horizontal overflow and all visible buttons are at least 44px high. Plugin rows, recovery and feed fields stack; actions remain reachable. Delivery focus and status announcements were checked on success/failure. | Pass |
| First run and documentation | Fresh starter loaded all three supplied screen types and its sample data without accounts; RSS stories loaded from its public default feeds. Studio, Plugins and Connections were traversed. Public Studio and Plugins screenshots now show the running interface. Admin/extension documentation covers draft recovery, records and keyboard controls. | Pass |

## Evidence and limits

The current platform suite passes 98 tests. The private dashboard parity and receiver-health suite is checked separately before service refresh. Desktop and mobile visual review returned `ship` for the latest extension; earlier admin, delivery and recovery passes have their own recorded reviews. Screenshots used disposable starter/demo configuration; private data and receiver details are excluded from public assets.

The test browser automatically cancels native beforeunload dialogs. Protected-value recovery and stale Studio restoration were therefore exercised with their actual persisted records in fresh test documents; acceptance of the browser’s own Leave button was not claimed. Ordinary plugin reload, change conflicts and offline retry were exercised directly.

This review does not infer physical touch or legibility from receiver telemetry. The private migration retains its seven-day observation, acceptance and retirement gates, approved recipient scope and saved rollback paths. No real display was cast during these UX tests.

## Follow-up review — 3 October 2026

A second pass covered screen creation, adding a panel, saving, preview, selection, plugin library installation, independent-copy settings, search, display setup, delayed connection tests, rejected access, draft restoration and desktop/tablet/phone layouts. It found and fixed these issues:

| Issue | Fix and verification |
| --- | --- |
| A completed plugin test could replace the unsaved-settings notice and re-enable testing after an edit. | Results apply only to the same unchanged editor. A delayed response now preserves the notice and disabled test action. Failure results also use the error treatment. |
| Filtering Connections during a test could leave its replacement row stuck on Testing. | Completion updates the current row by plugin ID. Delayed test plus filtering now shows the result and re-enables Test. |
| Rejected admin access reopened an unexplained dialog; Studio save failures did not open it. | All three admin routes show an inline rejection message, label the dialog and focus the token field. Mocked rejection/acceptance checks confirm recovery; Studio retains and restores the failed-save draft. |
| Refresh controls remained 36px tall on narrow screens. | The shared header rule now gives them 44px targets below 800px. Verified at 390px and 768px with no horizontal overflow. |
| Record forms changed numeric/boolean enum values into strings, and displayed new-row defaults without saving them. | Typed choices and explicit defaults now match the submitted record. Two regression tests and a browser extension-form fixture cover zero, false, unset values and numeric choices. |

Validation: 98 platform tests and eight private parity/transport tests passed; syntax checks covered 125 JavaScript and 36 JSON files plus the Docker entrypoint. Independent desktop/mobile finish review returned `ship` for this follow-up. Browser failure and delay fixtures were confined to a disposable local starter; no real credentials or receiver targets were changed. The configured PinchTab service returned 503 for tabs, so the existing in-app browser was used.

The design detector reported incumbent 11px metadata/help and legacy palette advisories. The reviewer found no new material readability or layout issue in the supplied captures. No QUALITY BAR card was supplied; the review used the existing Operate contract. Receiver migration status is tracked in the private deployment, independently of this admin review.
