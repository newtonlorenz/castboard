import {title} from '/widget-kit.js?v=0.14.0';
export function mount({element,config,context}){
 let url;try{url=new URL(config.url,location.origin);if(!['http:','https:'].includes(url.protocol) || url.username || url.password)throw new Error();}catch{element.textContent='Invalid page address. Check its URL in Plugins.';return;}
 element.classList.add('web-page');element.innerHTML=`${title(config.title || 'Web Page')}<iframe title="Embedded page" referrerpolicy="no-referrer"></iframe>${config.showFooter===false?'':'<footer><span>The site must allow embedding.</span><a target="_blank" rel="noopener noreferrer">Open page</a></footer>'}`;
 const frame=element.querySelector('iframe');frame.setAttribute('sandbox',[config.allowScripts?'allow-scripts':'',config.allowForms?'allow-forms':''].filter(Boolean).join(' '));frame.src=url.href;
 const link=element.querySelector('a');if(link)link.href=url.href;
 if(config.refreshSeconds>0) {let started=Date.now();context.schedule(()=>{if(Date.now()-started>=config.refreshSeconds*1000 && !element.matches(':focus-within')){started=Date.now();frame.src=url.href;}},1000);}
}
