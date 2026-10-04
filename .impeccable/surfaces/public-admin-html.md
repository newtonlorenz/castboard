---
version: 1
slug: "public-admin-html"
primary_target: "public/admin.html"
related_targets: ["public/plugins.html","public/setup.html","public/devices.html","public/interaction-runtime.js"]
---

# Admin redesign
Mode: Operate. Scope: Screens, Plugins, Connections and shared controls. User requests a dramatic working-interface redesign and has already chosen direct implementation over mockups; continue code-led without another approval round. Preserve every editor, plugin and connection operation.

## Direction contract
THESIS: A drawing studio for real screens: the composition stays central, tools stay orderly, and the same navigation anchors every admin task.
OWN-WORLD: Deep green-black navigation, mineral-white work surfaces, graphite type, evergreen selection, fine neutral seams. Compact native sans, authored 20px line icons, tactile but restrained controls.
STORY: Find a screen, select a panel, adjust it beside the canvas and save. Find plugins by purpose; edit settings without losing the roster. Inspect factual connection results.
FIRST VIEWPORT: A 176px navigation spine, a 68px task header, and an editor with 220px screen rail, expansive drawing bed and 304px inspector. Plugins invert the old hierarchy: a compact searchable roster beside a generous settings workspace; the library opens into categorized cards. Connections use an aligned check list. Primary save stays top-right or in a sticky settings footer.
FORM: Grounded candidate 4, architectural drawing studio, seed fe469cb6. Other candidates: 1 software IDE, 2 broadcast mixer, 3 publication editor, 5 industrial control panel, 6 photographic contact sheet, 7 file catalog. The studio connects the product's actual spatial arranging task to familiar tool rails.
Signature interaction: selection links the screen roster, canvas and inspector; plugin settings follow the chosen row with a brief 160ms reveal, disabled under reduced motion. Responsive navigation becomes a compact labeled rail, then a top bar; editor tools remain reachable without horizontal scrolling.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Challenger decisions: Factory catalog declined (coded navigation obscures tasks); keep disciplined metadata. Gate board declined (time ordering does not describe screens); keep persistent change status. Grid specimen competitive on spatial clarity but weaker on audience identification; keep exact alignment. Labanotation declined (direction/time encoding is alien); keep clear tool separation. Metro declined (panorama hides settings); keep decisive hierarchy. Font specimen declined (type is only one screen setting); keep direct feedback. All are compared on audience identification and product clarity. No new shipping raster is required.

## Embedded displays and interactions extension

This is an ordinary extension of the existing Drawing Studio direction. Displays joins the persistent navigation and reuses the Connections page structure, evergreen actions, mineral surfaces, labeled line icons, fields, factual status chips and dialogs. No new visual world or system-wide token change is introduced; `DESIGN.md` and `.impeccable/design.json` remain the incumbent authority.

Displays presents the receiver identity and resolution, assigned screen, drawing mode, refresh interval, touch setting and observed connection state in aligned rows. Edit, New key and Remove stay beside the relevant receiver. Compatibility details explain native-view gaps, and the image-renderer state remains separate from device connection state. Image and native mode descriptions follow the display list. Registration and settings use a bounded scrolling dialog with a sticky Save display footer; on phones, Refresh and Image format stack into full-width fields so the format choice stays legible. Connection details appear in a separate one-time key dialog.

Studio adds On tap to the selected panel's inspector, with behavior and destination fields, Edit destination and New modal actions, and an optional button label. A modal is another reusable composition with its own dimensions and appearance. Preview follows these interactions without live provider actions; Reset preview restores the edited composition. Runtime modals and confirmations follow dashboard appearance and preserve its independent visual identity under the Output Boundary Rule. Their output colors, type and geometry are not admin-system tokens.

The responsive extension keeps the existing labeled top navigation and stacked Studio tools. Display rows and mode explanations stack on narrow screens. Dialog actions and mobile row actions retain generous touch targets, while the format field spans the mobile form width. Visible labels distinguish configuration, request history, compatibility and errors; no state asserts successful physical display or touch behavior.

## Extension finish evidence

Checked the finished `public/devices.html`, `public/devices.css`, `public/devices.js`, Studio additions in `public/admin.html`, `public/admin.js` and `public/admin.css`, and runtime interaction styles and behavior in `public/styles.css` and `public/interaction-runtime.js` against `PRODUCT.md`, `DESIGN.md` and `.impeccable/design.json`. Feature limitations are recorded in `docs/embedded-displays.md`.

Rendered review evidence is kept in `.impeccable/review/`: `devices-desktop.png`, `devices-mobile.png`, `device-settings-desktop.png`, `device-settings-mobile.png`, `studio-desktop.png`, `studio-mobile.png` and `modal-800.png`. The finish reviewer identified a clipped mobile image-format choice; the finished form stacks that field at narrow widths and retains the sticky Save footer. The reviewer disposition after the fix was ship. These screenshots establish interface appearance, not physical ESP32 validation.

The one-pass detector also reported incumbent color/type/radius drift, native system-font and small-text warnings, plus local Displays type sizes outside the recorded ramp. Several runtime findings belong to independently styled dashboard output. This extension does not repair those findings or promote them into the design system; no approved system change was requested. No new shipping raster was introduced.
