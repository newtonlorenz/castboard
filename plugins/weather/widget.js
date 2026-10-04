import { escapeHtml, formatNumber, title, unavailable } from '/widget-kit.js';
import { forecastPages } from './assets/forecast.js';

function weatherIcon(code) {
  const sun='<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>';
  const cloud='<path d="M5 17h13a4 4 0 0 0 .3-8 6.5 6.5 0 0 0-12-1A4.5 4.5 0 0 0 5 17Z"/>';
  let shape=code===0?sun:cloud;
  if(code===null || code===undefined)shape='<path d="M7 12h10"/>';
  else if(code>=95)shape=cloud+'<path d="m13 15-3 5h4l-2 3"/>';
  else if(code>=71 && code<=77 || code>=85 && code<=86)shape=cloud+'<path d="M8 20h.01M12 22h.01M17 20h.01"/>';
  else if(code>=51)shape=cloud+'<path d="m8 20-1 2m6-2-1 2m6-2-1 2"/>';
  return `<svg class="weather-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shape}</svg>`;
}
const number=value=>value===null || value===undefined || value===''?'—':formatNumber(value,0);
const temperature=value=>`${number(value)}°`;

export function mount({ element, config, context }) {
  let data,pageIndex=0,lastSize='';
  element.classList.add('weather-widget');element.classList.toggle('weather-compact',config.compact===true);
  const dateLabel=(value,options)=>{
    const date=new Date(value);if(!value || Number.isNaN(date.getTime()))return '—';
    try{return new Intl.DateTimeFormat(undefined,options).format(date);}catch{return new Intl.DateTimeFormat(undefined,{...options,timeZone:'UTC'}).format(date);}
  };
  const current=()=>`<div class="weather-main"><span class="weather-icon">${weatherIcon(data.code)}</span><strong class="weather-temp">${temperature(data.temperatureC)}</strong><span class="weather-condition">${escapeHtml((data.condition || 'Conditions unavailable')+(config.compact && config.demo?' · Sample':''))}</span></div><div class="weather-detail">Wind ${number(data.windKph)} km/h · UV ${number(data.uvIndex)}</div>`;
  const rows=(kind,items,zone)=>items.length?`<div class="weather-rows">${items.map(item=>`<div class="weather-row" data-forecast-time="${escapeHtml(kind==='hourly'?item.time:item.date)}"><time>${escapeHtml(kind==='hourly'?dateLabel(item.time,{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:zone}):dateLabel(`${item.date}T12:00:00Z`,{weekday:'short',timeZone:'UTC'}))}</time><span class="weather-row-icon" title="${escapeHtml(item.condition || '')}">${weatherIcon(item.code)}</span><strong>${kind==='hourly'?temperature(item.temperatureC):`${temperature(item.highC)} <span class="weather-low">${temperature(item.lowC)}</span>`}</strong><small aria-label="Chance of rain">${number(item.precipitationProbability)}%</small></div>`).join('')}</div>`:'<p class="weather-empty">Forecast unavailable</p>';
  const render=(forcePaged=false)=>{
    if(!data)return;
    const mode=config.view || 'current',zone=data.timeZone || context.app.branding.timeZone || 'UTC';
    const paged=mode!=='current' && (forcePaged || config.forecastLayout==='paged' || config.forecastLayout!=='full' && element.clientHeight<420);
    element.dataset.weatherView=mode;element.dataset.weatherPaged=String(paged);
    let body='',meta=config.label ? config.label+(config.demo?' · Sample':'') : data.label,pager='';
    if(paged){
      const pages=forecastPages(data,config,element.clientHeight-parseFloat(getComputedStyle(element).paddingTop)-parseFloat(getComputedStyle(element).paddingBottom));pageIndex=Math.min(pageIndex,pages.length-1);
      const page=pages[pageIndex];meta=page.label+(config.demo?' · Sample':'');body=page.kind==='current'?current():rows(page.kind,page.items,zone);
      pager=`<nav class="weather-pagination" aria-label="Forecast pages"><button type="button" data-castboard-ui="local" data-weather-step="-1" ${pageIndex===0?'disabled':''}>Previous</button><span aria-live="polite">${pageIndex+1} / ${pages.length}</span><button type="button" data-castboard-ui="local" data-weather-step="1" ${pageIndex===pages.length-1?'disabled':''}>Next</button></nav>`;
    }else{
      if(mode==='current' || mode==='forecast')body+=current();
      if(mode==='hourly' || mode==='forecast')body+=`<section class="weather-forecast"><h3>Next hours</h3>${rows('hourly',(Array.isArray(data.hourly)?data.hourly:[]).filter(hour=>Date.parse(hour.time)+3600000>Date.now()).slice(0,config.hours || 12),zone)}</section>`;
      if(mode==='daily' || mode==='forecast')body+=`<section class="weather-forecast"><h3>Coming days</h3>${rows('daily',(Array.isArray(data.daily)?data.daily:[]).slice(0,config.days || 7),zone)}</section>`;
    }
    element.innerHTML=`${config.compact && mode==='current'?'':title(config.title || 'Weather',meta)}<div class="weather-content">${body}</div>${pager}`;
    const content=element.querySelector('.weather-content');
    if(!paged && mode!=='current' && config.forecastLayout!=='full' && content.scrollHeight>content.clientHeight+1)render(true);
  };
  context.listen(element,'click',event=>{
    const button=event.target.closest('[data-weather-step]');if(!button || button.disabled)return;
    pageIndex+=Number(button.dataset.weatherStep);render();element.querySelector(`[data-weather-step="${button.dataset.weatherStep}"]`)?.focus({preventScroll:true});
  });
  const observer=new ResizeObserver(()=>{const size=`${element.clientWidth}:${element.clientHeight}`;if(size!==lastSize){lastSize=size;render();}});observer.observe(element);context.onDispose(()=>observer.disconnect());
  context.schedule(async()=>{try{data=await context.data();element.classList.remove('widget-unavailable');render();}catch(error){data=null;unavailable(element,config.title || 'Weather',error);}},(config.refreshSeconds || 300)*1000);
}
