import { demoTimestamp, readJsonSource, validateProviderConfig } from './providers.js';
export function text(value, label, max=240, required=false) {
  if (value==null && !required) return '';
  if (typeof value!=='string' || value.length>max || required && !value.trim()) throw new Error(`${label} must be ${required?'nonempty ':''}text, up to ${max} characters`);
  return value;
}
export function publicUrl(value) {
  text(value,'URL',4096,true);
  if (/^\/(?!\/)/.test(value) && !/[\\\r\n]/.test(value)) return value;
  let url; try { url=new URL(value); } catch { throw new Error('Enter an HTTP or HTTPS URL'); }
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use HTTP or HTTPS without embedded credentials');
  return url.href;
}
export function numeric(value,label,{optional=true,min=-Infinity}={}) {
  if(value==null && optional) return null;
  if(typeof value!=='number' || !Number.isFinite(value) || value<min) throw new Error(`${label} must be a finite number${min>=0?' greater than or equal to '+min:''}`);
  return value;
}
export function contentPlugin({id,name=id,config,context,field,demo,normalize,nativeView,assets=['style.css']}) {
  validateProviderConfig(id,config,['demo','inline','http-json','file-json']);
  const rows=items=>{
    if(!Array.isArray(items) || items.length>100)throw new Error(`${field} must be an array of up to 100 items`);
    return items.map(item=>{if(!item || typeof item!=='object' || Array.isArray(item))throw new Error(`${field} entries must be objects`);return normalize(item);});
  };
  if(config.provider==='inline')rows(config[field] || []);
  return {id,name,assets,styles:['style.css'],nativeView,async getData(){
    const data=config.provider==='demo'?{[field]:typeof demo==='function'?demo():demo,demo:true}:config.provider==='inline'?{[field]:config[field] || []}:await readJsonSource(config,context);
    return {[field]:rows(data[field]),demo:data.demo===true,updatedAt:text(data.updatedAt,'Update time',100) || demoTimestamp()};
  }};
}
