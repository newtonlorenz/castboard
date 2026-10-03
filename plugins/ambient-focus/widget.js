export async function mount({element,context,config}) {
 const {scope}=await import(context.source('runtime').asset('runtime.js'));
 const {document,request,resourceUrl,setTimeout,setInterval,clearTimeout,clearInterval}=await scope(element,context,"<div class=\"card focus-card\">\n            <div class=\"focus-lane\" id=\"focus-lane\">\n                <div class=\"focus-item\"><div class=\"focus-label\">Now</div><div class=\"focus-value\">Loading\u2026</div></div>\n            </div>\n        </div>",'mission.css');

    // ===== CONFIGURATION =====

    const REFRESH = {
        CLOCK: 1000,
        WEATHER: 600000,
        SOLAR: 15000,
        RECOVERY: 600000,
        STATUS: 60000,
        PORTFOLIO: 15000,
        CALENDAR: 600000,
        CAMERA_ALERTS: 10000,
    };

    let dashConfig = { briefings: [], worldMonitorPort: 3000, weather: {}, calendar: {}, camera: {}, clearcam: {} };
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

    // ===== UTILITY: Markdown Renderer =====

    function markdownToHtml(md) {
        if (!md) return '';

        // Handle fenced code blocks first
        let html = md.replace(/```[\s\S]*?```/g, match => {
            const code = match.replace(/```\w*\n?/, '').replace(/```$/, '');
            return '<pre style="background:#222;padding:8px;border-radius:4px;font-size: 14px;color:#7fff00;overflow-x:auto;margin:6px 0;white-space:pre-wrap;">' + code + '</pre>';
        });

        // Strip markdown tables (keep text)
        html = html.split('\n').map(line => {
            if (line.match(/^\|[\s\-\|:]+\|$/)) return '';
            if (line.match(/^\|/)) return line.replace(/\|/g, ' ').trim();
            return line;
        }).join('\n');

        html = html
            .replace(/^### (.*?)$/gm, '<h3 style="color:var(--accent);margin:10px 0 6px;font-size: 17px;font-weight:700;border-bottom:1px solid #333;padding-bottom:4px;">$1</h3>')
            .replace(/^## (.*?)$/gm, '<h2 style="color:var(--accent);margin:12px 0 8px;font-size: 18px;font-weight:700;border-bottom:1px solid #444;padding-bottom:4px;">$1</h2>')
            .replace(/^# (.*?)$/gm, '<h1 style="color:var(--accent);margin:14px 0 10px;font-size: 21px;font-weight:700;">$1</h1>')
            .replace(/^([^\w\s<]) (.*?)$/gm, (match, emoji, text) => {
                if (/[\u{1F300}-\u{1FAD6}]/u.test(emoji)) {
                    return '<h3 style="color:var(--accent);margin:10px 0 6px;font-size: 17px;font-weight:700;border-bottom:1px solid #333;padding-bottom:4px;">' + emoji + ' ' + text + '</h3>';
                }
                return match;
            })
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#fff;font-weight:600;">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em style="color:#aaa;">$1</em>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color:#7fff00;text-decoration:none;">$1</a>')
            .replace(/^(\d+)\. (.*?)$/gm, '<div style="margin:4px 0 4px 20px;font-size: 16px;">$1. $2</div>')
            .replace(/^[\-\*] (.*?)$/gm, '<div style="margin:4px 0 4px 20px;font-size: 16px;">&bull; $1</div>')
            .replace(/`([^`]+)`/g, '<code style="background:#222;padding:2px 4px;color:#7fff00;font-size: 15px;border-radius:2px;">$1</code>')
            .replace(/^---+$/gm, '<div style="border-top:1px solid #444;margin:8px 0;"></div>')
            .replace(/\n\n+/g, '</div><div style="margin:6px 0;font-size: 16px;line-height:1.5;">')
            .replace(/\n/g, '<br>');

        return '<div style="font-size: 16px;line-height:1.5;color:#d0d0d0;">' + html + '</div>';
    }

    // ===== UTILITY: Currency symbol =====

    function currencySymbol(code) {
        if (code === 'USD') return '$';
        if (code === 'GBP') return '\u00a3';
        return '\u20ac';
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


 dashConfig = await context.source('config').data();
    // ===== ATTENTION + FOCUS =====

    var missionOverview = {
        dashboardStatus: null,
        calendar: null,
        whoop: null,
        lastLoaded: 0,
    };

    function timeToMinutes(value) {
        if (!value || value.indexOf(':') === -1) return null;
        var parts = value.split(':');
        return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
    }

    function getCalendarFocus(events) {
        var now = dashboardTimeParts(new Date());
        var nowMin = now.hour * 60 + now.minute;
        var current = null;
        var next = null;
        for (var i = 0; i < (events || []).length; i++) {
            var ev = events[i];
            var start = timeToMinutes(ev.start);
            var end = timeToMinutes(ev.end) || start;
            if (start === null) continue;
            if (!current && start <= nowMin && end >= nowMin) current = ev;
            if (!next && start > nowMin) next = ev;
        }
        return { current: current, next: next };
    }

    function renderMissionOverview() {
        var focusEl = document.getElementById('focus-lane');
        if (!focusEl) return;


        var calendarFocus = getCalendarFocus((missionOverview.calendar && missionOverview.calendar.events) || []);
        var nowText = calendarFocus.current ? calendarFocus.current.title : (config.emptyCurrent || 'No active event');
        var nextText = calendarFocus.next ? (calendarFocus.next.start + ' · ' + calendarFocus.next.title) : (config.emptyNext || 'Calendar clear');

        focusEl.innerHTML =
            '<div class="focus-item"><div class="focus-label">Now</div><div class="focus-value accent">' + escapeHtml(nowText) + '</div></div>' +
            '<div class="focus-item"><div class="focus-label">Next</div><div class="focus-value">' + escapeHtml(nextText) + '</div></div>';
    }

    async function loadMissionOverview() {
        try {
            var calendar = await fetchJSON('/api/calendar', 0).catch(function() { return null; });
            if (calendar) missionOverview.calendar = calendar;

            var whoop = await fetchJSON('/api/whoop', 0).catch(function() { return null; });
            if (whoop) missionOverview.whoop = whoop;

            missionOverview.lastLoaded = Date.now();
            renderMissionOverview();
        } catch (e) {
            renderMissionOverview();
        }
    }

    setTimeout(loadMissionOverview, 1800);
    setInterval(loadMissionOverview, config.refreshSeconds ? config.refreshSeconds*1000 : 60000);


}
