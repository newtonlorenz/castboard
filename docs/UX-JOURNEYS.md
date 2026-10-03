# Product journey review

Status: in progress. This is a completion checklist, not a claim that the whole experience has passed.

## Product and user

Castboard lets people build and maintain private information screens for a home, office or shared space. The operator thinks in screens, content and data connections. They need to see a real preview, change it safely, and put it on the intended display. Plugin developers need the same workflows to remain extensible. The admin design does not constrain the appearance of the dashboards it creates.

A good first session gets from a named screen to useful content without learning IDs, JSON, layout internals or server tuning. Ongoing work should preserve context and drafts, make shared settings distinct from panel overrides, and distinguish configuration from a successful data test. Desktop, keyboard and phone use are primary review contexts.

## Journeys and evidence

| Journey | Current evidence | Remaining review |
| --- | --- | --- |
| Create a screen | Name and layout are primary. Address/ID generated, including numbered and accented names; advanced overrides retained. Browser creation leads directly to a visible panel picker. | Check all layout choices, invalid advanced addresses and cancellation. |
| Add content | Picker labels repaired; empty canvas has a clear action. Mobile picker replaces the inspector rather than appearing after it. Installed plugins can prepare a panel directly in Studio. | Named-area example now provides valid initial defaults and insertion hooks; browser-created and saved Clock + Weather. Unit tests cover 18 additions, vacant-area reuse and full-layout splitting. Remaining: private deployment rollout and third-party fallback. |
| Arrange and style | Existing geometry, shared-edge resizing and theme controls retained. Panel options are primary; appearance and technical source overrides are progressive. | Re-run pointer, keyboard, appearance inheritance, source selection and custom layouts after all journey changes. |
| Install a plugin | Library installation generates the copy ID and opens settings in one click. New copy retains custom IDs under Advanced. | Failed installation, disabled dependencies and repeat copies. |
| Configure a plugin | Human-readable provider labels. Advanced transport controls collapsed. Provider-specific fields hidden and disabled without clearing saved values. String arrays use one item per line. No connection test for display-only plugins; modified settings must be saved before testing. | Test every distinct form structure, protected fields, errors, copy removal/recovery and multi-tab conflicts. |
| Add plugin to screen | Browser verification: Weather installed, screen chosen, editable Weather panel created with live preview and explicit save. The one-shot URL parameter is consumed. Used-by links target the specific panel. | Restore/discard existing draft during handoff; full and deleted destination screens. |
| Keep work safe | Existing Studio undo/redo, saved baseline, draft storage and conflict safeguards retained. Current screen preserved in URL when selected/created. | Full interruption/reload/conflict/error journey across Studio and Plugins. |
| Connect and deliver | Existing Connections separates configuration, testing, optional tools and discovery. | Delivery still exposes server configuration/target JSON. Review the end-to-end publish/display workflow; do not send private data to new recipients during testing. |
| Accessibility and responsive use | Explicit labels, live status, primary picker at 390px tested. | Final complete keyboard and narrow-screen journeys, focus recovery, touch targets and error announcements. |
| First run and documentation | Existing starter renders without accounts; public plugin metadata remains portable. | Fresh starter walkthrough and docs/screenshot alignment after implementation. |

## Verification boundary

Use disposable demo configuration for mutations, installation and delivery simulations. Keep private configuration and saved receiver rollback paths outside the public repository. Passing unit tests or a visual review does not prove the full journey is complete; the remaining column must be resolved with current rendered and runtime evidence.
