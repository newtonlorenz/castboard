import {fetchJson,validateHttpUrl} from '../../src/core/providers.js';
const defaultBriefs=[{key:'top-stories',name:'Top stories',emoji:'TS'}];
export function createBriefingProvider({config,context}) {
  const legacy=!config.briefingBaseUrl && Boolean(context.bindings?.services);
  if(!legacy) {
    if(!config.briefingBaseUrl)throw new Error('Enter the briefing service URL, including its briefing path');
    validateHttpUrl(config.briefingBaseUrl,{base:true});
  }
  const definitions=(config.briefings?.length?config.briefings:defaultBriefs).filter(item=>item.enabled!==false);
  for(const item of definitions)if(!/^[a-z0-9-]+$/.test(item.key))throw new Error('Briefing IDs use lowercase letters, numbers and hyphens');
  return {async getData({url}={}) {
    const key=url?.searchParams.get('briefing')||definitions.find(item=>item.key!=='portfolio-brief')?.key;
    if(!key || !/^[a-z0-9-]+$/.test(key) || (!legacy&&!definitions.some(item=>item.key===key)))throw new Error('Choose a briefing configured in this News Reader');
    const data=legacy ? await context.read(context.bindings.services,{url:new URL('/data?'+new URLSearchParams({route:'/api/briefings/'+key}),'http://local')}) : await fetchJson(config.briefingBaseUrl.replace(/\/$/,'')+'/'+encodeURIComponent(key),{headers:config.headers||{}},config.timeoutMs||15000);
    if(typeof data?.content!=='string')throw new Error('Briefing service must return content as Markdown text');
    return data;
  },defaults:legacy?{}:{briefings:definitions}};
}
