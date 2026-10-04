import {weatherSymbol} from '/widget-kit.js?v=0.14.0';
export async function mount({element,context,config}) {
 const {scope}=await import(context.source('runtime').asset('runtime.js'));
 const {document,request,setInterval}=await scope(element,context,"<div class=\"card weather-card\">\n            <div class=\"weather-top\">\n                <div class=\"card-label\">Weather</div>\n                <div class=\"weather-uv\" id=\"w-uv\">UV --</div>\n            </div>\n            <div class=\"weather-main\">\n                <div class=\"weather-icon\" id=\"w-icon\">--</div>\n                <div>\n                    <div class=\"weather-temp\" id=\"w-temp\">--</div>\n                    <div class=\"weather-desc\" id=\"w-desc\">Loading...</div>\n                </div>\n            </div>\n            <div class=\"weather-meta\">\n                <div class=\"weather-chip\" id=\"w-feels\">Feels --</div>\n                <div class=\"weather-chip\" id=\"w-humidity\">RH --</div>\n                <div class=\"weather-chip\" id=\"w-wind\">Wind --</div>\n            </div>\n        </div>",'mission.css');

    // ===== CONFIGURATION =====

    const REFRESH = {"WEATHER": 600000};

    // ===== UTILITY: Fetch with Retry =====

    async function fetchJSON(url, options) { return request(url, options && typeof options === 'object' ? options : {}); }

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

    const known = value => typeof value === 'number' && Number.isFinite(value);
    const temperature = value => known(value) ? Math.round(config.temperatureUnit === 'fahrenheit' ? value * 9 / 5 + 32 : value) + (config.temperatureUnit === 'fahrenheit' ? '°F' : '°C') : '--';
    const wind = value => known(value) ? Math.round(config.windUnit === 'mph' ? value / 1.609344 : config.windUnit === 'ms' ? value / 3.6 : value) + (config.windUnit === 'mph' ? ' mph' : config.windUnit === 'ms' ? ' m/s' : ' km/h') : '--';
    for (const [id, option] of [['w-feels', 'showFeels'], ['w-humidity', 'showHumidity'], ['w-wind', 'showWind'], ['w-uv', 'showUv']]) document.getElementById(id).hidden = config[option] === false;
    async function loadWeather() {
        try {
            const data = await fetchJSON('/api/weather');
            const [desc, icon] = WMO_CODES[data.code] || ['Conditions unavailable', ''];
            document.getElementById('w-icon').innerHTML = known(data.temp) ? weatherSymbol(data.code) : '';
            document.getElementById('w-temp').textContent = temperature(data.temp);
            document.getElementById('w-desc').textContent = known(data.temp) ? desc : 'Conditions unavailable';
            document.getElementById('w-feels').textContent = 'Feels ' + temperature(data.apparentTemp);
            document.getElementById('w-humidity').textContent = 'RH ' + (known(data.humidity) ? Math.round(data.humidity) + '%' : '--');
            document.getElementById('w-wind').textContent = 'Wind ' + wind(data.windspeed);
            const uv = known(data.uvIndex) ? data.uvIndex : null;
            const uvEl = document.getElementById('w-uv');
            uvEl.textContent = 'UV ' + (uv === null ? '--' : uv.toFixed(1));
            uvEl.style.color = uv === null ? 'var(--text-muted)' : uv >= 8 ? 'var(--negative)' : uv >= 3 ? 'var(--warning)' : 'var(--positive)';
        } catch {
            for (const [id, label] of [['w-temp','--'],['w-icon',''],['w-desc','Unavailable · retrying'],['w-feels','Feels --'],['w-humidity','RH --'],['w-wind','Wind --'],['w-uv','UV --']]) document.getElementById(id).textContent = label;
        }
    }

    loadWeather();
    setInterval(loadWeather, config.refreshSeconds ? config.refreshSeconds*1000 : REFRESH.WEATHER);

}
