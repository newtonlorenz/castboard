export async function mount({element,context,config}) {
 const {scope}=await import(context.source('runtime').asset('runtime.js'));
 const {document,request,setInterval}=await scope(element,context,"<div class=\"card focus-card\">\n            <div class=\"focus-lane\" id=\"focus-lane\">\n                <div class=\"focus-item\"><div class=\"focus-label\">Now</div><div class=\"focus-value\">Loading\u2026</div></div>\n            </div>\n        </div>",'mission.css');

    // ===== CONFIGURATION =====

    let calendarTimeZone = context.app.branding.timeZone;

    // ===== UTILITY: Fetch with Retry =====

    async function fetchJSON(url, options) { return request(url, options && typeof options === 'object' ? options : {}); }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>'"]/g, function(ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch];
        });
    }

    // ===== UTILITY: Time formatting =====

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
        events = (events || []).filter(event => timeToMinutes(event.start) !== null).sort((a,b) => timeToMinutes(a.start) - timeToMinutes(b.start));
        for (var i = 0; i < (events || []).length; i++) {
            var ev = events[i];
            var start = timeToMinutes(ev.start);
            var end = timeToMinutes(ev.end) ?? start;
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
            var calendar = await fetchJSON('/api/calendar');
            if (calendar) missionOverview.calendar = calendar;


            missionOverview.lastLoaded = Date.now();
            renderMissionOverview();
        } catch (e) {
            document.getElementById('focus-lane').textContent = 'Calendar unavailable · retrying';
        }
    }

    setInterval(loadMissionOverview, config.refreshSeconds ? config.refreshSeconds*1000 : 60000);

}
