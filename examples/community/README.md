# Shared spaces, households and events

This sample uses only demo and locally entered content. It requires no accounts, credentials, devices or private services.

From the repository root:

```
CASTBOARD_CONFIG=examples/community/castboard.config.example.json npm start
```

Open `http://localhost:8787`. The home screen combines a clock, weather, notices and a countdown. `/news` opens the News Reader; `/forecast` shows the next 24 hours and seven days on two pages. The server port is configurable; stop an existing Castboard server or choose a free port before running this sample.

In **Plugins**, change **Noticeboard → Content source** to **Enter here**, then add messages with optional start/expiry dates. Change **Countdown → Content source** to **Enter here**, then choose the event date. Give each copy a name suited to its purpose. News Reader accepts RSS feeds, canonical JSON, Markdown files or briefing services; try sample stories before connecting a source.

Reuse the layout for a school, reception, workshop or kitchen by changing headings, notices and screen panel overrides. The first admin save creates an ignored `castboard.config.json` beside this sample. Start with that local path on later runs to retain changes. Keep private local configurations out of Git.

Embedded screens can render this layout in image mode. Native views are smaller text representations; camera and rich companion panels need image mode. No physical-device compatibility is implied by the browser previews.
