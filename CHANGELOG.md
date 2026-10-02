# Changelog

Notable changes are documented here. Castboard follows semantic versioning once releases are published.

## 0.7.0 - 2026-10-02

- Load trusted external plugin, screen-type and delivery-protocol packages without private core patches.
- Configure independent plugin instances, share sources across views, and validate extension-owned data/action contracts.
- Generate Studio controls from extension schemas while preserving advanced JSON editing and integration state.
- Move built-in styles into plugin packages, allow declared assets, and manage widget/server cleanup.
- Preserve MP4 byte-range responses and add bounded Cast retries with optional session reset.
- Add administrative receiver diagnostics and an independent flexible example with two sources and two designs.
- Harden action-name allowlists and prevent proxied receivers from inheriting local administrator access.

## 0.6.1 - 2026-08-22

- Added configurable multi-screen layouts, targets, screen types, and casting protocols.
- Added Castboard Studio with visual layout and appearance controls.
- Added provider diagnostics and a safe first-run initializer.
- Added independent Spotify CLI playback and Sonos integration.
- Added Alpha Vantage ticker watchlists and RSS/Atom news aggregation.
