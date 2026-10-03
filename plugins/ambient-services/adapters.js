export function calendarData(data,timeZone='UTC',now=new Date()){
 const dateKey=value=>new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
 const time=value=>new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(value);
 const today=dateKey(now);
 return {...data,events:(data.events||[]).flatMap(event=>{
  if(event.allDay){const start=String(event.start).slice(0,10),end=String(event.end||'').slice(0,10);if(start>today||(end&&end<=today))return [];return [{...event,start:'all-day',end:'all-day'}];}
  const start=new Date(event.start),end=new Date(event.end||event.start);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime()))return [];
  if(dateKey(start)>today||dateKey(end)<today||(dateKey(end)===today&&time(end)==='00:00'&&end<=now))return [];
  return [{...event,start:event.allDay?'all-day':dateKey(start)<today?'00:00':time(start),end:event.allDay?'all-day':dateKey(end)>today?'23:59':time(end)}];
 })};
}
export function displayData(kind,data,timeZone='UTC'){
 if(kind==='calendar')return calendarData(data,timeZone);
 if(kind==='weather')return {...data,temp:data.temp??data.temperatureC,apparentTemp:data.apparentTemp??data.apparentTemperatureC,windspeed:data.windspeed??data.windKph};
 if(kind==='recovery')return {...data,recovery:data.recovery||{score:data.score},sleep:data.sleep||{},strain:data.strain||{}};
 if(kind==='solar')return {...data,usedSolarKw:data.usedSolarKw??Math.max(0,(data.loadKw||0)-(data.gridImportKw||0)),usedGridKw:data.usedGridKw??data.gridImportKw};
 if(kind==='portfolio')return {...data,summary:data.summary||{baseCurrency:data.positions?.[0]?.currency||'USD',netLiquidation:data.totalValue,dailyPnl:data.dailyChange}};
 return data;
}
