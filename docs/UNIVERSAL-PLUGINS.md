# Plugins for screens of different kinds

These are editorial scores for general usefulness, source flexibility, glanceability and usefulness without touch. They are not hardware compatibility or performance benchmarks. Scores describe the use case; software validation is recorded separately.

| Plugin | Fit / 10 | Critique of our previous version | Implemented response |
| --- | --- | --- | --- |
| Weather & Forecast | 9 | Forecast pages depended on tapping. | Optional timed page rotation; the 24-hour / seven-day overview remains available. |
| Calendar Agenda | 9 | Events could disappear below a short panel, and a time alone did not identify the event’s day. | Adaptive pages, date/time labels, optional automatic rotation, scroll mode and event density. |
| Noticeboard | 9 | Rotation could interrupt long text; changing notices retained the previous scroll position. | Optional automatic text scrolling, fresh scroll position per notice, pause while reading and stable selection through refreshes. |
| Clock | 8 | Useful everywhere, but only supported one place and its sizing depended on viewport rather than panel width. | Up to four additional time zones, independent local dates, validated zones and panel-relative type sizing. |
| News & Briefings | 8 | A narrow strip clipped titles; refreshes could continually restart story rotation. | Full-panel passive headline mode, repaired strip layout, reading-safe rotation independent of source refresh, touch-sized controls and optional controls. |

The first five cover everyday information without requiring a particular home automation ecosystem. Our earlier mistake was treating a long settings list as proof of flexibility. Real flexibility also needs appropriate layouts, understandable source contracts and behavior when nobody can tap the screen.

Five additional packages extend the useful purposes:

| Plugin | Fit / 10 | Good uses | Limits and critique |
| --- | --- | --- | --- |
| Image Slideshow | 9 | Photos, artwork, promotional slides, illustrated instructions | Needs reachable public image addresses; private photo-library authentication is not built in. Browser/image mode displays photos; native mode gives text guidance. |
| Metrics | 8 | Room readings, production totals, attendance, queues and costs | Current readings only; no history or automatic collection. Missing values remain unknown, including when thresholds are configured. |
| Status Board | 8 | Devices, services, rooms and processes | Reports supplied states; it does not independently check service health. Labels accompany colors. |
| Menu & Price List | 8 | Cafes, shop products, services and availability | One currency per panel; it is a display, not a checkout or inventory system. |
| Web Page | 6 | Existing public dashboards and other purpose-made display pages | Some sites block embedding or depend on login/storage. Sandboxed scripts/forms are opt-in; Castboard cannot make every website embeddable. |

Each new data package supports sample, entered, HTTP JSON and local JSON content. Web Page has a public embed address instead. Independent copies can serve different households, rooms, businesses or organizations. Data panels page automatically, can hide controls for passive signage, and allow a per-panel item density.

The [sample configuration](../examples/universal/README.md) demonstrates all ten. Browser tests cover 320×240, 390×844, 1024×600 and 1920×1080, automatic page changes, refresh stability, focus pauses, image loading and iframe isolation. Unit checks validate source shapes, zero/missing values, thresholds, currency prices, public URL restrictions and clock dates across time zones. These checks do not prove physical readability or touch behavior on every device.
