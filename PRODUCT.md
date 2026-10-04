# Castboard

Castboard is an open-source framework for composing dashboards and delivering them to screens. It supports independent data sources, views, screen renderers and delivery plugins. It must remain useful for many designs; a household dashboard is one deployment, not the product specification.

## Administration

People managing their own screens need to add and arrange panels, choose sources, adjust appearance, preview changes and save them without losing work. Screen Studio must accurately show installed renderers, including custom ones. Connections lists configuration and offers explicit tests and device discovery. These pages are used on desktops and smaller devices.

The requested redesign replaces the current admin appearance and verbose, promotional wording. Moving, resizing, previewing, editing settings and saving are all frustrating. Preserve existing settings and extension support. Keep credentials and delivery targets on the server. Keep the dashboards' appearance and functionality intact.

Use direct, factual labels and familiar controls. Important states are loading, selected, unsaved, invalid, saving, failed and saved. Configuration does not prove connectivity: tests must distinguish the two.

## Plugin management

Plugins are reusable packages; panels are configured copies on screens. Admin provides an installed list and a library of bundled and locally installed packages. People can install independent copies, edit their connection defaults, bind sources, test, enable, disable and remove unused copies. Secrets stay on the server and saves preserve unrelated clients and existing configuration. Display-specific options remain in Studio. Shared display packages and portable HTTP source adapters ship with safe demo defaults, without household data or service credentials.

## Embedded displays and interactions

People can register ESP32 and other small receivers in Displays, assign a screen, set resolution and refresh, choose image or native drawing, and control touch and plugin-action access. Each display has a separate connection key shown once when issued; replacing the key or removing the display revokes the previous access. Recent requests and compatibility notices describe server-observed state, without implying that the physical screen or touch hardware has been validated.

Display plugins adapt receiver hardware through package defaults, generated settings, image conversion, native scene encoding and input translation. People can manage bundled, local and uploaded packages from Displays, reach that section from Plugins, and download a monochrome encoder example. Uploading a ZIP requires admin access and an explicit acknowledgement that the package runs trusted code on the server. Each display selects its package and saves its own validated settings; these settings are sent to the receiver and must not contain integration credentials.

An uploaded package cannot be removed while any display uses it, including disabled displays. Removal retains its files for recovery, and replacing a package requires a server restart before reinstalling. Packages do not install firmware or supply hardware drivers automatically. The [display plugin contract](docs/display-adapters.md) defines package limits, hooks, receiver requirements and the example's supported output.

Image mode uses an optional server renderer to preserve browser layouts and plugin controls. Native mode uses explicit plugin views and supported layouts to draw a lightweight scene on the receiver; it does not translate arbitrary HTML. The reference ESP32 library uses RGB565 for images and LVGL for native scenes. Board drivers, installation and observed display/touch checks remain hardware-specific work. [Embedded display documentation](docs/embedded-displays.md) defines supported behavior and limitations.

Panels can open reusable modal compositions, navigate to another screen, go back, close a modal or run a configured plugin action. Modal compositions use the same plugins, arrangement and appearance tools as other screens. Browser modals retain the underlying widgets; native receivers present the composition as a detail page. Studio Preview follows navigation and opens modals while blocking live provider actions, and Reset preview returns to the composition being edited. Action confirmation, when configured, must give people an explicit Cancel and Confirm choice.
