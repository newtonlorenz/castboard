export async function mount({element,context,config}) {
 const {scope}=await import(context.source('runtime').asset('runtime.js'));
 const {document,request,setTimeout,setInterval,clearTimeout,clearInterval}=await scope(element,context,"\n  <main class=\"shell\">\n    <nav id=\"category-bar\" class=\"category-bar\" aria-label=\"Story categories\"></nav>\n    <section class=\"broadcast-grid\">\n      <article id=\"lead-card\" class=\"lead-card\" aria-live=\"polite\">\n        <div id=\"lead-content\" class=\"lead-content\"><div class=\"state-message\">Loading stories\u2026</div></div>\n        <footer class=\"lead-lower\">\n          <div><div id=\"story-source\" class=\"story-source\">Loading stories</div><div id=\"story-position\" class=\"story-position\">Stand by</div></div>\n          <div class=\"transport\" aria-label=\"Story controls\"><button id=\"story-read\" class=\"transport-button read-full\" type=\"button\" aria-label=\"Read full story\">READ</button><button id=\"story-prev\" class=\"transport-button\" type=\"button\" aria-label=\"Previous story\">\u2039</button><button id=\"story-play\" class=\"transport-button primary\" type=\"button\" aria-label=\"Pause rotation\">\u2161</button><button id=\"story-next\" class=\"transport-button\" type=\"button\" aria-label=\"Next story\">\u203a</button></div>\n        </footer>\n        <div class=\"air-progress\"><div id=\"air-progress-fill\" class=\"air-progress-fill\"></div></div>\n      </article>\n      <aside class=\"wire\" aria-label=\"All stories\"><header class=\"wire-head\"><div class=\"wire-title\">Headlines</div><div id=\"wire-count\" class=\"wire-count\">Loading</div></header><div id=\"story-stream\" class=\"story-stream\"><div class=\"state-message\">Loading headlines\u2026</div></div></aside>\n    </section>\n    <footer class=\"ticker\"><div class=\"ticker-label\">Headlines</div><div class=\"ticker-window\"><div id=\"ticker-track\" class=\"ticker-track\">Loading today\u2019s wire\u2026</div></div><div id=\"ticker-status\" class=\"ticker-status\">SYNCING</div></footer>\n  </main>\n\n  <dialog id=\"reader-overlay\" class=\"reader-overlay\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"full-reader-title\">\n    <article class=\"full-reader\">\n      <header class=\"full-reader-head\">\n        <div class=\"full-reader-heading\"><div id=\"full-reader-label\" class=\"full-reader-label\">News reader</div><div id=\"full-reader-title\" class=\"full-reader-title\">Story</div></div>\n        <button id=\"reader-close\" class=\"reader-close\" type=\"button\">Close</button>\n      </header>\n      <div id=\"full-reader-body\" class=\"full-reader-body\"></div>\n    </article>\n  </dialog>\n\n  ",'wire.css');
 const pluginOptions=config;
 const window={addEventListener:(event,callback)=>context.listen(globalThis.window,event,callback)};

    var FALLBACK_BRIEFS=[{name:'Top stories',emoji:'TS',key:'top-stories'}];
    var briefDefs=FALLBACK_BRIEFS.slice(),briefCache={},rawCache={},allStories=[],visibleStories=[];
    var activeCategory='All',activeStoryId='',rotationTimer=null,refreshInFlight=false,isPlaying=true,wasPlayingBeforeReader=true;
    var ROTATION_MS=(config.rotationSeconds||18)*1000,REFRESH_MS=(config.refreshSeconds||60)*1000;

    function escapeHtml(value){return String(value==null?'':value).replace(/[&<>'"]/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch];});}
    function inlineMarkup(value){return escapeHtml(value).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<span class="brief-link">$1</span>');}
    function markdownToHtml(markdown){
      var lines=String(markdown||'').replace(/\r/g,'').split('\n'),html=[],listType='';
      function closeList(){if(listType)html.push('</'+listType+'>');listType='';}
      lines.forEach(function(line){var match;if(!line.trim()){closeList();return;}if(/^---+$/.test(line.trim())){closeList();return;}
        if((match=line.match(/^[-*]\s+(.+)/))){if(listType!=='ul'){closeList();listType='ul';html.push('<ul>');}html.push('<li>'+inlineMarkup(match[1])+'</li>');return;}
        if((match=line.match(/^\d+\.\s+(.+)/))){if(listType!=='ol'){closeList();listType='ol';html.push('<ol>');}html.push('<li>'+inlineMarkup(match[1])+'</li>');return;}
        closeList();html.push('<p>'+inlineMarkup(line.replace(/^#{1,3}\s+/,''))+'</p>');});closeList();return html.join('');
    }
    function makeExcerpt(markdown,title){
      var text=String(markdown||'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/[*_`#>-]/g,' ').replace(/\s+/g,' ').trim();
      var limit=String(title||'').length>118?175:(String(title||'').length>78?220:285);
      if(text.length>limit){var cut=text.slice(0,limit),sentence=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('? '),cut.lastIndexOf('! '));text=(sentence>limit*.8?cut.slice(0,sentence+1):cut.slice(0,cut.lastIndexOf(' ')))+'…';}
      return escapeHtml(text).replace(/Why it matters:/i,'<strong>Why it matters:</strong>');
    }

    function parseBrief(markdown){
      var text=String(markdown||'').replace(/\r/g,''),lines=text.split('\n');
      var indexStart=lines.findIndex(function(line){return /^##\s+Index\s*$/.test(line.trim());});
      if(indexStart<0){
        var standaloneStories=[],standaloneStory=null,standaloneCategory='Projects';
        function finishStandalone(){if(standaloneStory)standaloneStories.push(standaloneStory);standaloneStory=null;}
        lines.forEach(function(line){
          var section=line.match(/^##\s+(.+)/);
          var item=line.match(/^(?:##\s+)?\d+\.\s+(?:\*\*)?\[([^\]]+)\]\(([^)]+)\)(?:\*\*)?/)||line.match(/^###\s+\[([^\]]+)\]\(([^)]+)\)/);
          if(item){finishStandalone();standaloneStory={title:item[1],url:item[2],meta:'Open-source project',category:standaloneCategory,lines:[]};return;}
          if(section){finishStandalone();standaloneCategory=/projects?\s+worth\s+watching/i.test(section[1])?'Projects':section[1].trim();return;}
          if(standaloneStory&&/^\*Signal note:/i.test(line.trim())){finishStandalone();return;}
          if(standaloneStory)standaloneStory.lines.push(line.trim());
        });
        finishStandalone();
        standaloneStories.forEach(function(story){
          var what=story.lines.find(function(line){return /What it is:/i.test(line);})||story.lines.find(function(line){return line&&!/^\*\*Why it matters:/i.test(line);})||'';
          story.meta=what.replace(/^[-*]\s*/,'').replace(/\*\*/g,'').replace(/^What it is:\s*/i,'')||'Open-source project';
          story.article=story.lines.filter(Boolean).map(function(line){return line.replace(/^\*([^*]+):\*\s*/,'**$1:** ');}).join('\n\n')||story.title;
          delete story.lines;
        });
        return{stories:standaloneStories,notice:''};
      }
      var indexEnd=lines.length;
      for(var i=indexStart+1;i<lines.length;i++){if(/^---+$/.test(lines[i].trim())||/^##\s+/.test(lines[i])){indexEnd=i;break;}}
      var stories=[],notice='';
      lines.slice(indexStart+1,indexEnd).forEach(function(line){var match=line.match(/^[-*]\s+\[([^\]]+)\]\(([^)]+)\)\s*(.*)$/);if(match)stories.push({title:match[1],url:match[2],meta:match[3]||'',category:'Top Stories',article:''});else if(!notice&&/^[-*]\s+\S/.test(line.trim()))notice=line.trim().replace(/^[-*]\s+/,'');});
      var articleLines=lines.slice(indexEnd+1),articleByUrl={},looseSections=[],currentCategory='',currentArticle=null,currentLoose=null;
      function finishArticle(){if(!currentArticle)return;var body=currentArticle.lines.join('\n').trim();if(body)articleByUrl[currentArticle.url]={category:currentArticle.category,body:body};currentArticle=null;}
      function finishLoose(){if(!currentLoose)return;var body=currentLoose.lines.join('\n').trim();if(body){currentLoose.body=body;delete currentLoose.lines;looseSections.push(currentLoose);}currentLoose=null;}
      articleLines.forEach(function(line){
        var category=line.match(/^##\s+(.+)/),heading=line.match(/^###\s+(.+)/),linkedHeading=line.match(/^###\s+\[([^\]]+)\]\(([^)]+)\)/),linkedItem=line.match(/^[-*]\s+\[([^\]]+)\]\(([^)]+)\)\s*(.*)$/);
        if(category){finishArticle();finishLoose();currentCategory=category[1].trim();return;}
        if(heading){finishArticle();finishLoose();currentLoose={heading:heading[1].replace(/^\[([^\]]+)\]\([^)]+\)$/,'$1'),category:currentCategory||'Top Stories',lines:[]};if(linkedHeading)currentArticle={title:linkedHeading[1],url:linkedHeading[2],category:currentCategory||'Top Stories',lines:[]};return;}
        if(linkedItem){finishArticle();var item=linkedItem;currentArticle={title:item[1],url:item[2],category:currentCategory||'Top Stories',lines:[]};return;}
        if(currentArticle)currentArticle.lines.push(line);if(currentLoose)currentLoose.lines.push(line);
      });finishArticle();finishLoose();
      function bestLooseSection(title){
        var stop={this:1,that:1,with:1,from:1,into:1,over:1,their:1,they:1,more:1,about:1,after:1,orders:1,says:1};
        var tokens=String(title).toLowerCase().replace(/[^a-z0-9£]+/g,' ').split(/\s+/).filter(function(token){return token.length>=4&&!stop[token];});
        var best=null,bestScore=0;
        looseSections.forEach(function(section){var heading=section.heading.toLowerCase(),haystack=(section.heading+' '+section.body).toLowerCase(),score=0;tokens.forEach(function(token){if(heading.indexOf(token)!==-1)score+=3;else if(haystack.indexOf(token)!==-1)score+=1;});if(score>bestScore){best=section;bestScore=score;}});
        return bestScore?best:null;
      }
      stories.forEach(function(story){var matched=articleByUrl[story.url]||bestLooseSection(story.title);if(matched){story.category=matched.category||story.category;story.article=matched.body;}else story.article='A summary for this item was not included in today’s briefing.';});
      if(!stories.length&&notice)stories.push({title:notice,url:'',meta:'Briefer scan · '+todayKey(),category:'Top Stories',article:notice});
      return{stories:stories,notice:notice};
    }

    function todayKey(){var parts=new Intl.DateTimeFormat('en-GB',{timeZone:context.app.branding.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),values={};parts.forEach(function(part){values[part.type]=part.value;});return values.year+'-'+values.month+'-'+values.day;}
    async function fetchJson(url){return request(url);}
    function storyId(channelKey,url,index){return channelKey+':'+(url||index);}

    function rebuildStoryDeck(){
      var readerOpen=document.getElementById('reader-overlay').open;
      var deck=[];briefDefs.forEach(function(brief){var cached=briefCache[brief.key];if(!cached||!cached.stories)return;cached.stories.forEach(function(story,index){deck.push(Object.assign({},story,{id:storyId(brief.key,story.url,index),channelKey:brief.key,channel:brief.name,channelCode:brief.emoji||brief.name.slice(0,2).toUpperCase()}));});});
      allStories=deck;applyFilter(false);if(readerOpen)clearTimeout(rotationTimer);renderTicker();document.getElementById('ticker-status').textContent=allStories.length?'LIVE · '+allStories.length:'WAITING';
    }
    function categoryList(){var counts={All:allStories.length},domains={};briefDefs.forEach(function(brief){domains[brief.name]=true;});allStories.forEach(function(story){counts[story.channel]=(counts[story.channel]||0)+1;if(story.category!==story.channel)counts[story.category]=(counts[story.category]||0)+1;});var preferred=['All','AI','iGaming','Open Source','Portfolio','Top Stories','Research','Industry','Products','Regulation','M&A','Markets','Projects to watch'];return Object.keys(counts).sort(function(a,b){var ai=preferred.indexOf(a),bi=preferred.indexOf(b);ai=ai<0?999:ai;bi=bi<0?999:bi;return ai-bi||a.localeCompare(b);}).map(function(name){return{name:name,count:counts[name]};});}
    function renderCategories(){
      var categories=categoryList();if(!categories.some(function(item){return item.name===activeCategory;}))activeCategory='All';
      document.getElementById('category-bar').innerHTML=categories.map(function(item){return '<button class="category-tab'+(item.name===activeCategory?' active':'')+'" type="button" data-category="'+escapeHtml(item.name)+'">'+escapeHtml(item.name)+'<span class="category-count">'+item.count+'</span></button>';}).join('');
      document.querySelectorAll('.category-tab').forEach(function(button){button.addEventListener('click',function(){activeCategory=button.getAttribute('data-category')||'All';applyFilter(true);});});
    }
    function applyFilter(resetSelection){var domainNames=briefDefs.map(function(brief){return brief.name;});visibleStories=activeCategory==='All'?allStories.slice():(domainNames.indexOf(activeCategory)!==-1?allStories.filter(function(story){return story.channel===activeCategory;}):allStories.filter(function(story){return story.category===activeCategory;}));if(resetSelection||!visibleStories.some(function(story){return story.id===activeStoryId;}))activeStoryId=visibleStories.length?visibleStories[0].id:'';renderCategories();renderStream();renderLead();scheduleRotation();}
    function groupVisibleStories(){var groups={};visibleStories.forEach(function(story){if(!groups[story.category])groups[story.category]=[];groups[story.category].push(story);});return groups;}
    function renderStream(){
      var stream=document.getElementById('story-stream');document.getElementById('wire-count').textContent=visibleStories.length+(visibleStories.length===1?' story':' stories');
      if(!visibleStories.length){stream.innerHTML='<div class="state-message">No stories are available in this category yet.</div>';return;}
      stream.innerHTML=visibleStories.map(function(story){return '<button class="stream-story'+(story.id===activeStoryId?' active':'')+'" type="button" data-story-id="'+escapeHtml(story.id)+'"><span class="stream-headline">'+escapeHtml(story.title)+'</span></button>';}).join('');
      stream.querySelectorAll('.stream-story').forEach(function(button){button.addEventListener('click',function(){selectStory(button.getAttribute('data-story-id'),true);});});
    }
    function currentStory(){return visibleStories.find(function(story){return story.id===activeStoryId;})||visibleStories[0];}
    function renderLead(){
      var story=currentStory(),lead=document.getElementById('lead-content');
      if(!story){var waiting=Object.keys(briefCache).length?'No stories have been published today.':'Loading stories…';lead.innerHTML='<div class="state-message"><strong>News reader</strong><br>'+waiting+'</div>';document.getElementById('story-source').textContent='Briefing desk';document.getElementById('story-position').textContent='Stand by';restartProgress();return;}
      activeStoryId=story.id;var titleClass=story.title.length>118?' xlong':(story.title.length>78?' long':'');lead.innerHTML='<div class="story-change"><div class="lead-eyebrow"><span class="channel">'+escapeHtml(story.channelCode)+'</span><span>'+escapeHtml(story.channel)+'</span><span class="divider"></span><span>'+escapeHtml(story.category)+'</span></div><h1 class="lead-title'+titleClass+'">'+escapeHtml(story.title)+'</h1><div class="lead-deck">'+makeExcerpt(story.article,story.title)+'</div></div>';
      var position=visibleStories.indexOf(story)+1;document.getElementById('story-source').textContent=story.meta||story.channel+' briefing';document.getElementById('story-position').textContent='On air · Story '+position+' of '+visibleStories.length;renderStreamActive();restartProgress();
    }
    function renderStreamActive(){document.querySelectorAll('.stream-story').forEach(function(button){var active=button.getAttribute('data-story-id')===activeStoryId;button.classList.toggle('active',active);if(active)button.scrollIntoView({block:'nearest',behavior:'smooth'});});}
    function selectStory(id,restart){if(!visibleStories.some(function(story){return story.id===id;}))return;activeStoryId=id;renderLead();if(restart)scheduleRotation();}
    function stepStory(delta){if(!visibleStories.length)return;var index=visibleStories.findIndex(function(story){return story.id===activeStoryId;});index=index<0?0:index;index=(index+delta+visibleStories.length)%visibleStories.length;selectStory(visibleStories[index].id,true);}
    function restartProgress(){var fill=document.getElementById('air-progress-fill');fill.classList.remove('running');void fill.offsetWidth;if(isPlaying&&visibleStories.length>1)fill.classList.add('running');}
    function scheduleRotation(){clearTimeout(rotationTimer);if(document.getElementById('reader-overlay').open)return;restartProgress();if(!isPlaying||visibleStories.length<2)return;rotationTimer=setTimeout(function(){stepStory(1);},ROTATION_MS);}
    function togglePlayback(){isPlaying=!isPlaying;var button=document.getElementById('story-play');button.textContent=isPlaying?'Ⅱ':'▶';button.setAttribute('aria-label',isPlaying?'Pause rotation':'Resume rotation');scheduleRotation();}
    function openFullReader(){var story=currentStory();if(!story)return;wasPlayingBeforeReader=isPlaying;clearTimeout(rotationTimer);document.getElementById('full-reader-label').textContent=story.channel+' · '+story.category+' · '+(story.meta||'Today');document.getElementById('full-reader-title').textContent=story.title;document.getElementById('full-reader-body').innerHTML=markdownToHtml(story.article);document.getElementById('full-reader-body').scrollTop=0;document.getElementById('reader-overlay').classList.add('open'); document.getElementById('reader-overlay').showModal();restartProgress();}
    function closeFullReader(){document.getElementById('reader-overlay').classList.remove('open'); document.getElementById('reader-overlay').close();if(wasPlayingBeforeReader)scheduleRotation();}
    function renderTicker(){var track=document.getElementById('ticker-track');if(!allStories.length){track.textContent='Waiting for stories…';return;}track.innerHTML=allStories.map(function(story){return '<span><b>'+escapeHtml(story.channel.toUpperCase())+'</b>'+escapeHtml(story.title)+'</span>';}).join('');}
    function portfolioBrief(data){
      var summary=data&&data.summary||{},stamp=data&& (data.liveTimestamp||data.timestamp) || '',stampMs=Date.parse(stamp),ageMs=Date.now()-stampMs;
      if(!stamp||!isFinite(stampMs)||ageMs<0||ageMs>15*60*1000)return{stories:[],notice:'Portfolio data is stale; waiting for a fresh market snapshot.'};
      function numberValue(value){var n=Number(value);return isFinite(n)?n:null;}
      function firstNumber(values){for(var i=0;i<values.length;i++){var n=numberValue(values[i]);if(n!==null)return n;}return null;}
      function euro(value){var n=numberValue(value);if(n===null)return'--';return(n<0?'-':'')+'€'+Math.abs(Math.round(n)).toLocaleString('en-GB');}
      function signedEuro(value){var n=numberValue(value);if(n===null)return'--';return(n>0?'+':n<0?'-':'')+euro(Math.abs(n));}
      function percent(value){var n=numberValue(value);return n===null?'--':(n>0?'+':'')+n.toFixed(2)+'%';}
      var total=firstNumber([summary.totalValueEURInclExternalComputed,summary.totalValueEURInclExternal,summary.totalPortfolioValueEUR,summary.netLiquidationEUR]);
      var day=firstNumber([summary.dayPnlEUR,summary.totalDayPnlEUR]);
      var count=firstNumber([summary.positionCount])||((data.positions||[]).length);
      var movers=(data.positions||[]).map(function(p){return{symbol:p.symbol||'?',pnl:numberValue(p.dayPnlEUR),pct:numberValue(p.finnhubChangePercent),value:firstNumber([p.valueEUR,p.positionValue,p.value])};}).filter(function(p){return p.pnl!==null;}).sort(function(a,b){return Math.abs(b.pnl)-Math.abs(a.pnl);}).slice(0,4);
      var localTime=new Date(stamp).toLocaleTimeString('en-GB',{timeZone:context.app.branding.timeZone,hour:'2-digit',minute:'2-digit'});
      var lines=['## Summary','- **Tracked value:** '+euro(total),'- **Day move:** '+signedEuro(day),'- **Positions:** '+count,'- **Data:** '+localTime+' '+context.app.branding.timeZone,'## Key movers'];
      if(movers.length)movers.forEach(function(p){lines.push('- **'+p.symbol+'**: '+signedEuro(p.pnl)+' ('+percent(p.pct)+')');});else lines.push('- No fresh mover data available.');
      if(movers.length){var lead=movers.slice().sort(function(a,b){return b.pnl-a.pnl;})[0];lines.push('## Read');lines.push('- Biggest current contribution: **'+lead.symbol+'** at '+signedEuro(lead.pnl)+'.');}
      return{stories:[{title:'Portfolio · '+euro(total)+' · '+signedEuro(day)+' today',url:'',meta:(data.demo?'Demo portfolio':'Portfolio snapshot')+' · '+localTime+' '+context.app.branding.timeZone,category:'Portfolio',article:lines.join('\n\n')}],notice:''};
    }
    async function loadPortfolio(brief){try{var data=await fetchJson('/api/dashboard/portfolio'),signature=JSON.stringify({timestamp:data.liveTimestamp||data.timestamp,summary:data.summary,positions:data.positions});if(rawCache[brief.key]===signature&&briefCache[brief.key]!==undefined)return false;rawCache[brief.key]=signature;briefCache[brief.key]=portfolioBrief(data);return true;}catch(error){if(briefCache[brief.key]===undefined)briefCache[brief.key]={stories:[],error:true};return false;}}
    async function loadBrief(brief){try{var data=await fetchJson('/api/briefings/'+encodeURIComponent(brief.key)),raw=data.content||'',signature=(data.date||'')+'\\n'+raw;if(rawCache[brief.key]===signature&&briefCache[brief.key]!==undefined)return false;rawCache[brief.key]=signature;briefCache[brief.key]=data.date&&data.date!==todayKey()?{stories:[],notice:'',staleDate:data.date}:parseBrief(raw);return true;}catch(error){if(briefCache[brief.key]===undefined)briefCache[brief.key]={stories:[],error:true};return false;}}
    async function refreshBriefs(){if(refreshInFlight)return;refreshInFlight=true;try{var changes=await Promise.all(briefDefs.map(function(brief){return brief.key==='portfolio-brief'?loadPortfolio(brief):loadBrief(brief);}));if(changes.some(Boolean)||!allStories.length)rebuildStoryDeck();}finally{refreshInFlight=false;}}
    async function init(){
      try{var sourceConfig=await fetchJson('/api/config'),configured=(pluginOptions.briefings?.length?pluginOptions.briefings:sourceConfig.briefings||[]).filter(function(brief){return brief&&/^[a-z0-9-]+$/.test(brief.key)&&brief.name;});if(configured.length)briefDefs=configured.map(function(brief){return {...brief,emoji:brief.emoji||brief.name.slice(0,2)};});}catch(_){}
      await refreshBriefs();setInterval(refreshBriefs,REFRESH_MS);
    }
    document.getElementById('story-prev').addEventListener('click',function(){stepStory(-1);});
    document.getElementById('story-next').addEventListener('click',function(){stepStory(1);});
    document.getElementById('story-play').addEventListener('click',togglePlayback);
    document.getElementById('story-read').addEventListener('click',openFullReader);
    document.getElementById('reader-close').addEventListener('click',closeFullReader);
    document.getElementById('reader-overlay').addEventListener('click',function(event){if(event.target===this)closeFullReader();});
    document.addEventListener('visibilitychange',function(){if(!document.hidden)refreshBriefs();});
    window.addEventListener('online',refreshBriefs);
    init();

}
