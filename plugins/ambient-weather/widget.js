export async function mount({element,context,config}) {
 const {scope}=await import(context.source('runtime').asset('runtime.js'));
 const {document,request,resourceUrl,setTimeout,setInterval,clearTimeout,clearInterval}=await scope(element,context,"<div class=\"card weather-card\">\n            <div class=\"weather-top\">\n                <div class=\"card-label\">Weather</div>\n                <div class=\"weather-uv\" id=\"w-uv\">UV --</div>\n            </div>\n            <div class=\"weather-main\">\n                <div class=\"weather-icon\" id=\"w-icon\">--</div>\n                <div>\n                    <div class=\"weather-temp\" id=\"w-temp\">--</div>\n                    <div class=\"weather-desc\" id=\"w-desc\">Loading...</div>\n                </div>\n            </div>\n            <div class=\"weather-meta\">\n                <div class=\"weather-chip\" id=\"w-feels\">Feels --</div>\n                <div class=\"weather-chip\" id=\"w-humidity\">RH --</div>\n                <div class=\"weather-chip\" id=\"w-wind\">Wind --</div>\n            </div>\n        </div>",'mission.css');

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
    // ===== WEATHER =====

    const WMO_CODES = {
        0: ['Clear', '\u2600\ufe0f'], 1: ['Mostly Clear', '\ud83c\udf24\ufe0f'], 2: ['Partly Cloudy', '\u26c5'],
        3: ['Overcast', '\u2601\ufe0f'], 45: ['Fog', '\ud83c\udf2b\ufe0f'], 48: ['Freezing Fog', '\ud83c\udf2b\ufe0f'],
        51: ['Light Drizzle', '\ud83c\udf26\ufe0f'], 53: ['Drizzle', '\ud83c\udf26\ufe0f'], 55: ['Heavy Drizzle', '\ud83c\udf27\ufe0f'],
        61: ['Light Rain', '\ud83c\udf27\ufe0f'], 63: ['Rain', '\ud83c\udf27\ufe0f'], 65: ['Heavy Rain', '\ud83c\udf27\ufe0f'],
        71: ['Light Snow', '\ud83c\udf28\ufe0f'], 73: ['Snow', '\ud83c\udf28\ufe0f'], 75: ['Heavy Snow', '\ud83c\udf28\ufe0f'],
        80: ['Showers', '\ud83c\udf26\ufe0f'], 81: ['Heavy Showers', '\ud83c\udf27\ufe0f'],
        95: ['Thunderstorm', '\u26c8\ufe0f'], 96: ['Hail Storm', '\u26c8\ufe0f'],
    };

    async function loadWeather() {
        try {
            const data = await fetchJSON('/api/weather');
            if (data.temp !== null && data.temp !== undefined) {
                const [desc, icon] = WMO_CODES[data.code] || ['--', '\ud83c\udf21\ufe0f'];
                document.getElementById('w-icon').textContent = icon;
                document.getElementById('w-temp').textContent = Math.round(config.temperatureUnit==='fahrenheit'?data.temp*9/5+32:data.temp) + (config.temperatureUnit==='fahrenheit'?'\u00b0F':'\u00b0C');
                document.getElementById('w-desc').textContent = desc;
                document.getElementById('w-feels').textContent = data.apparentTemp !== null && data.apparentTemp !== undefined ? 'Feels ' + Math.round(data.apparentTemp) + '\u00b0' : 'Feels --';
                document.getElementById('w-humidity').textContent = data.humidity !== null && data.humidity !== undefined ? 'RH ' + Math.round(data.humidity) + '%' : 'RH --';
                document.getElementById('w-wind').textContent = data.windspeed !== null && data.windspeed !== undefined ? 'Wind ' + Math.round(data.windspeed) : 'Wind --';
                var uv = data.uvIndex !== null && data.uvIndex !== undefined ? Number(data.uvIndex) : null;
                var uvEl = document.getElementById('w-uv');
                uvEl.textContent = uv === null || isNaN(uv) ? 'UV --' : 'UV ' + uv.toFixed(1);
                uvEl.style.color = uv !== null && uv >= 8 ? 'var(--negative)' : uv !== null && uv >= 3 ? 'var(--warning)' : 'var(--positive)';
                uvEl.style.borderColor = uv !== null && uv >= 8 ? 'rgba(248,113,113,0.32)' : uv !== null && uv >= 3 ? 'rgba(250,204,21,0.28)' : 'rgba(74,222,128,0.28)';
            }
        } catch (e) {
            document.getElementById('w-desc').textContent = 'Unavailable';
            document.getElementById('w-uv').textContent = 'UV --';
        }
    }

    loadWeather();
    setInterval(loadWeather, config.refreshSeconds ? config.refreshSeconds*1000 : REFRESH.WEATHER);


}
