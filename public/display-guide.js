// Device choices are guidance, not a claim that a receiver has been connected.
export const displayKinds = [
  {id:'cast', name:'Google Nest Hub / Google Cast', detail:'For a Nest Hub, Chromecast or a TV with Google Cast. After saving, find the device on your network and send the screen to it.'},
  {id:'browser', name:'Tablet, TV or computer with a browser', detail:'After saving, open the screen link in the device’s browser. The device must be able to reach your Castboard server.'},
  {id:'echo', name:'Amazon Echo Show', detail:'Use the screen link in Silk, if your model supports it. Castboard has no direct Alexa delivery, and cannot keep the browser open for you.'},
  {id:'embedded', name:'ESP32 / small embedded display', detail:'After saving, open Displays to choose this screen for your ESP32 or register a new receiver. New hardware needs compatible firmware and a display adapter.'},
  {id:'other', name:'Another device / decide later', detail:'You can design now and connect later. Use a browser link, Google Cast, or a compatible custom delivery integration for your hardware.'},
];

export function displayKind(id) {
  return displayKinds.find(kind => kind.id === id) || displayKinds.at(-1);
}

// This is a browser-local setup preference. Actual delivery targets stay server-side.
export function preferredDisplay(screenId) {
  try { return displayKind(localStorage.getItem(`castboard-display-kind:${screenId}`)).id; }
  catch { return 'other'; }
}

export function rememberDisplay(screenId, kind) {
  try { localStorage.setItem(`castboard-display-kind:${screenId}`, displayKind(kind).id); }
  catch { /* Setup remains available when browser storage is disabled. */ }
}
