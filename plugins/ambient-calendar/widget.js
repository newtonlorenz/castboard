export async function mount({element,context,config}) {
 const {scope}=await import(context.source('runtime').asset('runtime.js'));
 const {document,request,setInterval}=await scope(element,context,"<div class=\"card calendar-card\">\n            <div class=\"card-label\">Today</div>\n            <div class=\"calendar-timeline\" id=\"calendar-list\">\n                <div class=\"calendar-empty\">Loading calendar\u2026</div>\n            </div>\n        </div>",'mission.css');

    // ===== CONFIGURATION =====

    const REFRESH = {"CALENDAR": 600000};

    let calendarTimeZone = context.app.branding.timeZone;

    // Source colors for calendar
    const SRC_COLORS = {
        'Apple': 'var(--src-apple)',
        'Google': 'var(--src-google)',
        'Outlook': 'var(--src-outlook)',
    };

    // ===== UTILITY: Fetch with Retry =====

    async function fetchJSON(url, options) { return request(url, options && typeof options === 'object' ? options : {}); }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>'"]/g, function(ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch];
        });
    }

    // ===== UTILITY: Time formatting =====

    function to24Hour(timeStr) {
        if (!timeStr || timeStr === '?' || timeStr === 'all-day') return timeStr;
        const match = timeStr.match(/(\d{1,2}):(\d{2})\s?(AM|PM)?/i);
        if (!match) return timeStr;
        let hours = parseInt(match[1]);
        const mins = match[2];
        const period = match[3] ? match[3].toUpperCase() : null;
        if (period) {
            if (period === 'PM' && hours !== 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
        }
        return String(hours).padStart(2, '0') + ':' + mins;
    }

    function dashboardTimeParts(date) {
        var parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: calendarTimeZone,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hourCycle: 'h23'
        }).formatToParts(date || new Date());
        var out = {};
        parts.forEach(function(part) {
            if (part.type !== 'literal') out[part.type] = parseInt(part.value, 10);
        });
        return out;
    }

    // ===== CALENDAR (multi-source) =====

    function sourceColor(src) {
        return SRC_COLORS[src] || 'var(--text-muted)';
    }

    function minutesFromTimeString(value) {
        if (!value) return null;
        if (value === 'all-day') return null;
        var parts = String(value).split(':');
        if (parts.length < 2) return null;
        var h = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
    }

    function clamp(num, min, max) {
        return Math.max(min, Math.min(max, num));
    }

    async function loadCalendar() {
        var el = document.getElementById('calendar-list');
        try {
            var data = await fetchJSON('/api/calendar');
            var now = new Date();
            var nowParts = dashboardTimeParts(now);
            var currentHour = nowParts.hour;
            var currentMinute = nowParts.minute;
            var currentSlot = (currentHour * 60) + (currentMinute >= 30 ? 30 : 0);
            var nowMinutes = (currentHour * 60) + currentMinute;
            var windowMinutes = (config.hoursAhead || 6) * 60;
            var dayStart = Math.floor(nowMinutes / 30) * 30;
            var dayEnd = Math.min(24 * 60, dayStart + windowMinutes);
            if (dayEnd - dayStart < windowMinutes) {
                dayStart = Math.max(0, dayEnd - windowMinutes);
            }
            var totalMinutes = dayEnd - dayStart;
            var slotMinutes = 30;
            var slotCount = Math.ceil(totalMinutes / slotMinutes);

            var hoursHtml = '';
            for (var slot = 0; slot < slotCount; slot++) {
                var slotStartMin = dayStart + (slot * slotMinutes);
                var topPct = ((slotStartMin - dayStart) / totalMinutes) * 100;
                var heightPct = (slotMinutes / totalMinutes) * 100;
                var label = '';
                if (slotStartMin % 60 === 0) {
                    label = String(Math.floor(slotStartMin / 60)).padStart(2, '0') + ':00';
                }
                var cls = 'cal-hour-row' + (slotStartMin === currentSlot ? ' current-hour' : '') + (slotStartMin % 60 !== 0 ? ' half-hour' : '');
                hoursHtml += '<div class="' + cls + '" style="top:' + topPct + '%;height:' + heightPct + '%;">' +
                    (label ? '<div class="cal-hour-label">' + label + '</div>' : '') +
                '</div>';
            }

            var nowLineHtml = '';
            if (nowMinutes >= dayStart && nowMinutes <= dayEnd) {
                var nowTopPct = ((nowMinutes - dayStart) / totalMinutes) * 100;
                nowLineHtml = '<div class="calendar-now-line" style="top:' + nowTopPct + '%;"></div>';
            }

            if (!data || !data.events || !data.events.length) {
                el.innerHTML = '<div class="calendar-timed-area" style="top:0"><div class="calendar-hours">' + hoursHtml + '</div>' + nowLineHtml + '<div class="calendar-empty">No events today</div></div>';
                return;
            }

            var allDayEvents = data.events.filter(function(ev) {
                return ev.allDay === true || ev.start === 'all-day';
            });
            var allDayRows = Math.ceil(allDayEvents.length / 2);
            var allDayStripHeight = allDayEvents.length ? Math.min(68, 34 * allDayRows) : 0;
            var allDayHeight = allDayEvents.length ? allDayStripHeight + 16 : 0;
            var allDayHtml = '';
            if (allDayEvents.length) {
                allDayHtml = '<div class="calendar-all-day" style="height:' + allDayStripHeight + 'px">' + allDayEvents.map(function(ev) {
                    var color = sourceColor(ev.source || '');
                    return '<div class="calendar-all-day-event" style="border-left-color:' + color + ';background:color-mix(in srgb, ' + color + ' 18%, rgba(255,255,255,0.06));">' +
                        '<span style="color:' + color + ';font-size:11px;text-transform:uppercase;">All day</span> · ' + escapeHtml(ev.title || 'Untitled') +
                    '</div>';
                }).join('') + '</div>';
            }

            var visibleEvents = data.events.map(function(ev) {
                var start = to24Hour(ev.start || '?');
                var end = to24Hour(ev.end || '');
                var startMin = minutesFromTimeString(start);
                var endMin = minutesFromTimeString(end);
                if (startMin === null) return null;
                if (endMin === null || endMin <= startMin) endMin = startMin + 30;
                var clippedStart = clamp(startMin, dayStart, dayEnd);
                var clippedEnd = clamp(endMin, dayStart, dayEnd);
                if (clippedEnd <= dayStart || clippedStart >= dayEnd || clippedEnd <= clippedStart) return null;
                return {
                    raw: ev,
                    start: start,
                    end: end,
                    startMin: startMin,
                    endMin: endMin,
                    clippedStart: clippedStart,
                    clippedEnd: clippedEnd
                };
            }).filter(Boolean).sort(function(a, b) {
                if (a.clippedStart !== b.clippedStart) return a.clippedStart - b.clippedStart;
                return a.clippedEnd - b.clippedEnd;
            });

            // Partition events into overlap clusters, then assign a free column
            // within each cluster. Every event in a cluster gets the same column
            // count, preventing later events from expanding over earlier ones.
            var clusters = [];
            var cluster = [];
            var clusterEnd = -1;
            visibleEvents.forEach(function(ev) {
                if (cluster.length && ev.clippedStart >= clusterEnd) {
                    clusters.push(cluster);
                    cluster = [];
                    clusterEnd = -1;
                }
                cluster.push(ev);
                clusterEnd = Math.max(clusterEnd, ev.clippedEnd);
            });
            if (cluster.length) clusters.push(cluster);

            clusters.forEach(function(items) {
                var active = [];
                var maxCols = 1;
                items.forEach(function(ev) {
                    active = active.filter(function(item) { return item.clippedEnd > ev.clippedStart; });
                    var used = active.map(function(item) { return item.column; });
                    var col = 0;
                    while (used.indexOf(col) !== -1) col++;
                    ev.column = col;
                    active.push(ev);
                    maxCols = Math.max(maxCols, col + 1);
                });
                items.forEach(function(ev) { ev.maxCols = maxCols; });
            });

            if (!visibleEvents.length) {
                el.innerHTML = allDayHtml + '<div class="calendar-timed-area" style="top:' + allDayHeight + 'px"><div class="calendar-hours">' + hoursHtml + '</div>' + nowLineHtml + '</div>';
                return;
            }

            var eventsHtml = visibleEvents.map(function(item) {
                var ev = item.raw;
                var topPct = ((item.clippedStart - dayStart) / totalMinutes) * 100;
                var heightPct = Math.max(((item.clippedEnd - item.clippedStart) / totalMinutes) * 100, 7);
                var src = ev.source || '';
                var color = sourceColor(src);
                var cols = item.maxCols || 1;
                var widthCalc = 'calc(' + (100 / cols) + '% - 10px)';
                var leftCalc = 'calc(' + ((100 / cols) * item.column) + '% + 8px)';
                return '<div class="cal-event" style="top:' + topPct + '%;height:' + heightPct + '%;left:' + leftCalc + ';width:' + widthCalc + ';right:auto;border-left-color:' + color + ';background:color-mix(in srgb, ' + color + ' 18%, rgba(255,255,255,0.06));">' +
                    '<div class="cal-event-title">' + escapeHtml(ev.title || 'Untitled') + '</div>' +
                    '<div class="cal-event-src" style="color:' + color + '">' + escapeHtml(src) + '</div>' +
                '</div>';
            }).join('');

            el.innerHTML = allDayHtml + '<div class="calendar-timed-area" style="top:' + allDayHeight + 'px"><div class="calendar-hours">' + hoursHtml + '</div>' + nowLineHtml + '<div class="calendar-events">' + eventsHtml + '</div></div>';
        } catch (e) {
            el.innerHTML = '<div class="calendar-empty" style="color:var(--negative);">Calendar unavailable</div>';
        }
    }

    loadCalendar();
    setInterval(loadCalendar, config.refreshSeconds ? config.refreshSeconds*1000 : REFRESH.CALENDAR);

}
