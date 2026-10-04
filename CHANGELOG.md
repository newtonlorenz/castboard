# Changelog

Notable changes are documented here. Castboard follows semantic versioning once releases are published.

## 0.14.0 - 2026-10-05

- Improve five everyday plugins for screens with or without touch: automatic weather pages, adaptive calendar paging with date labels, reading-safe notice scrolling, world clocks and passive news headlines.
- Keep rotation independent of data refresh; pause while someone reads or interacts and preserve focused controls across refreshes.
- Add Image Slideshow, Metrics, Status Board, Menu & Price List and Web Page. The library now includes 42 packages. Data packages support sample, entered, HTTP and file content; the embed uses a public page URL.
- Keep zero and missing values distinct, show status words with colors, validate prices and thresholds, and isolate embedded pages with opt-in scripts/forms.
- Add generic full-screen examples, a candid plugin evaluation, source contracts, generated configuration guides and browser tests at small, phone, smart-display and TV sizes.

Existing IDs, connections and screen layouts remain compatible. Pictures and embedded pages require browser/image mode for visual output; their native view is a text fallback. Some websites prohibit embedding. No additional physical hardware was tested.

## 0.13.0 - 2026-10-04

- Clarify names, purposes, categories, settings and per-copy labels across all bundled plugins. News Reader replaces the Office Wire presentation; existing package and instance IDs remain compatible.
- Add configurable RSS feeds, feed pauses, keyword/category/source filters, duplicate removal, story age and ordering, source refresh and display controls. News Reader also supports canonical JSON and Markdown sources alongside briefing services.
- Add Noticeboard and Countdown with sample, inline, HTTP and file content, scheduled announcements, local date/time controls, completion/elapsed modes and browser/native views. The library now includes 37 packages.
- Expand clock, calendar, camera, weather, energy, wellbeing, portfolio, vehicle and media display controls. Weather forecast overview fits the next 24 hours on one page and seven days on a second page.
- Preserve configured companion sources when adding panels. Fix Fahrenheit feels-like readings, missing and zero values, uncertain currency conversion, empty/error states, optional shared settings, news list actions and reader stability during updates.
- Bound local provider reads, validate source URLs and string/date settings, escape external calendar labels and keep authentication out of display defaults.
- Generate package guides and a catalog from manifests, check documentation drift, and add reusable sample layouts for households and shared spaces. Remove unused copied widget helpers.
- Add regression coverage for every display at 320×240, phone and desktop sizes, plugin configuration, source privacy, notices and countdowns.

Names and configuration keys remain backward compatible. New options inherit sensible defaults; panel overrides affect only that panel. Source credentials remain server-side. Image mode is required for rich companion views and live video; native views are intentionally smaller. This release adds software checks, not physical verification of additional boards.

## 0.12.0 - 2026-10-04

This release brings together the admin and plugin updates since v0.6.1 with the
new embedded display receiver, hardware plugin system and MCP interface.

- Rework the admin around Screens, Plugins, Displays and Connections, with clearer setup guidance for browser, Google Cast and embedded devices.
- Add drag-to-rearrange panels, shared-edge resizing, undo/redo, saved drafts, conflict recovery, in-editor plugin settings, and consistent appearance controls.
- Manage plugin instances in admin, including the Ambient collection, compact weather/solar/calendar views, and vehicle status; 35 bundled plugins now include configuration guides.
- Add image and native receiver protocols, scoped connection keys, display health, refresh controls and an optional isolated Chromium image renderer.
- Include an ESP32 Arduino receiver for LVGL 8.4 and 9.x and a Freenove FNK0104B board example. Other boards need matching firmware and display/touch drivers.
- Upload trusted hardware adapter ZIPs in Displays, configure per-device options, and extend image formats, native scenes and input translation without private core patches.
- Share screen navigation, reusable modals and panel actions across browser and embedded displays. Improve small-screen close targets and retain valid close taps across background image refreshes.
- Improve camera stream recovery, decoded-frame health, scoped native snapshots, manual refresh and optional timestamps over the image.
- Add a dependency-free stdio MCP bridge with 16 tools, documentation resources, redacted configuration reads, validation previews and revision-checked saves.
- Add Node 20/22, Chromium interaction and ESP32 compile checks to CI, with regression coverage for device authorization, package validation, camera recovery and stale touches.

Existing screen and plugin configurations remain supported. Embedded receivers
are optional: image mode requires the separate renderer, and native mode uses
plugin-provided views and receiver fonts. Installing a hardware plugin does not
flash firmware. Keep private configuration, device keys and board credentials
outside the repository.

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
