import {createPlugin as createNews} from '../news/plugin.js';
const displayKeys=["title", "maxStories", "rotationSeconds", "autoRotate", "showSummary", "showTicker", "refreshSeconds", "briefings", "showHeadlines", "showCategories", "includeKeywords", "excludeKeywords", "categories", "sources", "maxAgeHours", "sortOrder", "deduplicate", "briefingMaxAgeDays"];
export function createPlugin({config,context}) {
  const provider=config.provider || 'briefings';
  const backend=provider==='briefings'?{}:createNews({config:{...config,provider},context});
  return {...backend,id:'ambient-news',name:'News Reader',assets:['selection.js'],styles:[],
    publicConfig:()=>({...backend.publicConfig?.(),readerProvider:provider,...Object.fromEntries(displayKeys.filter(key=>config[key]!==undefined).map(key=>[key,config[key]]))})
  };
}
