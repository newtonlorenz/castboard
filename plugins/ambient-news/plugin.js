import {createBriefingProvider} from './briefing-provider.js';
import {createPlugin as createNews} from '../news/plugin.js';
const displayKeys=["title", "maxStories", "rotationSeconds", "autoRotate", "showSummary", "showTicker", "refreshSeconds", "briefings", "showHeadlines", "showCategories", "includeKeywords", "excludeKeywords", "categories", "sources", "maxAgeHours", "sortOrder", "deduplicate", "briefingMaxAgeDays"];
export function createPlugin({config,context}) {
  const provider=config.provider || (context.bindings?.services?'briefings':'demo');
  const backend=provider==='briefings'?createBriefingProvider({config,context}):createNews({config:{...config,provider},context});
  return {...backend,id:'ambient-news',name:'News Reader',defaultConfig:{provider},assets:['selection.js','briefing.js'],styles:[],
    publicConfig:()=>({...backend.publicConfig?.(),...backend.defaults,readerProvider:provider,briefingQueries:provider==='briefings',...Object.fromEntries(displayKeys.filter(key=>config[key]!==undefined).map(key=>[key,config[key]]))})
  };
}
