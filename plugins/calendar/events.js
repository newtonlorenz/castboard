export function calendarEvents(data,options={},now=Date.now()) {
 const excluded=(options.excludeSources || []).map(name=>String(name).toLocaleLowerCase());
 return (Array.isArray(data.events)?data.events:[]).filter(event=>{
  if(!event || typeof event!=='object')return false;
  if(event.end && Date.parse(event.end)<=now)return false;
  if(options.showAllDay===false && (event.allDay || /^\d{4}-\d{2}-\d{2}$/.test(event.start || '')))return false;
  if(excluded.includes(String(event.source || '').toLocaleLowerCase()))return false;
  return !(options.daysAhead>0 && Date.parse(event.start)>now+options.daysAhead*86400000);
 }).slice(0,options.maxEvents || 5);
}
