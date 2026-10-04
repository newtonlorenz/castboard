---
version: 1
slug: "public-admin-html"
primary_target: "public/admin.html"
related_targets: ["public/plugins.html","public/setup.html","public/devices.html","public/interaction-runtime.js"]
---

# Admin redesign
Mode: Operate. Scope: Screens, Plugins, Connections, Displays and shared controls. User requests a dramatic working-interface redesign and has already chosen direct implementation over mockups; continue code-led without another approval round. Preserve every editor, plugin and connection operation.

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

## Display plugin management extension

Display plugin management extends the incumbent Drawing Studio in Displays. It uses the same deep green navigation, mineral page background, evergreen actions, fine row seams, labeled controls and viewport-bounded dialogs. The Plugins task header links directly to the Display plugins section. This is an ordinary surface extension: `DESIGN.md` and `.impeccable/design.json` remain unchanged, and no new visual world, composition study or shipping raster is introduced.

The package list sits below registered displays as continuous rows. Each row presents its name, version, description, origin, supported drawing modes and display usage, with expandable connection instructions. Upload plugin and Download example sit beside the section heading. Uploaded packages have a labeled Remove action; assigned packages disable it and show In use. The removal confirmation explains file retention and the restart required before reinstalling. Bundled and local packages have no removal control in this list.

Upload plugin expands the inline upload form and focuses the ZIP field. The form states the archive limit and required package contents, discloses that code runs on the Castboard server, and requires an explicit trust checkbox. Installation shows a pending label, keeps failures beside the form, and reports success at the package list with focus on the installed row. Download example supplies the monochrome encoder package described in `docs/display-adapters.md`; this is a receiver-format example, not automatic hardware setup.

Display settings adds a Display plugin selector and description above schema-generated labeled controls. Selecting a package applies its offered defaults, drawing modes, formats and option fields; saved options remain specific to each display. The reviewed example exposes a black/white threshold and inversion control. These use the existing fields and checkbox patterns inside the scrolling dialog, with Cancel and Save display in the sticky footer. Admin appearance follows the existing system while encoded screen content remains governed by the Output Boundary Rule.

On desktop, package metadata stays with its identity and Remove sits alongside it. On phones, rows stack, heading actions wrap, instructions and file controls stay within the page width, and upload copy and trust acknowledgement remain readable. Package removal and installation controls are at least 44px tall, and disclosure targets reach that height at the narrow breakpoint. Generated settings remain full width; Width and Height stay paired, while Refresh and Image format stack. The dialog scrolls within the viewport and retains its action footer, including at the bottom of the mobile form.

## Display plugin finish evidence

Checked `public/devices.html`, `public/devices.js`, `public/devices.css` and the link in `public/plugins.html` against `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` and the contract in `docs/display-adapters.md`. The fresh finish review returned ship with no material fixes. Rendered evidence in `.impeccable/review/` was checked for the installed list, upload disclosure and form, generated settings and bottom-of-dialog actions: `display-plugins-desktop.png`, `display-plugins-mobile.png`, `display-upload-desktop.png`, `display-upload-mobile.png`, `display-plugin-settings-desktop.png`, `display-plugin-settings-mobile.png` and `display-plugin-settings-mobile-bottom.png`. This evidence records the Admin interface and does not establish physical receiver validation.

The detector report at `/private/tmp/castboard-display-plugin-design-findings.json` identifies inherited 11px labels, Displays type sizes outside the recorded ramp (15px, 16px and 28px), and the Plugins collection control's border color outside the recorded palette. These findings are recorded as drift, not repaired or promoted into new system tokens: this work extends the existing surface without an approved design-system change.

## Compact overview extension

This ordinary extension preserves the Drawing Studio direction and seed `fe469cb6`. Studio adds Show action button beneath Action label in On tap, using the existing labeled checkbox and helper-copy pattern. The default retains the visible action. Turning it off makes the panel the pointer target while retaining a labeled keyboard-focusable control and a visible focus outline; the widget's own buttons, links and inputs keep their behavior. Initial canvas rendering now refits the selected viewport so its preview and editing overlay align.

Clock, Weather, Solar, Calendar and Vehicle expose Compact layout as a panel option, allowing overview and detail instances of the same plugin. Camera adds Shortcut mode, which avoids loading imagery in the overview and can open a separate camera composition. A shortcut retains a readable title or action label when its visible action button is disabled. Browser modals fill viewports at most 320px high, reserving a 48px header for the title and Close; detail content occupies the remaining height. Native modals remain detail pages.

The public `examples/embedded/compact.config.json` is a 320 × 240 composition with compact clock, weather and UV, solar, calendar, vehicle and camera shortcut panels; weather, calendar and camera open detail compositions. Demonstration data is labeled Sample. Its dark output palette, dense typography, panel geometry and full-viewport runtime dialogs are independent dashboard content under the Output Boundary Rule. They establish no new admin theme, system tokens or mandatory screen layout. `DESIGN.md`, `PRODUCT.md` and `.impeccable/design.json` remain unchanged; no shipping raster is introduced.

## Compact overview finish evidence

Checked the Studio controls in `public/admin.html` and `public/admin.js`, behavior in `public/interaction-runtime.js`, runtime styles in `public/styles.css`, the compact plugin widgets/styles and camera native view, the public example, and `docs/embedded-displays.md` against the incumbent system. Rendered evidence in `/private/tmp/castboard-overview-captures/` covers all `overview-*` and `camera-*` captures: desktop and phone output, the 320 × 240 overview, Studio at desktop and phone widths, forecast/calendar/camera modals, the camera shortcut with its action button hidden, and camera snapshot, stream and retained-image failure states. Colored camera frames are test fixtures, not live-camera evidence.

The fresh finish review returned ship after the camera shortcut label and initial canvas-fit fixes, with no regressions observed in that bounded review. The final desktop Studio capture shows the 320 × 240 composition fitted at 219% with its editing overlay aligned. These captures establish browser appearance only; physical native display and touch remain unverified by this review.

The detector report at `/private/tmp/castboard-overview-design-findings.json` records inherited 11px admin labels and colors outside the recorded admin palette. Runtime color, type and radius findings, including the solar flow radius, sit across the output boundary and are not promoted into admin tokens. No unrelated drift is repaired or canonized during this extension.
