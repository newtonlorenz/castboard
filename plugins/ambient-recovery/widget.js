export async function mount({element,context,config}) {
 const {scope}=await import(context.source('runtime').asset('runtime.js'));
 const {document,request,setInterval}=await scope(element,context,"<div class=\"card whoop-card\">\n            <div class=\"card-label\">Recovery</div>\n            <div class=\"whoop-recovery\" id=\"whoop-score\">--</div>\n            <div class=\"whoop-detail\" id=\"whoop-detail\">Loading...</div>\n        </div>",'mission.css');

    // ===== CONFIGURATION =====

    const REFRESH = {"RECOVERY": 600000};

    // ===== UTILITY: Fetch with Retry =====

    async function fetchJSON(url, options) { return request(url, options && typeof options === 'object' ? options : {}); }

    // ===== RECOVERY =====

    function recoveryColor(score) {
        if (score >= (config.goodThreshold ?? 67)) return 'var(--positive)';
        if (score >= (config.warningThreshold ?? 34)) return 'var(--warning)';
        return 'var(--negative)';
    }

    async function loadRecovery() {
        try {
            const data = await fetchJSON('/api/whoop');
            if (data.error) throw new Error(data.error);

            const score = data.recovery?.score;
            const el = document.getElementById('whoop-score');
            if (score !== null && score !== undefined) {
                el.textContent = score + '%';
                el.style.color = recoveryColor(score);
            } else {
                el.textContent = '--';
                el.style.color = 'var(--text-muted)';
            }

            const parts = [];
            if (config.showSleep!==false && data.sleep?.hours != null) parts.push('Sleep ' + data.sleep.hours + 'h');
            if (config.showStrain!==false && data.strain?.score != null) parts.push('Strain ' + data.strain.score);
            document.getElementById('whoop-detail').textContent = parts.join(' \u00b7 ') || 'No data';
        } catch (e) {
            document.getElementById('whoop-score').textContent = '--';
            document.getElementById('whoop-score').style.color = 'var(--text-muted)';
            document.getElementById('whoop-detail').textContent = 'Unavailable';
        }
    }

    loadRecovery();
    setInterval(loadRecovery, config.refreshSeconds ? config.refreshSeconds*1000 : REFRESH.RECOVERY);

}
