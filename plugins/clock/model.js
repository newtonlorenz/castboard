export function clockTimes(options = {}, branding = {}, now = new Date()) {
  const zones = [{label:options.location || branding.location || '', timeZone:options.timeZone || branding.timeZone || 'UTC'}, ...(options.additionalClocks || []).slice(0,4)];
  return zones.map(zone => {
    let time, date;
    try {
      time = new Intl.DateTimeFormat(options.locale || undefined, {timeZone:zone.timeZone, hour:'2-digit', minute:'2-digit', ...(options.showSeconds ? {second:'2-digit'} : {}), hour12:options.hour12 === true}).format(now);
      date = new Intl.DateTimeFormat(options.locale || undefined, {timeZone:zone.timeZone, weekday:options.dateStyle === 'numeric' ? undefined : options.compact || options.dateStyle === 'short' ? 'short' : 'long', year:options.dateStyle==='numeric'?'numeric':undefined, day:'numeric', month:options.dateStyle === 'numeric' ? '2-digit' : options.compact || options.dateStyle === 'short' ? 'short' : 'long'}).format(now);
    } catch { throw new Error(`Invalid clock time zone or language: ${zone.timeZone}`); }
    return {label:zone.label || zone.timeZone, timeZone:zone.timeZone, time, date};
  });
}
