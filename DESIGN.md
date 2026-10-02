---
name: "Castboard Administration"
description: "A proof desk for arranging screens and checking connections."
colors:
  accent: "#2459bb"
  accent-hover: "#194b9f"
  ink: "#202b3c"
  muted: "#556174"
  line: "#d9dfe8"
  paper: "#fff"
  wash: "#f3f5f8"
  bed: "#e5e9ef"
  error: "#a82727"
  field-line: "#bcc7d5"
  field-hover: "#71829a"
  field-label: "#465266"
  selection-fill: "#eaf0fc"
  selection-line: "#c2d3f3"
  canvas-selection: "#609df7"
  status-blue-ink: "#254a8a"
  status-amber-fill: "#f4eddd"
  status-amber-ink: "#7c561b"
  status-error-fill: "#fce8e8"
  status-error-ink: "#982b2b"
  saved: "#268153"
  unsaved: "#976410"
  success-text: "#21673f"
typography:
  page-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "-.02em"
  editor-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "-.02em"
  connection-section:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.45
  panel-section:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.45
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  action:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "14px"
    fontWeight: 550
    lineHeight: 1.45
  detail:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.45
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  status: "4px"
  control: "5px"
  segment: "6px"
  dialog: "10px"
spacing:
  field-gap: "6px"
  action-gap: "8px"
  column-gap: "12px"
  rail: "14px"
  compact: "16px"
  inspector: "18px"
  header: "20px"
  stage: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  button-secondary-hover:
    backgroundColor: "{colors.wash}"
  button-danger:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.error}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "9px 10px"
  status-chip:
    backgroundColor: "{colors.selection-fill}"
    textColor: "{colors.status-blue-ink}"
    rounded: "{rounded.status}"
    padding: "3px 7px"
  screen-selected:
    backgroundColor: "{colors.selection-fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 8px"
  connection-row:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "18px 16px"
---

# Design System: Castboard Administration

## Overview

**Creative North Star: "The Proof Desk"**

The proof desk surrounds an accurately scaled screen draft with paper-white editing rails, a slate canvas bed, blue selection and restrained seams. The interface uses plain labels and compact, familiar controls so selection, unsaved changes and connection checks remain clear.

This system governs the administration surfaces at `/admin` and `/setup` only. Dashboards, panel views and screen renderers retain independent, arbitrarily customizable appearance. Colors, typography, layout geometry and images inside the preview are output content, not admin design tokens.

**Key Characteristics:**
- Neutral editing rails around the actual renderer output.
- Linked panel-list and canvas selection.
- Factual states and explicit connection tests.
- One tool rail at a time above the preview on smaller screens.

## Colors

A working blue accent sits against paper, cool gray surfaces and dark slate text. The YAML above is the normative palette; names below describe application.

### Primary
- **Working blue** (`accent`): primary save/check actions, active navigation, focus, selection labels and native checkbox accents.
- **Deep working blue** (`accent-hover`): primary hover state and selected panel-list text.
- **Selection blue** (`canvas-selection`): the editing outline over a selected panel; the renderer below keeps its own colors.
- **Selection wash and seam** (`selection-fill`, `selection-line`): selected screen and tool surfaces.

### Secondary
- **Saved green and result green** (`saved`, `success-text`): the save-state dot and successful test text, paired with words.
- **Unsaved amber** (`unsaved`): the unsaved-state dot.
- **Configuration amber** (`status-amber-fill`, `status-amber-ink`): demo, adapter, browser-only and optional-tool statuses, as labeled by the source.
- **Failure red** (`error`, `status-error-fill`, `status-error-ink`): validation, failures and blocked configuration states.
- **Configuration blue text** (`status-blue-ink`): neutral configured/custom-module and running-state chips; it does not assert test success.

### Neutral
- **Paper** (`paper`): rails, editable fields and factual connection rows.
- **Control wash** (`wash`): toolbar, helper area, command surfaces and secondary hover.
- **Canvas bed** (`bed`): neutral space around the proof.
- **Slate ink and muted ink** (`ink`, `muted`): primary control text and supporting information.
- **Seam and field strokes** (`line`, `field-line`, `field-hover`): surface division, editable outlines and hover emphasis.
- **Field-label ink** (`field-label`): compact labels above inputs.

**The Output Boundary Rule.** Admin colors and typography belong to the editing interface. Keep dashboard themes, panel appearance and renderer geometry independent.

**The State Has Words Rule.** Pair status color with a factual label or message. A configuration label describes configuration; only an explicit test result describes a connection check.

## Typography

