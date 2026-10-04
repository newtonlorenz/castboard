// Shared by browser receivers, embedded receivers and the editor.
export const INTERACTION_TYPES = ['modal', 'screen', 'back', 'close', 'action'];
export const MAX_MODAL_DEPTH = 4;

export function validateInteraction(interaction, screens, plugins, label = 'Interaction') {
  if (interaction === undefined) return;
  if (!interaction || typeof interaction !== 'object' || Array.isArray(interaction)) throw new Error(`${label} must be an object`);
  if (!INTERACTION_TYPES.includes(interaction.type)) throw new Error(`${label} has an unsupported type`);
  const allowed = new Set(['type', 'screenId', 'source', 'action', 'payload', 'label', 'confirmation', 'showButton']);
  for (const key of Object.keys(interaction)) if (!allowed.has(key)) throw new Error(`${label}.${key} is not supported`);
  if(interaction.showButton!==undefined && typeof interaction.showButton!=='boolean')throw new Error(`${label}.showButton must be a boolean`);
  for (const key of ['label', 'confirmation']) if (interaction[key] !== undefined && (typeof interaction[key] !== 'string' || interaction[key].length > 240)) throw new Error(`${label}.${key} must be text up to 240 characters`);
  if (['modal', 'screen'].includes(interaction.type)) {
    if (typeof interaction.screenId !== 'string' || !Object.hasOwn(screens, interaction.screenId)) throw new Error(`${label} references an unknown screen`);
  }
  if (interaction.type === 'action') {
    if (typeof interaction.action !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(interaction.action)) throw new Error(`${label} requires an action name`);
    if (interaction.source !== undefined && (typeof interaction.source !== 'string' || !Object.hasOwn(plugins, interaction.source) || plugins[interaction.source].enabled === false)) throw new Error(`${label} references an unavailable action source`);
    if (interaction.payload !== undefined && (!interaction.payload || typeof interaction.payload !== 'object' || Array.isArray(interaction.payload) || Object.hasOwn(interaction.payload, 'action'))) throw new Error(`${label} payload must be an object without an action override`);
    if (JSON.stringify(interaction.payload || {}).length > 8192) throw new Error(`${label} payload is too large`);
  }
}

export function reachableScreens(screens, initial) {
  const allowed = new Set();
  const visit = id => {
    if (allowed.has(id) || !Object.hasOwn(screens, id)) return;
    allowed.add(id);
    for (const panel of screens[id].panels || []) if (['modal', 'screen'].includes(panel.interaction?.type)) visit(panel.interaction.screenId);
  };
  visit(initial);
  return allowed;
}

export function initialNavigation(screenId) {
  return { screenId, history: [], modals: [] };
}

export function activeScreen(navigation) {
  return navigation.modals.at(-1) || navigation.screenId;
}

export function navigate(navigation, interaction, screens, allowed = new Set(Object.keys(screens))) {
  const next = structuredClone(navigation);
  if (['modal', 'screen'].includes(interaction.type)) {
    if (!allowed.has(interaction.screenId) || !Object.hasOwn(screens, interaction.screenId)) throw new Error('This screen is not available on this display');
    if (interaction.type === 'modal') {
      if (next.modals.length >= MAX_MODAL_DEPTH) throw new Error('Close a detail view before opening another');
      next.modals.push(interaction.screenId);
    } else {
      if (next.screenId !== interaction.screenId) next.history = [...next.history, next.screenId].slice(-20);
      next.screenId = interaction.screenId;
      next.modals = [];
    }
  } else if (interaction.type === 'close') next.modals.pop();
  else if (interaction.type === 'back') {
    if (next.modals.length) next.modals.pop();
    else if (next.history.length) next.screenId = next.history.pop();
  } else if (interaction.type !== 'action') throw new Error('Unknown interaction');
  return next;
}

export function interactionLabel(interaction, screens) {
  if (interaction.label) return interaction.label;
  if (interaction.type === 'modal') return `Open ${screens[interaction.screenId]?.title || 'details'}`;
  if (interaction.type === 'screen') return `Go to ${screens[interaction.screenId]?.title || 'screen'}`;
  if (interaction.type === 'back') return 'Go back';
  if (interaction.type === 'close') return 'Close details';
  return interaction.action?.replaceAll('-', ' ') || 'Run action';
}
