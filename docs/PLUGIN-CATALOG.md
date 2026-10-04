# Plugin catalog

Install from **Plugins → Library**. Give each copy a name and connect its sources. Use screen panel overrides to reuse a source in different layouts. All packages are MIT licensed. Package IDs are retained for existing configurations.

The library separates complete display plugins, companion dashboard panels, data connectors and support packages. Use complete display plugins for canonical JSON, ICS, RSS and direct integrations. Companion panels offer coordinated styling through the shared theme and runtime; their source adapters can connect canonical plugins or a compatible service bridge.

| Name | Purpose | Category | Guide |
| --- | --- | --- | --- |
| Camera Alerts | Review camera detections supplied by the connected camera resources. | Dashboard panels | [`ambient-alerts`](../plugins/ambient-alerts/README.md) |
| Calendar Timeline | Show a timeline of events from a calendar adapter, with a configurable look-ahead period. | Dashboard panels | [`ambient-calendar`](../plugins/ambient-calendar/README.md) |
| Calendar Adapter | Convert a connected calendar plugin or shared service into the timeline format used by dashboard panels. | Data connectors | [`ambient-calendar-source`](../plugins/ambient-calendar-source/README.md) |
| Camera Panel | Browse cameras and snapshots from connected camera resources. Choose a camera name and image refresh timing. | Dashboard panels | [`ambient-camera`](../plugins/ambient-camera/README.md) |
| Clock Panel | Show time and date using shared display settings, with optional time zone and location overrides. | Dashboard panels | [`ambient-clock`](../plugins/ambient-clock/README.md) |
| Shared Display Settings | Provide shared location and display settings to companion panels. | Data connectors | [`ambient-config-source`](../plugins/ambient-config-source/README.md) |
| Focus Strip | Show current and next events from a connected calendar, with editable empty-state text. | Dashboard panels | [`ambient-focus`](../plugins/ambient-focus/README.md) |
| Display Link Launcher | Open links on a configured cast device through the local cast command. | Data connectors | [`ambient-launch-source`](../plugins/ambient-launch-source/README.md) |
| Speaker Controls | Show speaker playback and optional controls using the connected speaker source. | Dashboard panels | [`ambient-media`](../plugins/ambient-media/README.md) |
| Speaker Source | Connect speaker playback and actions to dashboard panels, using sample data or a compatible web service. | Data connectors | [`ambient-media-source`](../plugins/ambient-media-source/README.md) |
| News Reader | A full-screen news reader with categories, automatic rotation and article view. Choose briefing services, RSS, Atom, Markdown or JSON. | Dashboard panels | [`ambient-news`](../plugins/ambient-news/README.md) |
| Portfolio Panel | Show account totals and positions supplied by a portfolio adapter. Choose a title, row limit and update timing. | Dashboard panels | [`ambient-portfolio`](../plugins/ambient-portfolio/README.md) |
| Portfolio Adapter | Provide portfolio data to dashboard panels from a compatible upstream plugin or shared service. | Data connectors | [`ambient-portfolio-source`](../plugins/ambient-portfolio-source/README.md) |
| Wellbeing Panel | Show recovery, sleep and strain supplied by a wellbeing adapter. Choose which measurements appear. | Dashboard panels | [`ambient-recovery`](../plugins/ambient-recovery/README.md) |
| Wellbeing Adapter | Provide recovery, sleep and strain data to dashboard panels from an upstream plugin or shared service. | Data connectors | [`ambient-recovery-source`](../plugins/ambient-recovery-source/README.md) |
| Camera Resources | Provide camera lists, snapshots and detections to camera panels from sample data or a compatible service. | Data connectors | [`ambient-resources`](../plugins/ambient-resources/README.md) |
| Display Runtime | Shared display behavior required by companion dashboard panels. It has no user-facing panel. | Support | [`ambient-runtime`](../plugins/ambient-runtime/README.md) |
| Shared Service Connector | Connect dashboard adapters to sample data or a compatible service endpoint. Credentials stay on the server. | Data connectors | [`ambient-services`](../plugins/ambient-services/README.md) |
| Energy Panel | Show generation, use and grid flow supplied by an energy adapter. Choose a title and numeric precision. | Dashboard panels | [`ambient-solar`](../plugins/ambient-solar/README.md) |
| Energy Adapter | Provide power and grid-flow data to dashboard panels from an upstream plugin or shared service. | Data connectors | [`ambient-solar-source`](../plugins/ambient-solar-source/README.md) |
| Dashboard Theme | Shared visual styles required by companion dashboard panels. It has no user-facing panel. | Support | [`ambient-theme`](../plugins/ambient-theme/README.md) |
| Current Weather Panel | Show current conditions supplied by a weather adapter. Choose Celsius or Fahrenheit and update timing. | Dashboard panels | [`ambient-weather`](../plugins/ambient-weather/README.md) |
| Weather Adapter | Provide current weather to dashboard panels from an upstream plugin or shared service. | Data connectors | [`ambient-weather-source`](../plugins/ambient-weather-source/README.md) |
| Calendar Agenda | Show upcoming events from an ICS calendar or JSON source. Choose an event horizon, calendars, locations and update timing. | Display plugins | [`calendar`](../plugins/calendar/README.md) |
| Camera Viewer | Show a live stream or refreshing snapshots from a camera service or Home Assistant. Control image fit, titles and update timestamps. | Display plugins | [`camera`](../plugins/camera/README.md) |
| Clock | Show local time, a different time zone, or a clock for any location. Choose date style, language and 12- or 24-hour time. | Display plugins | [`clock`](../plugins/clock/README.md) |
| Countdown | Count down to an event, deadline or opening time. Choose a target date and show a completion message or time elapsed. | Display plugins | [`countdown`](../plugins/countdown/README.md) |
| Focus Agenda | Show the current or next calendar event, with optional wellbeing context and your own empty-state message. | Display plugins | [`focus`](../plugins/focus/README.md) |
| News & Briefings | Show news from RSS, Atom, Markdown or JSON. Choose feeds, filter stories and control reading and update timing. | Display plugins | [`news`](../plugins/news/README.md) |
| Noticeboard | Display announcements, instructions and welcome messages. Enter notices here or connect JSON; optionally schedule each notice. | Display plugins | [`noticeboard`](../plugins/noticeboard/README.md) |
| Recovery & Wellbeing | Show a wellbeing score from a JSON source. Adjust score thresholds, detail visibility and update timing. | Display plugins | [`recovery`](../plugins/recovery/README.md) |
| Energy Monitor | Show generation, consumption and grid flow from Fronius or JSON. Choose watts or kilowatts, labels and precision. | Display plugins | [`solar`](../plugins/solar/README.md) |
| Sonos Player | Show playback and optional controls through a compatible Sonos service. Choose artwork, device labels and update timing. | Display plugins | [`sonos`](../plugins/sonos/README.md) |
| Spotify Player | Show Spotify playback from the local player CLI or JSON. Choose artwork, device labels and playback controls. | Display plugins | [`spotify`](../plugins/spotify/README.md) |
| Markets & Portfolio | Show a ticker watchlist from Alpha Vantage or portfolio positions from JSON. Choose currency, rows and display mode. | Display plugins | [`stocks`](../plugins/stocks/README.md) |
| Vehicle Status | Show battery, charging and range from Home Assistant or JSON. Choose entities, units, labels and visible measurements. | Display plugins | [`vehicle`](../plugins/vehicle/README.md) |
| Weather & Forecast | Show local conditions and forecasts from Open-Meteo or JSON. Choose location, units and forecast layout. | Display plugins | [`weather`](../plugins/weather/README.md) |

For reusable home, lobby and event layouts, see [the sample screens](../examples/community/README.md). For input formats, see [source contracts](PLUGIN-CONTRACTS.md). For failure recovery and privacy, see each package guide.

<!-- Generated by scripts/plugin-docs.mjs. -->
