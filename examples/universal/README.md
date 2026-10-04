# Universal display examples

Ten independent full-screen examples, using sample data only. They suit small landscape displays, tablets, Cast receivers and wall screens; each panel adapts to its available area. The clock is at `/`, with the other pages at their package IDs (for example `/weather`, `/metrics`, `/image-slideshow`).

Copy this example to a **new** configuration when trying Castboard. For an existing installation, install packages through Plugins → Library and add them to your screens; do not replace your configuration with this file. Source settings belong to each installed copy; display settings can be overridden per panel.

Weather alternates its 24-hour and seven-day views. Calendar pages the agenda automatically. Long notices scroll before changing. News uses a passive headline layout. The optional controls can be shown for touch displays or hidden for passive signage. Clock includes two additional time zones with their own local dates.

The five new packages start with sample content. For Images, Metrics, Status Board and Menu, choose **Enter here** or HTTP/file JSON and use the [documented contracts](../../docs/PLUGIN-CONTRACTS.md). Web Page accepts a public page address that permits embedding. Images and embedded pages need browser/image mode for visual content; native mode offers a text fallback. No physical-device compatibility is implied by these examples.
