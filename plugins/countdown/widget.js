import { escapeHtml, title } from '/widget-kit.js?v=0.13.0';
import { countdownState, countdownText } from './assets/model.js';
export function mount({element,config,context}) {
  let data = null, error = '';
  element.classList.add('countdown');
  const render = () => {
    let body;
    if (!data) body = `<p>${escapeHtml(error || 'Loading event…')}</p>`;
    else {
      const state = countdownState(data,config);
      const date = config.showDate === false ? '' : new Intl.DateTimeFormat(config.locale || undefined,{timeZone:config.timeZone || context.app.branding.timeZone || 'UTC',dateStyle:'medium',timeStyle:'short'}).format(new Date(state.target));
      body = `<div class="countdown-content"><h2>${escapeHtml(data.title || 'Event')}</h2><p class="countdown-value" role="timer">${escapeHtml(countdownText(state,config))}</p>${date ? `<time datetime="${escapeHtml(data.target)}">${escapeHtml(date)}</time>` : ''}<p class="countdown-description">${escapeHtml(data.description || '')}</p></div>`;
    }
    element.innerHTML = `${title(config.title || 'Countdown',error ? 'Source unavailable' : data?.demo ? 'Sample data' : '')}${body}`;
  };
  context.schedule(async () => { try { data = await context.data(); countdownState(data); error = ''; } catch { data = null; error = 'Event unavailable. Check its date and source in Plugins; retrying automatically.'; } render(); },(config.refreshSeconds || 60)*1000);
  context.schedule(render,config.showSeconds ? 1000 : 10000);
}
