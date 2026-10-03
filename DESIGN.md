---
name: "Castboard Administration"
description: "A drawing studio for arranging real screens and configuring their plugins."
colors:
  accent: "#246653"
  accent-hover: "#194c3e"
  ink: "#24302c"
  muted: "#5c6862"
  placeholder: "#66716a"
  line: "#dce2dc"
  paper: "#fff"
  wash: "#f6f7f3"
  bed: "#e8ece6"
  selection: "#e5efe6"
  nav: "#202e29"
  nav-ink: "#eaf0ea"
  nav-muted: "#c2cfc6"
  nav-selected: "#3b5243"
  field: "#fcfdfb"
  field-line: "#c7d1c6"
  field-hover: "#92a890"
  field-label: "#4c5d52"
  canvas-selection: "#7cca9a"
  error: "#b03832"
  saved: "#3c8059"
  unsaved: "#a66e21"
  switch-off: "#788773"
  status-fill: "#e6eee0"
  status-ink: "#38553a"
  status-amber-fill: "#f5eddd"
  status-amber-ink: "#7d602d"
  status-error-fill: "#f9e9e5"
  status-error-ink: "#99382f"
typography:
  page-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "30px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-.035em"
  detail-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "24px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-.025em"
  canvas-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "20px"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "-.03em"
  section-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "-.02em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  description:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  action:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
  field:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.5
  metadata:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  badge: "4px"
  chip: "5px"
  field: "6px"
  control: "7px"
  selection: "8px"
  summary: "10px"
  container: "12px"
  dialog: "14px"
spacing:
  field-gap: "7px"
  action-gap: "8px"
  compact: "12px"
  roster: "16px"
  inspector: "20px"
  workspace-gap: "24px"
  detail: "28px"
  page: "36px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "7px 13px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "7px 13px"
  button-danger:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.error}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "7px 13px"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.field}"
    padding: "8px 10px"
  nav-selected:
    backgroundColor: "{colors.nav-selected}"
    textColor: "{colors.paper}"
    rounded: "{rounded.selection}"
    padding: "11px"
  status-chip:
    backgroundColor: "{colors.status-fill}"
    textColor: "{colors.status-ink}"
    rounded: "{rounded.chip}"
    padding: "4px 7px"
  screen-selected:
    backgroundColor: "{colors.selection}"
    textColor: "{colors.ink}"
    rounded: "{rounded.selection}"
    padding: "12px 10px"
  plugin-container:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.container}"
    padding: "28px"
  switch-off:
    backgroundColor: "{colors.switch-off}"
    height: "18px"
    width: "32px"
    rounded: "{rounded.summary}"
  conflict-dialog:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
    padding: "28px"
    width: "calc(100% - 32px)"
  segment-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "5px 13px"
---

# Design System: Castboard Administration

## Overview

**Creative North Star: "The Drawing Studio"**

A drawing studio for real screens: deep green navigation anchors mineral-white tools around a dotted drawing bed. Graphite text, evergreen selection, fine seams and compact controls make the work legible without competing with the composition. The same navigation and task header join Screens, Plugins and Connections.

This system governs `/admin`, `/admin/plugins` and `/setup`. Dashboards, panel views and screen renderers retain independent, arbitrarily customizable appearance. Fonts, colors, imagery and geometry inside the preview are output content, not admin tokens.

**Key Characteristics:**
- Persistent navigation with labeled line icons.
- A central composition with linked selection and contextual tools.
- A compact plugin roster beside generous settings; a separate library card grid.
- Factual states, visible focus and restrained motion.

## Colors

Evergreen controls and green-black navigation frame mineral whites, sage grays and graphite text. The frontmatter is normative; these names explain each color's purpose.

### Primary
- **Evergreen** (`accent`, `accent-hover`): primary save actions, links, focus, selected context, checkbox and switch states.
- **Sage selection** (`selection`): selected screens, panel rows and inspector tabs. The installed-plugin row has its own closely related surface (`#e5efe3`).
- **Canvas green** (`canvas-selection`): inward editing outlines over the rendered output.

### Secondary
- **Saved green / unsaved amber** (`saved`, `unsaved`): save-state dots, paired with status text.
- **Configuration sage** (`status-fill`, `status-ink`): factual configuration chips, not a successful-test assertion.
- **Configuration amber** (`status-amber-fill`, `status-amber-ink`): demo and adapter labels.
- **Failure clay** (`error`, `status-error-fill`, `status-error-ink`): validation, failed checks and blocked states.