**Interface font:** the platform UI sans stack in the frontmatter. **Code font:** the separate native monospace stack. There is no decorative display role in the admin system.

The scale prioritizes control legibility and factual headings. The body and control base is compact (14px / 1.45). The ordinary browser heading weight resolves to bold; explicit section weights are preserved in the frontmatter.

### Hierarchy
- **Page title:** Connections heading; reduced to (24px) at the connection breakpoint.
- **Editor title:** Screens heading and dialog titles.
- **Connection section:** groups of checks, delivery and server tools.
- **Panel section:** rail and inspector section headings.
- **Body / action:** inputs, navigation and core controls; actions use the observed medium weight.
- **Detail:** connection descriptions and supporting dialog copy.
- **Label:** field labels; secondary metadata uses the same size with regular weight.
- **Code:** JSON textareas and server command strings; textareas resize vertically.

**The Plain Label Rule.** Use sentence-case task and field labels, compact headings and ordinary control text. Reserve monospace for JSON, commands and editable colour codes.

## Layout

The desktop header is (64px) high. The editor fills the remaining viewport with a left rail (228px), a flexible center with a minimum (280px), and an inspector (310px). Rails scroll independently. The center toolbar and helper area frame the stage; the renderer output scales uniformly from the selected viewport with its origin at the top left. Canvas padding is (24px), reducing to (16px) on smaller screens. Field columns split into two equal tracks with a (12px) gutter where appropriate; JSON textarea groups stack.

At (1099px) and below, the header wraps, the editor stacks, and the Screens & panels / Canvas / Settings switcher exposes the relevant rail above the workspace. Tool rails have their own maximum height (52dvh); the inspector stays available through Settings. Tapping a panel selects its Module context and opens Settings; dragging keeps the Canvas tool available for arranging the draft. At (520px) and below, controls and brand simplify, screen lists become one column, and the action row wraps. Between (1100px) and (1400px), header gaps tighten rather than compromising the main editor geometry.

Connections uses a centered container with a maximum width (1180px) and desktop padding (36px 28px 64px). Module rows align in three columns (1.1fr / 1.4fr / 160px) with (24px) gaps; delivery and server rows use (1fr / 2fr / auto). At (720px) and below, column headings hide, identity and action share the first line, and description, results and command details span the full width. Container padding becomes (24px 16px 40px), and search takes the available width.

Spacing is an observed set of functional gaps and paddings, not a synthetic universal scale. Use the role-named spacing tokens for matching contexts; connection sections also have the implemented larger separation (34px).

## Elevation & Depth

Editing rails and connection rows are flat, separated by fine strokes and tonal surfaces. The output frame carries ambient separation from the canvas bed. A selected segmented control has a small lift; dialogs and transient toasts have distinct overlay shadows. Exact shadows, focus outlines, motion and breakpoints are recorded in the sidecar because they are outside the frontmatter token schema. None of these rules constrains the independent dashboard output.

### Shadow Vocabulary
- **Segment selection:** a small contact shadow (`0 1px 3px #202b3c20`).
- **Output frame:** a diffuse proof shadow (`0 10px 30px rgba(0,0,0,.14)`).
- **Dialog:** modal separation (`0 16px 50px rgba(0,0,0,.25)`), with a translucent backdrop (`#17294066`).
- **Toast:** transient feedback (`0 6px 20px #18203020`).

**The Proof Desk Rule.** Use seams and tonal surfaces to organize editing controls. Lift the output frame and transient feedback only where the implemented depth vocabulary supports them.

## Shapes

Controls have gently curved corners; status chips are slightly tighter, segmented containers slightly softer, and dialogs the most rounded. Radius values are normative in the frontmatter. Rails, connection rows and inspector tabs stay square and form continuous working surfaces. Borders are generally (1px); active navigation and inspector tabs use a bottom seam (2px). The canvas selection outline sits inward (2px) to preserve the visible output boundary. The status dot is circular and always accompanied by save-state text.

## Components

### Buttons

Compact, familiar actions with a visible label. Primary, secondary and danger variants share the control radius and base padding from the frontmatter. Their base minimum height is (36px); header and tool-switcher actions become at least (40px) in the stacked editor. Primary hover and pressed states darken the blue. Secondary hover uses the control wash. Danger actions use error text, a pale red border (`#e5c2c2`) and a pale error hover (`#fff0f0`). Disabled controls lower opacity (.5) and use the default cursor. Every control retains the global focus-visible outline (2px with a 3px offset).

### Inputs / Fields

