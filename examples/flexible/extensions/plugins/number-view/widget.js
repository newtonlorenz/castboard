export function mount({element,context,config}) {
 const label=document.createElement('span'),value=document.createElement('strong');
 label.textContent=config.label||'Reading';element.replaceChildren(label,value);
 context.schedule(async()=>{try{const reading=await context.data();value.textContent=reading.value.toFixed(config.digits??0)+(config.unit||'');}catch{value.textContent='Unavailable';}},5000);
}
