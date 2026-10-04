import { createHash } from 'node:crypto';
import { activeScreen, initialNavigation, interactionLabel, navigate } from '../../public/interaction-model.js';
import { deviceError, deviceScope } from './devices.js';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24);
const boundedText = (value, max = 240) => String(value ?? '').slice(0, max);
function appearance(screen, panel = {}) {
  const s = screen.appearance || {}, p = panel.appearance || {};
  return { background: p.background || s.panelBackground || '#14201e', textColor: p.textColor || s.textColor || '#f3faf7', mutedColor: p.mutedColor || s.mutedColor || '#91a49e', accent: p.accent || s.accent || '#8ee6c2', borderColor: p.borderColor || s.borderColor || '#29403a', radius: p.radius ?? s.radius ?? 12, padding: p.padding ?? s.panelPadding ?? 12, fontScale: p.fontScale ?? s.fontScale ?? 100, fontFamily: p.fontFamily || s.fontFamily || 'sans' };
}

export function createNativeScenes({ getConfig, getPlugin, getScreenType, read, action }) {
  const sessions = new Map();
  function session(id, device) {
    const config = getConfig();
    // Invalidate navigation and queued inputs on design, assignment or key changes.
    const revision = hash({ device, screens: config.screens, plugins: config.plugins, branding: config.branding });
    let item = sessions.get(id);
    if (!item || item.revision !== revision) {
      item = { revision, navigation: initialNavigation(device.screenId), events: new Map(), seen: new Map() };
      sessions.set(id, item);
    }
    item.lastSeen = Date.now();
    for (const [key, value] of sessions) if (Date.now() - value.lastSeen > 3600000) sessions.delete(key);
    return item;
  }
  async function build(id, device, item) {
    const config = getConfig(), screenId = activeScreen(item.navigation), screen = config.screens[screenId];
    const type = getScreenType(screen.type || 'grid');
    if (!type?.nativeLayout) throw deviceError('This layout needs image mode', 422);
    const modal = item.navigation.modals.length > 0;
    const offset = modal || item.navigation.history.length ? 48 : 0;
    const viewport = { width: device.width, height: device.height - offset };
    const boxes = await type.nativeLayout(screen, viewport);
    if (!Array.isArray(boxes) || boxes.length !== screen.panels.length || boxes.length > 100) throw deviceError('The native layout returned invalid panel bounds');
    const events = new Map(), images = new Map();
    const panels = await Promise.all(screen.panels.map(async (panel,panelIndex) => {
      const plugin = getPlugin(panel.plugin);
      if (!plugin?.nativeView) throw deviceError(`${plugin?.name || panel.plugin} needs image mode`);
      const bounds = boxes.find(box => box.id === panel.id);
      if (!bounds || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(bounds[key])) || bounds.width <= 0 || bounds.height <= 0 || Object.values(bounds).some(value => typeof value === 'number' && Math.abs(value) > 32767)) throw deviceError('The native layout returned invalid panel bounds');
      let result, state = 'live';
      const options = { ...(plugin.publicConfig?.() || {}), ...panel.options };
      const bindings = { ...plugin.bindings, ...panel.bindings };
      try {
        const source = panel.source || panel.plugin;
        const data = getPlugin(source)?.getData ? await read(source) : {};
        result = await plugin.nativeView({ data, options, panel, screen, branding: config.branding || {}, now: new Date(), read: alias => {
          const sourceId=bindings[alias] || alias;
          if (!deviceScope(config,device).plugins.has(sourceId)) throw deviceError('This source is not assigned to the display',403);
          return read(sourceId);
        } });
        if (!result || !Array.isArray(result.lines)) throw new Error('Invalid native view');
      } catch {
        state = 'unavailable'; result = { title: plugin.name, lines: [{ text: 'Connection unavailable', kind: 'muted' }] };
      }
      let event;
      if (device.touch && panel.interaction && (panel.interaction.type !== 'action' || device.allowActions)) {
        event = `panel:${panel.id}`;
        events.set(event, { interaction: panel.interaction, panel });
      }
      const controls=[];
      for(const [index,control] of (Array.isArray(result.controls)?result.controls:[]).slice(0,8).entries()) {
        if(device.touch && control?.type==='refresh') {
          const eventId=`refresh:${panel.id}:${index}`;
          events.set(eventId,{interaction:{type:'refresh'},panel});
          controls.push({event:eventId,label:boundedText(control.label || 'Refresh',80)});
        }
      }
      if (device.touch && device.allowActions && getPlugin(panel.source || panel.plugin)?.action) {
        for(const [index,control] of (Array.isArray(result.controls)?result.controls:[]).slice(0,8).entries()) {
          if(!control || typeof control!=='object' || control.type==='refresh') continue;
          if(!/^[a-z][a-z0-9-]{0,79}$/.test(control.action || '') || control.payload && (typeof control.payload!=='object' || Array.isArray(control.payload) || Object.hasOwn(control.payload,'action')) || JSON.stringify(control.payload || {}).length>8192) continue;
          const eventId=`control:${panel.id}:${index}`;
          events.set(eventId,{interaction:{type:'action',action:control.action,payload:control.payload,...(control.confirmation?{confirmation:boundedText(control.confirmation)}:{})},panel});
          controls.push({event:eventId,label:boundedText(control.label || control.action,80)});
        }
      }
      let image;
      if(result.image) {
        const spec=result.image, style=appearance(screen,panel);
        const source=spec.source ? bindings[spec.source] || spec.source : panel.source || panel.plugin;
        const params=spec.params || {};
        if(spec.key!==undefined && (typeof spec.key!=='string' || spec.key.length>128))throw deviceError('Invalid native image identity');
        if(!deviceScope(config,device).plugins.has(source) || !getPlugin(source)?.stream || !params || typeof params!=='object' || Array.isArray(params) || Object.entries(params).some(([key,value])=>!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(key) || !['string','number','boolean'].includes(typeof value)) || JSON.stringify(params).length>1024) throw deviceError('Invalid native image resource');
        const width=Math.max(1,Math.min(device.width,Math.floor(bounds.width-style.padding*2)));
        const reserved=(result.title?20:0)+(result.lines.length?result.lines.length*26:0)+controls.length*50+(event && panel.interaction.showButton!==false?50:0);
        const height=Math.max(1,Math.min(device.height,Math.floor(bounds.height-style.padding*2-reserved-6)));
        if(images.size>=4 || [...images.values()].reduce((sum,item)=>sum+item.width*item.height,0)+width*height>device.width*device.height*2) throw deviceError('Native images exceed the display budget');
        const index=String(panelIndex),fit=spec.fit==='cover'?'cover':'contain';
        images.set(index,{source,params,width,height,fit,background:style.background});
        image={index,width,height,format:'rgb565',resourceId:hash({revision:item.revision,screenId,panelId:panel.id,source,params,width,height,fit,background:style.background,key:spec.key || ''})};
      }
      return { id: panel.id, bounds: Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, Math.round(bounds[key] + (key === 'y' ? offset : 0))])), appearance: appearance(screen, panel), title: boundedText(result.title, 80), state,
        lines: result.lines.slice(0, 40).map(line => ({ text: boundedText(line.text), kind: ['metric', 'body', 'muted', 'small'].includes(line.kind) ? line.kind : 'body' })),
        ...(event ? { event, label: interactionLabel(panel.interaction, config.screens), ...(panel.interaction.showButton===false?{eventTarget:'panel'}:{}) } : {}),
        ...(controls.length ? {controls} : {}), ...(image ? {image} : {}),
      };
    }));
    const navigation = [];
    if (device.touch && offset) { events.set('back', { interaction: { type: 'back' } }); navigation.push({ event: 'back', label: modal ? 'Close' : 'Back' }); }
    let confirmation;
    if (item.confirmation) {
      confirmation = { message: item.confirmation.interaction.confirmation, confirmEvent: 'confirm', cancelEvent: 'cancel' };
      events.clear(); events.set('confirm', item.confirmation); events.set('cancel', { interaction: { type: 'cancel' } });
    }
    const scene = { protocol: 'castboard-scene/1', screenId, title: screen.title || screenId, width: device.width, height: device.height, refreshMs: device.refreshMs, background: screen.appearance?.background || '#07100f', modal, navigation, panels, ...(confirmation ? { confirmation } : {}), ...(item.message ? { message: item.message } : {}) };
    scene.sceneId = hash({ revision: item.revision, scene });
    for(const panel of panels)if(panel.image)panel.image.path=`/images/${panel.image.index}?sceneId=${scene.sceneId}`;
    item.scene = scene; item.events = events; item.images=images;
    if (Buffer.byteLength(JSON.stringify(scene)) > 128 * 1024) throw deviceError('The native scene exceeds 128 KiB');
    return scene;
  }
  async function locked(id, device, fn) {
    const item = session(id, device);
    if (item.pending) throw deviceError('Display is busy; retry shortly', 409);
    item.pending = true;
    try { return await fn(item); } finally { item.pending = false; }
  }
  return {
    image(id,device,index,sceneId) {
      const item=session(id,device);
      if(!item.scene || item.scene.sceneId!==sceneId)throw deviceError('The display changed; fetch a fresh scene',409);
      const image=item.images?.get(index);
      if(!image)throw deviceError('This image is not available on the active screen',403);
      return image;
    },
    scene: (id, device) => locked(id, device, item => build(id, device, item)),
    event: (id, device, body) => locked(id, device, async item => {
      if (!device.touch) throw deviceError('Touch is disabled for this display', 403);
      if (typeof body.eventId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(body.eventId)) throw deviceError('Events need a unique eventId');
      const fingerprint = hash(body);
      if (item.seen.has(body.eventId)) {
        if (item.seen.get(body.eventId).fingerprint !== fingerprint) throw deviceError('Event ID already used', 409);
        return item.seen.get(body.eventId).scene;
      }
      if (!item.scene || body.sceneId !== item.scene.sceneId) throw deviceError('The display changed; fetch a fresh scene', 409);
      const target = item.events.get(body.event);
      if (!target) throw deviceError('This control is not available', 403);
      // Reserve before execution. Retrying a lost response cannot operate twice.
      const seen = { fingerprint, scene: item.scene };
      item.seen.set(body.eventId, seen);
      if (item.seen.size > 128) item.seen.delete(item.seen.keys().next().value);
      const { interaction, panel } = target;
      item.message = null;
      if(interaction.type==='refresh') { /* A data refresh cannot operate a provider. */ }
      else if (body.event === 'cancel') item.confirmation = null;
      else if (interaction.type === 'action') {
        if (!device.allowActions) throw deviceError('Actions are disabled for this display', 403);
        if (interaction.confirmation && body.event !== 'confirm') item.confirmation = target;
        else {
          item.confirmation = null;
          try {
            await action(interaction.source || panel.source || panel.plugin, { ...interaction.payload, action: interaction.action });
            item.message = 'Action completed';
          } catch { item.message = 'Action could not be confirmed. Check the connected service before trying again.'; }
        }
      } else {
        item.confirmation = null;
        item.navigation = navigate(item.navigation, interaction, getConfig().screens, deviceScope(getConfig(), device).screens);
      }
      seen.scene = await build(id, device, item);
      return seen.scene;
    }),
    reset(id) { sessions.delete(id); },
    dispose() { sessions.clear(); },
  };
}
