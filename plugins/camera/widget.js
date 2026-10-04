import {title} from '/widget-kit.js';

export function mount({element,config,context}) {
  element.classList.add('camera-widget');
  if(config.displayMode==='shortcut'){element.classList.add('camera-shortcut');element.textContent=context.panel.interaction && context.panel.interaction.showButton!==false?'':config.title || context.panel.interaction?.label || config.name || 'Camera';return;}
  element.innerHTML=`${config.showTitle===false?'':title(config.title || config.name || 'Camera')}<div class="camera-picture"><p class="camera-placeholder">Connecting…</p></div><footer class="camera-controls"><span class="camera-status" role="status">Waiting for image</span>${config.showRefresh===false?'':'<button type="button" data-camera-refresh data-castboard-ui="local">Refresh image</button>'}</footer>`;
  const picture=element.querySelector('.camera-picture'),status=element.querySelector('.camera-status'),button=element.querySelector('[data-camera-refresh]');
  let current,pending,busy=false,timeout,decodeTimer;
  const clear=()=>{clearTimeout(timeout);clearInterval(decodeTimer);};
  const stop=image=>{if(!image)return;image.onload=null;image.onerror=null;image.removeAttribute('src');};
  const finish=()=>{clear();busy=false;if(button){button.disabled=false;button.removeAttribute('aria-busy');}};
  const failed=()=>{
    stop(pending);pending=null;finish();
    element.dataset.freshness=current?'stale':'unavailable';
    status.textContent=current?'Showing previous image':'Image unavailable';
    if(!current)picture.innerHTML='<p class="camera-placeholder">Image unavailable</p>';
  };
  const refresh=async()=>{
    if(busy || context.signal.aborted)return;busy=true;
    if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
    status.textContent='Updating…';
    try {
      const data=await context.data();if(context.signal.aborted)return;
      const heading=element.querySelector('.widget-head span');if(heading)heading.textContent=config.title || data.name || config.name || 'Camera';
      if(!data.streamUrl){picture.innerHTML='<p class="camera-placeholder">Sample camera<br><small>Connect a camera in Plugins.</small></p>';status.textContent='Sample';element.dataset.freshness='demo';finish();return;}
      element.dataset.freshness=current?'stale':'loading';
      const next=new Image();pending=next;next.className='camera-frame';next.alt=data.name || 'Camera';next.style.objectFit=config.fit==='contain'?'contain':'cover';
      const ready=()=>{
        if(pending!==next || context.signal.aborted || !next.naturalWidth)return;
        finish();stop(current);current=next;pending=null;picture.replaceChildren(next);element.dataset.freshness='live';
        status.textContent=config.displayMode==='snapshot'?`Updated ${new Date().toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'Stream';
        next.onload=null;next.onerror=()=>{if(current===next){element.dataset.freshness='stale';status.textContent='Stream interrupted';}};
      };
      next.onload=ready;next.onerror=failed;
      next.src=context.resource({mode:config.displayMode==='snapshot'?'snapshot':'stream',v:Date.now()});
      timeout=setTimeout(failed,12000);
      // MJPEG may decode its first frame before its open-ended load completes.
      decodeTimer=setInterval(()=>{if(next.naturalWidth>0)ready();},100);
    }catch{if(!context.signal.aborted)failed();}
  };
  if(button)context.listen(button,'click',()=>void refresh());
  context.schedule(refresh,config.displayMode==='snapshot'?(config.refreshSeconds || 3)*1000:90000);
  context.onDispose(()=>{clear();stop(pending);stop(current);});
}