### Neutral
- **Green-black navigation** (`nav`, `nav-ink`, `nav-muted`, `nav-selected`): the persistent navigation spine and its readable selected state.
- **Mineral paper and wash** (`paper`, `wash`): editing surfaces and surrounding page background.
- **Drawing bed** (`bed`): the neutral sage-gray canvas surround, patterned with small regular dots.
- **Graphite and supporting ink** (`ink`, `muted`, `placeholder`, `field-label`): primary text, supporting text, placeholders and field labels.
- **Seams and editable strokes** (`line`, `field-line`, `field-hover`): panel boundaries and field affordances; `field` gives inputs a faint mineral tint.
- **Inactive switch** (`switch-off`): a visible off-state track, distinct from the white thumb.

**The Output Boundary Rule.** Apply admin tokens to editing controls. Keep dashboard themes, panel appearance and renderer geometry independent.

**The State Has Words Rule.** Pair state colors with factual labels. Configuration and enable state do not prove connectivity; an explicit test produces the connection result.

## Typography

**Interface font:** the native UI sans stack in the frontmatter. **Code font:** the separate native monospace stack. This is a compact working interface; page headings establish hierarchy through size, weight and tight tracking.

### Hierarchy
- **Page title:** Plugins and Connections headings; reduces to (27px) in their narrow layouts.
- **Detail title:** plugin settings identity; reduces to (20px) at the intermediate plugin breakpoint.
- **Canvas title:** the selected screen heading; reduces to (18px) on phones.
- **Section title:** connection groups and selected module headings.
- **Body / description:** inherited interface text and explanatory prose. Page descriptions stop at (70ch); plugin descriptions stop at (65ch).
- **Action:** labeled buttons; smaller contextual actions use (11–12px).
- **Field / label / metadata:** compact inspector values, labels and supporting identity. Plugin settings use (13px) values with (12px) labels; badges use (10px).
- **Code:** JSON textareas and editable color codes. Connection commands use (11px) monospace.

**The Working Type Rule.** Use compact native sans for interface headings and controls, sentence-case labels, and monospace for JSON, commands and editable color codes.

## Layout

The desktop app starts with a fixed navigation spine (176px) and a task header (68px). Screens uses a screen rail (220px), flexible center with minimum width (280px), and inspector (304px). Rails scroll independently. The heading and toolbar sit above the dotted stage; helper text sits below. The stage has (26px) padding and fits the actual selected viewport uniformly, with the output transform anchored at the top left. Fields use two equal tracks with a (12px) gutter where suitable; JSON groups stack.

Between (1100px) and (1320px), navigation contracts to a labeled icon rail (76px), and editor sidebars become (200px / 288px). At (1099px) and below, the same compact navigation remains, editor tools switch between Screens & panels, Canvas and Settings, and the workspace stacks. Screens and inspector have bounded scroll areas. At (600px) and below, navigation becomes a fixed top strip (64px), the task actions form a compact grid, and Save spans two tracks. Stage padding becomes (16px); the canvas tool has a viewport-related height with a minimum (360px). A selected panel opens its Module inspector; drag interactions keep the arranging surface available.

Plugins uses a centered page up to (1600px), with desktop padding (34px 36px 40px). Installed mode pairs a compact roster (290–360px) with a flexible settings area of at least (360px), separated by (24px). Settings and roster have independent bounded scrolling; settings stays (24px) from the top with an internal sticky action footer. At (1600px) and wider, the roster becomes (380px) and the gutter (32px). Intermediate breakpoints at (1100px) and (1000px) tighten tracks, padding and identity. At (760px) and below, roster and settings stack, the roster is bounded to (260px), settings scrolls with the page, and its footer becomes static. Library mode uses a responsive grid of cards with minimum width (250px), becoming one column in the narrow layout.

Connections uses a centered container up to (1340px), with padding (36px 36px 64px). Connection rows align identity, description and actions in tracks (1.1fr / 1.3fr / 168px); delivery and runtime rows use (1fr / 1.8fr / auto). At (1100px), tracks and spacing tighten. At (800px), headings hide and descriptions/results span beneath identity and action; at (600px), actions stack and page padding becomes (26px 16px 36px).

