import { escapeHtml, formatNumber, title, unavailable, weatherSymbol, displayRotation } from '/widget-kit.js?v=0.14.0';
import { forecastPages, displayForecast } from './assets/forecast.js';
import { forecastOverview } from './assets/overview.js';


const number=value=>value===null || value===undefined || value===''?'—':formatNumber(value,0);
const temperature=value=>`${number(value)}°`;

export function mount({ element, config, context }) {
  let data,pageIndex=0,pageCount=1,lastSize='';
  element.classList.add('weather-widget');element.classList.toggle('weather-compact',config.compact===true);
  const dateLabel=(value,options)=>{
    const date=new Date(value);if(!value || Number.isNaN(date.getTime()))return '—';
    try{return new Intl.DateTimeFormat(undefined,options).format(date);}catch{return new Intl.DateTimeFormat(undefined,{...options,timeZone:'UTC'}).format(date);}
  };
  const unit=config.temperatureUnit==='fahrenheit'?'F':'C';
  const current=()=>`<div class="weather-main"><span class="weather-icon">${weatherSymbol(data.code)}</span><strong class="weather-temp">${temperature(data.temperatureC)}${unit}</strong><span class="weather-condition">${escapeHtml((data.condition || 'Conditions unavailable')+(config.compact && config.demo?' · Sample':''))}</span></div><div class="weather-detail">Wind ${number(data.windKph===null || data.windKph===undefined?null:config.windUnit==='mph'?data.windKph/1.609344:config.windUnit==='ms'?data.windKph/3.6:data.windKph)} ${config.windUnit==='mph'?'mph':config.windUnit==='ms'?'m/s':'km/h'} · UV ${number(data.uvIndex)}</div>`;
  const rows=(kind,items,zone)=>items.length?`<div class="weather-rows">${items.map(item=>`<div class="weather-row" data-forecast-time="${escapeHtml(kind==='hourly'?item.time:item.date)}"><time>${escapeHtml(kind==='hourly'?dateLabel(item.time,{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:zone}):dateLabel(`${item.date}T12:00:00Z`,{weekday:'short',timeZone:'UTC'}))}</time><span class="weather-row-icon" title="${escapeHtml(item.condition || '')}">${weatherSymbol(item.code)}</span><strong>${kind==='hourly'?temperature(item.temperatureC):`${temperature(item.highC)} <span class="weather-low">${temperature(item.lowC)}</span>`}</strong><small aria-label="Chance of rain">${number(item.precipitationProbability)}%</small></div>`).join('')}</div>`:'<p class="weather-empty">Forecast unavailable</p>';
  const render=(forcePaged=false)=>{
    if(!data)return;
    const focus=element.querySelector('button:focus');
    const restore=()=>{if(focus?.dataset.weatherPage!==undefined)element.querySelector(`[data-weather-page="${focus.dataset.weatherPage}"]`)?.focus({preventScroll:true});else if(focus?.dataset.weatherStep)element.querySelector(`[data-weather-step="${focus.dataset.weatherStep}"]`)?.focus({preventScroll:true});};
    const mode=config.view || 'current',zone=data.timeZone || context.app.branding.timeZone || 'UTC';
    const overview=mode!=='current' && config.forecastLayout==='overview';
    element.dataset.weatherOverview=String(overview);
    if(overview){
      pageCount=2;pageIndex=Math.min(pageIndex,1);
      element.dataset.weatherView=mode;element.dataset.weatherPaged='true';
      element.innerHTML=`${title(pageIndex===0?'Next 24 hours':'Next 7 days',config.demo?'Sample':[config.label || data.label,`°${unit}`].filter(Boolean).join(' · '))}<div class="weather-content">${forecastOverview(data,{page:pageIndex,zone,dateLabel,weatherIcon:weatherSymbol,number,temperature})}</div><nav class="weather-overview-pages" aria-label="Forecast pages"><button type="button" data-castboard-ui="local" data-weather-page="0" aria-pressed="${pageIndex===0}">24 hours</button><button type="button" data-castboard-ui="local" data-weather-page="1" aria-pressed="${pageIndex===1}">7 days</button></nav>`;
      restore();return;
    }
    const paged=mode!=='current' && (forcePaged || config.forecastLayout==='paged' || config.forecastLayout!=='full' && element.clientHeight<420);
    element.dataset.weatherView=mode;element.dataset.weatherPaged=String(paged);
    let body='',meta=config.label ? config.label+(config.demo?' · Sample':'') : data.label,pager='';
    if(paged){
      const pages=forecastPages(data,config,element.clientHeight-parseFloat(getComputedStyle(element).paddingTop)-parseFloat(getComputedStyle(element).paddingBottom));pageIndex=Math.min(pageIndex,pages.length-1);
      pageCount=pages.length;const page=pages[pageIndex];meta=page.label+(config.demo?' · Sample':'');body=page.kind==='current'?current():rows(page.kind,page.items,zone);
      pager=`<nav class="weather-pagination" aria-label="Forecast pages"><button type="button" data-castboard-ui="local" data-weather-step="-1" ${pageIndex===0?'disabled':''}>Previous</button><span aria-live="polite">${pageIndex+1} / ${pages.length}</span><button type="button" data-castboard-ui="local" data-weather-step="1" ${pageIndex===pages.length-1?'disabled':''}>Next</button></nav>`;
    }else{
      pageCount=1;
      if(mode==='current' || mode==='forecast')body+=current();
      if(mode==='hourly' || mode==='forecast')body+=`<section class="weather-forecast"><h3>Next hours</h3>${rows('hourly',(Array.isArray(data.hourly)?data.hourly:[]).filter(hour=>Date.parse(hour.time)+3600000>Date.now()).slice(0,config.hours || 12),zone)}</section>`;
      if(mode==='daily' || mode==='forecast')body+=`<section class="weather-forecast"><h3>Coming days</h3>${rows('daily',(Array.isArray(data.daily)?data.daily:[]).slice(0,config.days || 7),zone)}</section>`;
    }
    element.innerHTML=`${config.compact && mode==='current'?'':title(config.title || 'Weather',meta)}<div class="weather-content">${body}</div>${pager}`;
    restore();
    const content=element.querySelector('.weather-content');
    if(!paged && mode!=='current' && config.forecastLayout!=='full' && content.scrollHeight>content.clientHeight+1)render(true);
  };
  context.listen(element,'click',event=>{
    const tab=event.target.closest('[data-weather-page]');if(tab){pageIndex=Number(tab.dataset.weatherPage);render();element.querySelector(`[data-weather-page="${pageIndex}"]`)?.focus({preventScroll:true});return;}
    const button=event.target.closest('[data-weather-step]');if(!button || button.disabled)return;
    pageIndex+=Number(button.dataset.weatherStep);render();element.querySelector(`[data-weather-step="${button.dataset.weatherStep}"]`)?.focus({preventScroll:true});
  });
  displayRotation({element,context,enabled:()=>config.autoRotate===true,seconds:()=>config.rotationSeconds || 20,ready:()=>Boolean(data) && pageCount>1,advance:()=>{pageIndex=(pageIndex+1)%pageCount;render();}});
  const observer=new ResizeObserver(()=>{const size=`${element.clientWidth}:${element.clientHeight}`;if(size!==lastSize){lastSize=size;render();}});observer.observe(element);context.onDispose(()=>observer.disconnect());
  context.schedule(async()=>{try{data=displayForecast(await context.data(),config);element.classList.remove('widget-unavailable');render();}catch(error){data=null;unavailable(element,config.title || 'Weather',error);}},(config.refreshSeconds || 300)*1000);
}
