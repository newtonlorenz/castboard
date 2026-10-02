# Migrating an existing dashboard

1. Capture the current modules, visual layout, endpoint callers, mutations, source semantics and restart behavior. Preserve the old files and serving configuration as a rollback reference.
2. Package integrations as external sources. Preserve calculations and source-specific timezone handling with fixed fixtures. Use explicit versioned contracts; keep credentials and private configuration outside Castboard.
3. Package independent views and theme assets. Select sources and bindings per panel. Use custom screen types where the original layout needs them. Treat a full-screen application as another view, not a special core dashboard mode.
4. Run the candidate separately. Test first-party demo mode without private packages, independently configured instances, shared sources, editor validation, styles/assets and cleanup. Compare the old and new views against the same fixtures.
5. Verify controls, dialogs, streaming/range seeking, failure recovery and restart behavior. A healthy HTTP endpoint alone does not prove receiver rendering or mutation success.
6. Pilot one display at a time. Confirm it requests the candidate, sends healthy panel heartbeats and preserves its controls. Rehearse restoring the old URL. Keep independent collectors and integration services running.
7. Observe for at least seven days. Retain the old serving stack and route compatibility while auditing callers. Distinguish inherited upstream outages from regressions, and roll back affected screens when the candidate repeatedly fails.
8. After the observation and consumer gates pass, replace old API serving with the integration package's compatibility facade. Retain an archived rollback reference. The old dashboard process must no longer be required by sources or views.

A migration is complete when the deployment uses Castboard as its frame, every current capability is retained, and the old monolith is no longer a required runtime dependency. Waiting periods, unavailable upstream services and physical receiver verification should be reported explicitly rather than marked complete from unit tests.