White, full-width inputs have a distinct field stroke, minimum height (40px), and labels above with the field-gap token. Hover strengthens the border. Focus uses the working-blue outline (2px with a 1px offset). Invalid inputs use error strokes and nearby messages; error messages wrap rather than overflowing. Checkboxes use the accent and a native checked state. Color inputs pair a swatch with an editable six-digit hex code including its leading hash. Both controls update the same draft value; invalid codes retain field validation. Reset actions use visible words. Appearance menus offer body and heading fonts with an Inherit choice; renderer-owned defaults remain intact until an explicit override is chosen.

### Navigation

Screens and Connections are plain text links in the white header. The current page has blue text, medium weight and a bottom seam. Inspector tabs use the same seam with a sticky white tab bar; Screen and Module identify their contexts, and active context follows panel selection. The mobile tool switcher instead uses outlined controls and a pale selected surface. Edit / Preview uses a compact segmented control; the selected segment lifts slightly from its gray container.

### Status Chips

Small labels express configuration and tool state. Their fill and text vary by factual state, with compact padding and the status radius from the frontmatter. They are read-only descriptions. Test results appear separately as text; pending actions say Testing… and disable repeat invocation.

### Cards / Containers

The durable pattern is a flat row or working rail, not a freestanding decorative card. Connection rows have paper surfaces, bottom seams, wrapped descriptions and adjacent Test actions. Test output spans the row. The module library uses similarly restrained, full-width selectable rows. Device results have a bordered parent container and fine internal seams.

### Linked Selection and Proof

Selecting an item in the panel roster selects its actual renderer-placed canvas overlay and opens the matching Module inspector. The module name, compatible source and schema-defined options precede placement controls. Appearance is immediately available; identity and advanced JSON remain disclosure sections. The overlay reveals a short panel title and inward blue outline without substituting admin styling for the panel itself.

Renderers that support the editor contract expose their placement behavior directly. Grid dragging rearranges panels without overlaps; named-area layouts swap slots. Flow layouts reorder panels and expose a lower-right resize handle. Shared edges are focusable, labeled separators with orientation and a (14px) interaction strip. Their blue indicator appears on hover, keyboard focus and during dragging; the global focus outline remains visible. Arrow keys adjust a separator along its axis. On an editable panel, arrows move and Shift + arrows resize. Canvas rerenders restore focus to the same panel or separator so repeated keyboard adjustment remains possible.

A completed drag records one undo step. Escape, pointer cancellation and lost pointer capture restore the initial geometry; an impossible placement keeps the prior layout and gives factual feedback. The selected viewport is fitted uniformly, and the preview renders the unsaved draft with screen actions disabled. Optional content fitting reduces text against actual rendered content, including supported module content inside the shadow root. It preserves the chosen appearance scale and leaves renderer geometry intact. Save, error and empty states retain factual messages.

### Dialogs and Transient Feedback

Dialogs use the dialog radius, padding (24px), maximum width (440px) and viewport-safe width (`calc(100% - 32px)`). Toasts use dark ink surfaces, white text and the segment radius, centered above the bottom edge (20px) with a viewport-safe maximum width. Their messages announce through status semantics. Buttons transition only background and text color (.15s); reduced-motion preference removes transitions and smooth scrolling.

## Do's and Don'ts

### Do:
- **Do** apply this system to admin controls while preserving independent dashboard and renderer styling.
- **Do** keep selection synchronized between the panel list, canvas overlay and contextual inspector.
- **Do** preserve selected viewport geometry when fitting the draft into available space.
- **Do** retain renderer-owned appearance defaults until an explicit override is chosen.
- **Do** keep drag changes reversible as one undo step and preserve keyboard focus after canvas updates.
- **Do** retain visible labels, focus outlines and explicit validation or failure messages.
- **Do** reflow tools into the mobile switcher and stack connection descriptions below identity and actions.

### Don't:
- **Don't** treat a configuration state as proof of connectivity.
- **Don't** replace the actual draft with a decorative dashboard mockup.
- **Don't** shrink all three desktop editor columns into a narrow viewport.
- **Don't** turn restrained connection rows into a gallery of raised cards.
- **Don't** propagate preview content fonts, colors or panel shapes into admin tokens.


<!-- Evidence: public/admin.css, public/setup.css, public/admin.html, public/setup.html, public/admin.js, public/setup.js; .impeccable/review/desktop.png, mobile.png, mobile-settings.png, user-672.png, connections-desktop.png, connections-mobile.png. The implemented header is 64px; the direction brief's provisional 56px is not normative. The Studio interaction extension is evidenced by public/studio-model.js, public/appearance-model.js and public/app.js; preview content remains outside this admin token system. -->
