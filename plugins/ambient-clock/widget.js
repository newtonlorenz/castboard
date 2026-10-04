export async function mount({element,context,config}) {
 const {scope}=await import(context.source('runtime').asset('runtime.js'));
 const {document,setInterval}=await scope(element,context,"<div class=\"card time-card\">\n            <div class=\"card-label\">Dashboard</div>\n            <div class=\"time-clock\" id=\"clock\">--:--:--</div>\n            <div class=\"time-date\" id=\"date-display\">--</div>\n            <div class=\"time-location\" id=\"location\"></div>\n        </div>",'mission.css');

    // ===== CONFIGURATION =====

    const REFRESH = {"CLOCK": 1000};

    let dashConfig = {};
    let calendarTimeZone = config.timeZone || context.app.branding.timeZone;

    // ===== UTILITY: Time formatting =====

 dashConfig = await context.source('config').data().catch(()=>({}));
    // ===== CLOCK =====

    function updateClock() {
        const now = new Date();
        document.getElementById('clock').textContent = now.toLocaleTimeString(config.locale || undefined, {
            timeZone: calendarTimeZone,
            hour: '2-digit', minute: '2-digit', second: config.showSeconds===false?undefined:'2-digit', hour12: config.hour12===true
        });
        document.getElementById('date-display').textContent = now.toLocaleDateString(config.locale || undefined, {
            timeZone: calendarTimeZone,
            weekday: config.dateStyle === 'numeric' ? undefined : config.dateStyle === 'short' ? 'short' : 'long', day: 'numeric', month: config.dateStyle === 'numeric' ? '2-digit' : config.dateStyle === 'short' ? 'short' : 'long', year: 'numeric'
        });
    }

    updateClock();
    setInterval(updateClock, REFRESH.CLOCK);

 document.getElementById('location').textContent = config.location ?? dashConfig.weather?.label ?? '';
 document.getElementById('date-display').hidden = config.showDate===false;

}
