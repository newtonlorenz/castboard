import { initialNavigation, navigate, interactionLabel } from './interaction-model.js';
import { postPluginAction } from './widget-kit.js';

// The browser and embedded service share navigation semantics. Rendering remains
// separate so opening a modal never disposes or replaces the underlying panels.
export function createInteractionRuntime({ config, screenId, host, preview, mount }) {
  let navigation = initialNavigation(screenId);
  let base;
  let disposed = false;
  let actionPending = false;
  const overlays = [];
  const registrations = new WeakMap();
  const events = new AbortController();
  const message = document.createElement('div');
  message.className = 'display-message'; message.role = 'status'; message.hidden = true;
  document.body.append(message);
  let messageTimer;
  const announce = text => {
    (overlays.at(-1)?.dialog || document.body).append(message);
    message.textContent = text; message.hidden = false;
    clearTimeout(messageTimer); messageTimer = setTimeout(() => { message.hidden = true; }, 5000);
  };
  const confirmations = new Set();
  const confirmAction = text => new Promise(resolve => {
    const dialog = document.createElement('dialog'); dialog.className = 'action-confirmation';
    const title = document.createElement('h2'); title.textContent = 'Confirm action';
    const copy = document.createElement('p'); copy.textContent = text;
    const cancel = document.createElement('button'); cancel.textContent = 'Cancel'; cancel.dataset.castboardUi = 'confirmation';
    const confirm = document.createElement('button'); confirm.textContent = 'Confirm'; confirm.dataset.castboardUi = 'confirmation';
    const done = result => { confirmations.delete(cancelled); dialog.close(); dialog.remove(); resolve(result); };
    const cancelled = () => done(false); confirmations.add(cancelled);
    cancel.onclick = cancelled; confirm.onclick = () => done(true);
    dialog.addEventListener('cancel', event => {event.preventDefault();cancelled();});
    title.id = 'castboard-confirm-title'; dialog.setAttribute('aria-labelledby', title.id);
    dialog.append(title, copy, cancel, confirm); document.body.append(dialog); dialog.showModal(); cancel.focus();
  });
  const renderBase = () => {
    base?.dispose();
    host.replaceChildren();
    base = mount(config.screens[navigation.screenId], host, register, false);
    return base.ready;
  };
  function register(element, context, panel, screen) {
    if (!panel.interaction || config.device?.touch === false) return;
    registrations.set(element, {context, panel, screen});
    element.dataset.interactive = 'true';
    // A real button provides keyboard access without changing a widget's own
    // input semantics or turning its nested controls into an invalid button.
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'panel-interaction';
    button.dataset.castboardUi = 'panel';
    button.textContent = panel.interaction.label || ({modal:'Details',screen:'Open',back:'Back',close:'Close',action:'Run action'}[panel.interaction.type]);
    button.setAttribute('aria-label', interactionLabel(panel.interaction, config.screens));
    element.append(button);
    const observer = new MutationObserver(() => {if (!element.contains(button)) element.append(button);});
    observer.observe(element, {childList:true});
    context.onDispose(() => {observer.disconnect();registrations.delete(element);button.remove();});
  }
  function dismissOverlay() {
    const entry = overlays.pop();
    if (!entry) return;
    entry.view.dispose(); entry.dialog.close(); entry.dialog.remove();
    entry.trigger?.isConnected && entry.trigger.focus();
  }
  function openOverlay(id, trigger) {
    const screen = config.screens[id];
    const dialog = document.createElement('dialog'); dialog.className = 'screen-modal';
    const heading = document.createElement('header'); heading.className = 'screen-modal-header';
    const title = document.createElement('h2'); title.id = `castboard-modal-${overlays.length}`; title.textContent = screen.title || id;
    dialog.setAttribute('aria-labelledby', title.id);
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close'; close.dataset.castboardUi = 'close';
    close.addEventListener('click', () => { void perform({type:'close'}); });
    heading.append(title, close);
    const content = document.createElement('div'); content.className = 'dashboard-grid screen-modal-content';
    dialog.style.setProperty('--modal-width', `${screen.viewport?.width || 800}px`);
    dialog.style.setProperty('--modal-height', `${screen.viewport?.height || 480}px`);
    dialog.append(heading, content); document.body.append(dialog);
    const view = mount(screen, content, register, true);
    overlays.push({dialog, view, trigger});
    dialog.addEventListener('cancel', event => { event.preventDefault(); void perform({type:'close'}); });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) void perform({type:'close'});
    });
    dialog.showModal(); close.focus();
    view.ready.catch(error => announce(error.message));
  }
  async function perform(interaction, registration, trigger) {
    if (disposed) return;
    try {
      if (interaction.type === 'action') {
        if (preview || config.device?.allowActions === false) return announce(preview ? 'Live actions are disabled in preview.' : 'Actions are disabled for this display.');
        if (actionPending) return;
        const panel = registration?.panel;
        if (!panel) throw new Error('This action has no panel');
        const source = interaction.source || panel.source || panel.plugin;
        actionPending = true;
        try {
          if (interaction.confirmation && !await confirmAction(interaction.confirmation)) return;
          if (disposed) return;
          await postPluginAction(source, interaction.action, interaction.payload || {}); announce('Action completed.');
        }
        finally { actionPending = false; }
        return;
      }
      const previous = navigation;
      navigation = navigate(navigation, interaction, config.screens);
      if (interaction.type === 'modal') openOverlay(interaction.screenId, trigger);
      else {
        while (overlays.length > navigation.modals.length) dismissOverlay();
        if (previous.screenId !== navigation.screenId) await renderBase();
      }
      window.dispatchEvent(new CustomEvent('castboard-navigation', {detail:structuredClone(navigation)}));
    } catch (error) { announce(error.message); }
  }
  const capture = event => {
    const path = event.composedPath();
    const element = path.find(node => registrations.has(node));
    const registration = element && registrations.get(element);
    const isPanelButton = path.some(node => node?.dataset?.castboardUi === 'panel');
    const nativeControl = path.some(node => node?.matches?.('button,a,input,textarea,select,video,[contenteditable="true"]'));
    if (event.type === 'click' && registration && (isPanelButton || !nativeControl)) {
      event.preventDefault(); event.stopImmediatePropagation();
      void perform(registration.panel.interaction, registration, element.querySelector('.panel-interaction'));
      return;
    }
    // Preserve modal navigation and keyboard focus while blocking legacy widget
    // handlers that might operate a live provider in the draft preview.
    if (preview && !path.some(node => node?.dataset?.castboardUi) && !(event.type === 'keydown' && ['Tab','Escape'].includes(event.key))) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  for (const type of ['click','submit','keydown']) document.addEventListener(type, capture, {capture:true,signal:events.signal});
  return {
    start: renderBase,
    get navigation() {return structuredClone(navigation);},
    // Registered DOM targets remain the source of browser actions. Native
    // receivers dispatch the corresponding declared panel IDs server-side.
    dispose() {
      disposed = true; events.abort(); base?.dispose();
      for (const cancel of confirmations) cancel();
      while (overlays.length) dismissOverlay();
      clearTimeout(messageTimer); message.remove();
    },
  };
}