Spacing tokens are functional gaps and paddings observed in the implementation, not a fabricated universal scale. Preserve the distinct density of a compact roster, a settings workspace and the drawing stage.

## Elevation & Depth

The app is primarily flat: tonal surfaces, thin strokes and restrained corner changes separate tools. The dotted bed locates the canvas without decorating the output. Output and overlays receive diffuse shadows; selected segments and switch thumbs have small contact shadows. Exact shadow values, motion and breakpoints live in the sidecar.

- **Output frame:** two soft shadows separate the actual screen from its drawing bed.
- **Dialog / toast:** stronger modal depth and lighter transient depth distinguish overlays from the work surface.
- **Segment / switch:** small contact shadows identify the selected segment and switch thumb.

**The Working Surface Rule.** Organize controls with seams and tonal surfaces. Reserve substantial shadows for the output frame, dialogs and transient feedback.

## Shapes

Controls and fields have gently curved corners. Selected screen and navigation rows are softer; plugin containers, library cards and connection-list groups use the container radius. Dialogs are the softest large surface. Radii are normative in the frontmatter. Internal roster and connection rows remain continuous within their outer container. Fine borders are generally (1px); the canvas selection outline sits inward (2px) to retain the true output boundary. Status dots and switch thumbs are circular.

Authored SVG line icons identify navigation and plugin types. Navigation icons are (20px), with stroke width (1.7), rounded caps and joins. Disclosure arrows are small stroked CSS chevrons; they rotate with open state. Neither pattern licenses decorative glyph icons.

## Components

### Buttons

Compact, labeled actions use the frontmatter's common padding and control radius, with a base minimum height (36px). Primary actions are evergreen with white text and a deeper hover/pressed state. Secondary controls are white and gain a pale wash and stronger seam on hover. Danger controls retain white with clay text and a pale clay seam/hover surface. Disabled opacity is (.42). Global keyboard focus is a visible accent outline (2px), offset (3px). Button color and border transitions last (160ms), ease-out.

### Inputs / Fields

Full-width fields use a mineral tint, a distinct stroke, labels above, and minimum height (38px); plugin settings inputs use (40px). Hover strengthens the stroke; focus uses the accent outline (2px), offset (1px). Errors stay near the field and wrap. Textareas resize vertically. Color controls pair a swatch and editable six-digit hex value with a labeled Reset action. Inherit remains available for screen and panel appearance.

Plugin boolean settings use a compact switch (32px × 18px) with a white thumb (14px). The off track stays visibly outlined by its color; checked changes the track to evergreen and moves the thumb (14px). Native checkbox semantics and focus remain intact. Password fields disclose whether a value is configured and offer Clear saved value; unchanged blanks preserve existing secrets.

### Navigation and Segments

The persistent rail uses labeled line icons, muted light text, and a lighter green selected surface with a fine border. Hover brightens the row. At narrower widths it remains labeled; on phones it becomes the top navigation. Inspector tabs use a pale selected fill. Edit / Preview and Installed / Library use inset segmented containers with a white selected segment and small contact shadow.

### Status Chips

Small factual labels pair semantic text and color. Configuration, demo, adapter and blocked states use the documented palette. Installed-plugin enable state is inline text with a small dot, distinct from the filled connection chip. Testing and Saving messages describe pending work and suppress repeated actions. Failure messages remain visible near the relevant form or check.

### Cards / Containers

Plugin roster, settings and connection groups have white or mineral surfaces, a fine perimeter seam and rounded outer corners. Installed rows stay contiguous; hover and selection distinguish the active row. Library mode uses separate cards with a plugin line icon, identity, short description and Install action. Connection groups use aligned rows with adjacent Test/Configure actions and full-width result blocks. Resting containers have no large decorative shadow.

### Plugin Roster and Settings

Installed mode keeps search, category and collection controls above the roster. Selecting a row reveals settings beside it; identity, usage and enable state remain visible. Source connections and usage follow schema-defined settings. The action footer keeps Save settings, Reset draft, enable state and Remove together, with Remove separated where width permits. Saving locks draft and roster controls together until completion; a failed save preserves the draft and announces failure.

