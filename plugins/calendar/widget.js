import { escapeHtml, title, unavailable, displayRotation } from '/widget-kit.js?v=0.14.0';
import { calendarEvents } from './assets/events.js';
export function mount({ element, config, context }) {
  let data, page = 0, pageCount = 1, size = '';
  element.classList.toggle('calendar-compact',config.compact===true);
  const dateTime = event => {
    if (!event.start) return 'All day';
    const allDay = event.allDay || /^\d{4}-\d{2}-\d{2}$/.test(event.start);
    const date = new Date(allDay ? `${event.start.slice(0,10)}T12:00:00Z` : event.start);
    if (!Number.isFinite(date.getTime())) return '—';
    return new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',timeZone:allDay?'UTC':config.timeZone || context.app.branding.timeZone || 'UTC',...(allDay?{}:{hour:'2-digit',minute:'2-digit'})}).format(date)+(allDay?' · All day':'');
  };
  const render = () => {
    if (!data) return;
    const focus=element.querySelector('button:focus')?.dataset.step;
    const events = calendarEvents(data,config);
    const padding = parseFloat(getComputedStyle(element).paddingTop)+parseFloat(getComputedStyle(element).paddingBottom);
    const capacity = config.eventsPerPage || Math.max(1,Math.floor((element.clientHeight-padding-88)/78));
    const paged = config.layout !== 'scroll' && (config.layout === 'pages' || events.length>capacity);
    element.classList.toggle('calendar-paged',paged);
    pageCount = paged ? Math.max(1,Math.ceil(events.length/capacity)) : 1;
    page = Math.min(page,pageCount-1);
    const visible = paged ? events.slice(page*capacity,(page+1)*capacity) : events;
    const meta = [data.demo || config.demo?'Sample data':'',`${events.length} events`].filter(Boolean).join(' · ');
    element.innerHTML = `${title(config.title || 'Agenda',meta)}<div class="calendar-list">${visible.length ? visible.map(event=>`<article class="calendar-event"><time>${escapeHtml(dateTime(event))}</time><div><strong>${escapeHtml(event.title || event.summary || 'Untitled event')}</strong>${config.showSource===false?'':`<span>${escapeHtml(event.source || 'Calendar')}</span>`}${config.showLocation===true && event.location?`<span>${escapeHtml(event.location)}</span>`:''}</div></article>`).join('') : '<div class="empty-state"><strong>Clear day</strong><span>No upcoming events</span></div>'}</div>${paged && pageCount>1 && config.showControls!==false?`<nav class="calendar-pages" data-castboard-ui="local" aria-label="Agenda pages"><button type="button" data-step="-1" ${page===0?'disabled':''}>Previous</button><span>${page+1} / ${pageCount}</span><button type="button" data-step="1" ${page===pageCount-1?'disabled':''}>Next</button></nav>`:''}`;
    if(focus)element.querySelector(`[data-step="${focus}"]`)?.focus({preventScroll:true});
  };
  context.listen(element,'click',event=>{const button=event.target.closest('[data-step]');if(!button || button.disabled)return;page+=Number(button.dataset.step);render();element.querySelector(`[data-step="${button.dataset.step}"]`)?.focus({preventScroll:true});});
  displayRotation({element,context,enabled:()=>config.autoRotate===true,seconds:()=>config.rotationSeconds || 20,ready:()=>Boolean(data) && pageCount>1,advance:()=>{page=(page+1)%pageCount;render();}});
  const observer=new ResizeObserver(()=>{const next=`${element.clientWidth}:${element.clientHeight}`;if(size!==next){size=next;render();}});observer.observe(element);context.onDispose(()=>observer.disconnect());
  context.schedule(async()=>{try{data=await context.data();element.classList.remove('widget-unavailable');render();}catch(error){data=null;unavailable(element,config.title || 'Agenda',error);}},(config.refreshSeconds || 60)*1000);
}
