export function activeNotices(data, now = Date.now()) {
  if (!data || !Array.isArray(data.notices) || data.notices.length > 100) throw new Error('Notice data must contain up to 100 notices');
  return data.notices.flatMap((notice, index) => {
    if (!notice || typeof notice.body !== 'string' || !notice.body.trim() || notice.body.length > 12000 || (notice.title != null && typeof notice.title !== 'string')) throw new Error(`Notice ${index + 1} needs a text message and optional heading`);
    const start = notice.startsAt ? Date.parse(notice.startsAt) : -Infinity;
    const end = notice.expiresAt ? Date.parse(notice.expiresAt) : Infinity;
    if ([notice.startsAt, notice.expiresAt].some(value=>value && !/(Z|[+-]\d{2}:\d{2})$/.test(value))) throw new Error(`Notice ${index + 1} schedule needs a time zone`);
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) throw new Error(`Notice ${index + 1} has an invalid schedule`);
    if (notice.enabled === false || now < start || now >= end) return [];
    return [{ id: notice.id || `notice-${index}`, title: (notice.title || '').slice(0, 160), body: notice.body, startsAt: notice.startsAt, expiresAt: notice.expiresAt }];
  });
}
