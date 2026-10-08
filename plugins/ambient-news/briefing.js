export function parseBrief(markdown,{dateKey=''}={}){
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
      var articleLines=lines.slice(indexEnd+1),articleByUrl={},looseSections=[],currentCategory='',currentArticle=null,currentLoose=null,currentSection=null;
      function finishArticle(){if(!currentArticle)return;var body=currentArticle.lines.join('\n').trim();if(body)articleByUrl[currentArticle.url]={category:currentArticle.category,body:body};currentArticle=null;}
      function finishLoose(){if(!currentLoose)return;var body=currentLoose.lines.join('\n').trim();if(body){currentLoose.body=body;delete currentLoose.lines;looseSections.push(currentLoose);}currentLoose=null;}
      function finishSection(){if(currentSection){var body=currentSection.lines.join('\n').trim();if(body)looseSections.push({heading:currentSection.heading,category:currentSection.heading,body:body});}currentSection=null;}
      articleLines.forEach(function(line){
        var category=line.match(/^##\s+(.+)/),heading=line.match(/^###\s+(.+)/),linkedHeading=line.match(/^###\s+\[([^\]]+)\]\(([^)]+)\)/),linkedItem=line.match(/^[-*]\s+\[([^\]]+)\]\(([^)]+)\)\s*(.*)$/);
        if(category){finishArticle();finishLoose();finishSection();currentCategory=category[1].trim();currentSection={heading:currentCategory,lines:[]};return;}
        if(heading){finishArticle();finishLoose();currentLoose={heading:heading[1].replace(/^\[([^\]]+)\]\([^)]+\)$/,'$1'),category:currentCategory||'Top Stories',lines:[]};if(linkedHeading)currentArticle={title:linkedHeading[1],url:linkedHeading[2],category:currentCategory||'Top Stories',lines:[]};return;}
        if(linkedItem){finishArticle();var item=linkedItem;currentArticle={title:item[1],url:item[2],category:currentCategory||'Top Stories',lines:[]};return;}
        if(currentArticle)currentArticle.lines.push(line);if(currentLoose)currentLoose.lines.push(line);if(currentSection&&!currentArticle&&!currentLoose&&!/^---+$/.test(line.trim()))currentSection.lines.push(line);
      });finishArticle();finishLoose();finishSection();
      function bestLooseSection(title){
        var stop={this:1,that:1,with:1,from:1,into:1,over:1,their:1,they:1,more:1,about:1,after:1,orders:1,says:1};
        var tokens=String(title).toLowerCase().replace(/[^a-z0-9£]+/g,' ').split(/\s+/).filter(function(token){return token.length>=4&&!stop[token];});
        var best=null,bestScore=0;
        looseSections.forEach(function(section){var heading=section.heading.toLowerCase(),haystack=(section.heading+' '+section.body).toLowerCase(),score=0;tokens.forEach(function(token){if(heading.indexOf(token)!==-1)score+=3;else if(haystack.indexOf(token)!==-1)score+=1;});if(score>bestScore){best=section;bestScore=score;}});
        return bestScore?best:null;
      }
      stories.forEach(function(story){var matched=articleByUrl[story.url]||bestLooseSection(story.title);if(matched){story.category=matched.category||story.category;story.article=matched.body;}else story.article='A summary for this item was not included in today’s briefing.';});
      if(!stories.length&&notice&&!/^no (?:qualifying|new|verified|major)\b/i.test(notice))stories.push({title:notice,url:'',meta:'Briefer scan · '+dateKey,category:'Top Stories',article:notice});
      return{stories:stories,notice:notice};
    }
