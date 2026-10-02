export function mount({element,context,config}){
 const label=document.createElement('span'),meter=document.createElement('meter');label.textContent=config.label||'Gauge';meter.min=0;meter.setAttribute('aria-label',label.textContent);element.replaceChildren(label,meter);
 context.schedule(async()=>{try{const reading=await context.data();meter.max=reading.maximum;meter.value=reading.value;}catch{label.textContent='Reading unavailable';}},5000);
}
