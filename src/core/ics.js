function unfold(text) {
  return String(text).replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
}

function property(lines, name) {
  const prefix = `${name}`.toUpperCase();
  const line = lines.find(item => item.toUpperCase().startsWith(prefix + ':') || item.toUpperCase().startsWith(prefix + ';'));
  if (!line) return null;
  const colon = line.indexOf(':');
  return colon < 0 ? null : { meta: line.slice(0, colon), value: line.slice(colon + 1) };
}

function parseDate(prop) {
  if (!prop?.value) return null;
  const raw = prop.value.trim();
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  if (/^\d{8}T\d{6}Z$/.test(raw)) return new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}Z`).toISOString();
  if (/^\d{8}T\d{6}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function cleanText(value = '') {
  return value.replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

export function parseIcs(text) {
  const lines = unfold(text);
  const events = [];
  let current = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') current = [];
    else if (line === 'END:VEVENT' && current) {
      const startProp = property(current, 'DTSTART');
      const endProp = property(current, 'DTEND');
      const start = parseDate(startProp);
      const end = parseDate(endProp);
      const uid = property(current, 'UID')?.value;
      const title = cleanText(property(current, 'SUMMARY')?.value || 'Untitled event');
      if (start) events.push({ id: uid || `${start}:${title}`, title, start, end, allDay: /^\d{8}$/.test(startProp?.value || ''), source: 'Calendar' });
      current = null;
    } else if (current) current.push(line);
  }
  return events.sort((a, b) => String(a.start).localeCompare(String(b.start)));
}
