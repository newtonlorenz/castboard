export async function mount({element,context,config}) {
 const {scope}=await import(context.source('runtime').asset('runtime.js'));
 const {document,request,setInterval}=await scope(element,context,"<div class=\"card solar-card\">\n            <div class=\"solar-head\">\n                <div class=\"card-label\">Solar</div>\n                <div class=\"solar-status\" id=\"solar-status\">Loading...</div>\n            </div>\n            <div class=\"solar-metrics\">\n                <div class=\"solar-metric\">\n                    <div class=\"solar-value\" id=\"solar-generated\">--</div>\n                    <div class=\"solar-caption\">Generated</div>\n                </div>\n                <div class=\"solar-metric\">\n                    <div class=\"solar-value\" id=\"solar-used\">--</div>\n                    <div class=\"solar-caption\">Solar Used</div>\n                </div>\n                <div class=\"solar-metric\">\n                    <div class=\"solar-value\" id=\"solar-grid\">--</div>\n                    <div class=\"solar-caption\">Grid Used</div>\n                </div>\n            </div>\n        </div>",'mission.css');

    // ===== CONFIGURATION =====

    const REFRESH = {"SOLAR": 15000};

    // ===== UTILITY: Fetch with Retry =====

    async function fetchJSON(url, options) { return request(url, options && typeof options === 'object' ? options : {}); }

    // ===== SOLAR =====

    function fmtKw(value) {
        if (value === null || value === undefined || isNaN(Number(value))) return '--';
        var n = Number(value) * (config.powerUnit === 'w' ? 1000 : 1);
        return n.toFixed(config.precision ?? (Math.abs(n) >= 10 ? 1 : 2)) + (config.powerUnit === 'w' ? ' W' : ' kW');
    }

    async function loadSolar() {
        var statusEl = document.getElementById('solar-status');
        try {
            var data = await fetchJSON('/api/solar', 0);
            if (!data || data.ok === false) throw new Error(data && data.error ? data.error.message : 'Solar unavailable');

            document.getElementById('solar-generated').textContent = fmtKw(data.generatedKw);
            document.getElementById('solar-used').textContent = fmtKw(data.usedSolarKw);
            document.getElementById('solar-grid').textContent = fmtKw(data.usedGridKw);

            statusEl.title = '';
            var exportKw = Number(data.gridExportKw || 0);
            if (exportKw > 0.05) {
                statusEl.textContent = 'Export ' + fmtKw(exportKw);
                statusEl.style.color = 'var(--positive)';
            } else {
                statusEl.textContent = data.demo ? 'Demo data' : 'Live';
                statusEl.style.color = 'var(--accent)';
            }
        } catch (e) {
            document.getElementById('solar-generated').textContent = '--';
            document.getElementById('solar-used').textContent = '--';
            document.getElementById('solar-grid').textContent = '--';
            statusEl.textContent = 'Reconnecting';
            statusEl.title = 'Source unreachable. Check its connection in Plugins; the panel retries automatically.';
            statusEl.style.color = 'var(--negative)';
        }
    }

    loadSolar();
    setInterval(loadSolar, config.refreshSeconds ? config.refreshSeconds*1000 : REFRESH.SOLAR);

}
