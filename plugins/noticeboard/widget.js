import { escapeHtml, title, displayRotation } from '/widget-kit.js?v=0.14.0';
import { activeNotices } from './assets/model.js';
export function mount({ element, config, context }) {
  let data={notices:[]}, index=0, error='', paused=false, currentKey='', notices=[], bottomSince=Date.now(), started=Date.now();
  element.classList.add('noticeboard');
  const render = () => {
    const previous=notices[index];
    notices=activeNotices(data);
    const selected=notices.findIndex(item=>item.id===previous?.id);
    if(selected>=0) index=selected;
    index%=Math.max(1,notices.length);
    const notice=notices[index], key=notice ? `${notice.id}:${notice.body}` : '';
    const old=element.querySelector('.notice-content'), scroll=key===currentKey ? old?.scrollTop || 0 : 0;
    if(key!==currentKey) {currentKey=key;bottomSince=Date.now();started=Date.now();}
    const focus=element.querySelector('button:focus')?.dataset;
    element.innerHTML=`${title(config.title || 'Noticeboard',error?'Source unavailable':data.demo?'Sample data':'')}<article class="notice-content">${notice?`<h2>${escapeHtml(notice.title)}</h2><div class="notice-body">${escapeHtml(notice.body)}</div>`:`<p>${escapeHtml(error || config.emptyText || 'No current notices')}</p>`}</article>${config.showControls!==false && notices.length>1?`<nav aria-label="Notice controls" data-castboard-ui="local"><button type="button" data-step="-1" aria-label="Previous notice">Previous</button><span>${index+1} of ${notices.length}</span><button type="button" data-step="1" aria-label="Next notice">Next</button><button type="button" data-pause>${paused?'Resume':'Pause'}</button></nav>`:''}`;
    element.querySelector('.notice-content').scrollTop=scroll;
    if(focus) element.querySelector(focus.step?`[data-step="${focus.step}"]`:'[data-pause]')?.focus({preventScroll:true});
  };
  const advance=step=>{index=(index+step+notices.length)%Math.max(1,notices.length);render();};
  const rotation=displayRotation({element,context,enabled:()=>config.autoRotate!==false && !paused,seconds:()=>config.rotationSeconds || 20,ready:()=>notices.length>1 && (!config.autoScroll || Date.now()-bottomSince>3000),advance:()=>advance(1)});
  context.listen(element,'click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.step)advance(Number(button.dataset.step));if(button.hasAttribute('data-pause')){paused=!paused;render();}rotation.reset();});
  context.schedule(async()=>{try{const next=await context.data();activeNotices(next);data=next;error='';}catch{data={notices:[]};error='Notices unavailable. Check the source in Plugins; retrying automatically.';}render();},(config.refreshSeconds || 60)*1000);
  context.schedule(()=>{
    const active=activeNotices(data);if(active.map(n=>n.id).join('|')!==notices.map(n=>n.id).join('|'))render();
    const content=element.querySelector('.notice-content');
    if(!content || !config.autoScroll || paused || rotation.interacting())return;
    if(content.scrollHeight>content.clientHeight+content.scrollTop+1){bottomSince=Date.now();if(Date.now()-started>3000)content.scrollTop+=1;}
  },50);
}
