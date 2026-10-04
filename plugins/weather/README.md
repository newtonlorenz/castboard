# Weather

Current conditions, wind, UV, hourly and seven-day forecasts. Install from
**Plugins → Library**, then choose Open-Meteo, sample data, or a JSON endpoint/file.
Location coordinates and source credentials stay on the server.

In Studio, choose current weather, hourly, daily, or current plus forecast. Set
up to 24 hours and seven days. **Fit the panel** switches to Previous/Next pages
when the forecast cannot fit. Both buttons have 44-pixel touch targets, work in
Studio Preview, and can be used by image receivers that only send taps.
**Full forecast** is scrollable and is best for browsers with scrolling input.

Native receivers receive every requested forecast entry as a scrollable list.
Actual scrolling and font support depend on the receiver. Small summary panels
can link to a forecast composition through **On tap → Open modal**.

Hourly timestamps are absolute ISO times; daily dates are local calendar dates.
Unknown measurements remain unavailable. Current-only JSON sources still work;
forecast views report unavailable until arrays are supplied. See the canonical
[payload contract](../../docs/PLUGIN-CONTRACTS.md).

[Open-Meteo documentation](https://open-meteo.com/en/docs) describes the forecast
fields and timezone handling. For package metadata and lifecycle, see
[plugin authoring](../../docs/PLUGINS.md). Code uses the project’s [MIT licence](../../LICENSE).