Recovery notices sit inline above plugin settings on a wash surface, with the selection radius and roster padding. Factual text explains the retained draft and the next action; secondary buttons have a minimum height (40px). At (800px) and below, recovery, plugin settings and roster buttons have a minimum height (44px).

Settings has a short vertical reveal (3px over 160ms, ease-out). This motion and switch/disclosure transitions are removed under reduced-motion preference.

### Linked Selection and Screen Canvas

Selecting a panel links its roster row, actual renderer placement and Panel inspector. The canvas overlay provides an inward green outline and compact evergreen label. The output retains its own appearance. Schema options precede placement; appearance is available immediately, while identity and advanced JSON use disclosures.

Grid dragging rearranges without overlap, named-area layouts swap slots, and flow layouts reorder with a lower-right resize handle. Shared edges use labeled, focusable separators and an interaction strip (14px); their indicator appears on hover, focus or drag. Arrow keys adjust the active separator or panel; Shift + arrows resizes a panel. Rerendering restores keyboard focus. A drag records one undo step; Escape, pointer cancellation and lost capture restore its initial geometry. Invalid placement preserves the prior layout and reports what happened.

Preview shows the unsaved draft at the chosen viewport with screen actions disabled. Optional content fitting works against actual rendered content and preserves the chosen appearance scale and renderer geometry. Save, empty, error and loading states use factual messages.

### Display Setup

Connections begins with a continuous list of screens. Each row has Open screen and Set up display; expanding it reveals the browser link, saved destinations and an Add a Cast display disclosure inline. A form separates the human-readable name from the receiver address. Discovery fills the form only when the user chooses a result. Adding and sending are separate actions.

Destinations retain their names beside Send screen and Remove. Removal confirms inline, with Keep display focused first. Pending operations disable repeat actions, restore focus and announce a factual result. Failed sends retain the destination; unsuccessful saves preserve the form. Narrow layouts stack links and fields, keep actions at least 44px high and avoid horizontal scrolling.

### Dialogs and Feedback

Dialogs use the dialog radius, padding (28px), a viewport-safe width and an ordinary maximum width (440px). A translucent dark-green backdrop separates them from the editor. Toasts use navigation-dark surfaces and white text near the bottom edge, with status announcements. Reduced-motion preference removes animation, transitions and smooth scrolling across the admin interface.

Conflict review is shared by Screens and Plugins. It expands the ordinary dialog to a maximum width (560px), caps its height at (85dvh) and scrolls within the viewport. Each field has a legend and two native radio options, Your draft and Latest saved. Options have a minimum height (48px), compact padding (12px), and the field radius; the selected option uses the selection fill. Labels and value summaries wrap, with supporting values in muted ink. Protected values are described without being displayed.

The conflict action footer stays visible while the dialog scrolls, using the paper surface, top padding (16px) and action gap. Keep editing preserves the draft; Update my draft resolves the choices before a separate save. Dialog action buttons have a minimum height (44px) at (800px) and below.

## Do's and Don'ts

### Do:
- **Do** apply this system to admin controls while preserving independent dashboard and renderer styling.
- **Do** synchronize selection between the panel list, canvas overlay and contextual inspector.
- **Do** preserve the selected viewport geometry when fitting the draft into available space.
- **Do** retain renderer-owned appearance defaults until an explicit override is chosen.
- **Do** keep drag changes reversible as one undo step and preserve keyboard focus after canvas updates.
- **Do** retain visible labels, focus outlines and explicit validation or failure messages.
- **Do** keep installed-plugin settings beside the roster on wide screens and stack them on narrow screens.

### Don't:
- **Don't** treat a configuration or enable state as proof of connectivity.
- **Don't** replace the actual draft with a decorative dashboard mockup.
- **Don't** shrink all desktop editor columns into a narrow viewport.
- **Don't** apply library-card layout to the continuous installed-plugin roster or connection rows.
- **Don't** propagate preview content fonts, colors or panel shapes into admin tokens.

<!-- Evidence: public/admin.css, public/admin.html, public/admin.js, public/plugin-admin.css, public/plugins.html, public/plugin-admin.js, public/setup.css, public/setup.html. The later Shared admin workspace cascade and page overrides are normative for this authorized redesign. Superseded blue proof-desk declarations remain source maintenance debt, not current design tokens. No dashboard/output theme is standardized here. -->
