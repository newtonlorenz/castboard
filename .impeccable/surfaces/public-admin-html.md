---
version: 1
slug: "public-admin-html"
primary_target: "public/admin.html"
related_targets: ["public/plugins.html","public/setup.html"]
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
