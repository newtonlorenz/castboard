export async function mount({element,context,config}) {
 const {scope}=await import(context.source('runtime').asset('runtime.js'));
 const {document,request,resourceUrl,setTimeout,setInterval,clearTimeout,clearInterval}=await scope(element,context,"<div class=\"card camera-card\" id=\"camera-card\">\n            <div class=\"outdoor-camera-section-head\">\n                <strong>Camera</strong>\n                <span>Camera feed</span>\n            </div>\n            <div class=\"outdoor-camera\" id=\"outdoor-camera\">\n                <div class=\"outdoor-camera-head\">\n                    <span class=\"outdoor-camera-name\" id=\"outdoor-camera-name\">Camera</span>\n                    <span class=\"outdoor-camera-status\" id=\"outdoor-camera-status\">Connecting</span>\n                </div>\n                <img id=\"outdoor-camera-frame\" class=\"outdoor-camera-frame\" alt=\"Camera live feed\" loading=\"eager\" referrerpolicy=\"no-referrer\">\n            </div>\n        </div>",'mission.css');

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
    // ===== OUTDOOR CAMERA =====

    async function loadOutdoorCamera() {
        var cameraConfig = {...(dashConfig.camera || {}),...(config.cameraName?{name:config.cameraName}:{})};
        var clearcamConfig = {...(dashConfig.clearcam || {}),...(config.frameRefreshMs?{refreshMs:config.frameRefreshMs}:{})};
        var cameraName = cameraConfig.name || 'Camera';
        if(dashConfig.demo){document.getElementById('outdoor-camera-status').textContent='Choose a camera source';document.getElementById('outdoor-camera-name').textContent='Demo camera';document.getElementById('outdoor-camera-frame').hidden=true;return;}
        var preferredId = cameraConfig.preferredId || '';
        var servicePort = Number(cameraConfig.servicePort) || 3001;
        var serviceBase = '/camera';
        var cameraId = preferredId;
        var status = document.getElementById('outdoor-camera-status');
        var name = document.getElementById('outdoor-camera-name');
        var frame = document.getElementById('outdoor-camera-frame');
        var clearcamName = clearcamConfig.cameraName || cameraName;
        var clearcamBase = '/clearcam';
        var clearcamRefreshMs = Math.max(800, Number(clearcamConfig.refreshMs) || 1200);
        var activeMode = 'starting';
        var refreshTimer = null;
        var fallbackRecycleTimer = null;
        var clearcamRetryTimer = null;
        var clearcamHealthTimer = null;
        var clearcamRecycleTimer = null;
        var clearcamFailures = 0;
        var clearcamUnhealthyChecks = 0;
        var lastSourceFrameNumber = null;
        var lastSourceFrameAdvancedAt = 0;
        var lastFrameAt = 0;
        var lastFrameMode = '';
        var fallbackDecoded = false;
        var cameraDiscoveryTimer = null;
        var disposed = false;

        // Optional AI probes must not override evidence from a working fallback.
        // Conversely, a successful metadata request does not prove a frame arrived.
        function updateCameraHealth() {
            if (disposed) return;
            var maxAge = lastFrameMode === 'clearcam' ? Math.max(15000, clearcamRefreshMs * 2) : 105000;
            var live = lastFrameAt > 0 && Date.now() - lastFrameAt < maxAge;
            element.dataset.freshness = live ? 'live' : 'unavailable';
            if (live) {
                element.classList.remove('widget-unavailable', 'widget-stale');
                element.removeAttribute('data-provider-error');
            } else element.dataset.providerError = 'Camera frames are not arriving';
        }
        function receivedFrame(mode) {
            if (disposed || activeMode !== mode) return;
            lastFrameAt = Date.now(); lastFrameMode = mode;
            updateCameraHealth();
        }

        name.textContent = cameraName;
        status.textContent = 'Connecting';
        status.style.display = '';

        var streamBase = '';
        async function discoverCamera() {
            try {
                var cameras = await fetchJSON(serviceBase + '/api/cameras', 0);
                cameras = Array.isArray(cameras) ? cameras : [];
                var selected = cameras.find(camera => camera.enabled && camera.id === preferredId)
                    || cameras.slice().reverse().find(camera => camera.enabled && camera.name === cameraName);
                if (disposed) return;
                if (selected) { cameraId = selected.id; name.textContent = selected.name || cameraName; }
            } catch (_) { if (!disposed) status.textContent = cameraId ? 'Reconnecting' : 'Unavailable'; }
            streamBase = cameraId ? serviceBase + '/api/cameras/' + encodeURIComponent(cameraId) + '/mjpeg?quality=low' : '';
            updateCameraHealth();
        }
        await discoverCamera();
        if (context.signal.aborted) return;

        var CAMERA_STREAM_RECYCLE_MS = 90 * 1000;

        function clearCameraTimers() {
            clearTimeout(refreshTimer);
            clearInterval(fallbackRecycleTimer);
            clearInterval(clearcamHealthTimer);
            clearInterval(clearcamRecycleTimer);
            refreshTimer = null;
            fallbackRecycleTimer = null;
            clearcamHealthTimer = null;
            clearcamRecycleTimer = null;
        }

        function scheduleClearcamRetry() {
            clearTimeout(clearcamRetryTimer);
            if (clearcamConfig.enabled) {
                clearcamRetryTimer = setTimeout(tryClearcam, 15000);
            }
        }

        function startFallback() {
            if (disposed) return;
            clearCameraTimers();
            clearTimeout(cameraDiscoveryTimer);
            activeMode = 'fallback';
            if (!streamBase) {
                frame.removeAttribute('src');
                status.textContent = 'Unavailable';
                updateCameraHealth();
                cameraDiscoveryTimer = setTimeout(async function() {
                    await discoverCamera();
                    if (!disposed && activeMode === 'fallback') startFallback();
                }, 15000);
                scheduleClearcamRetry();
                return;
            }
            var reconnectDelay = 2000;
            function connectFallback() {
                if (disposed || activeMode !== 'fallback') return;
                clearTimeout(refreshTimer);
                // A fresh image gives us first-frame evidence even when MJPEG never
                // emits load until the connection ends. Do not reuse old dimensions.
                var nextFrame = frame.cloneNode(false);
                nextFrame.removeAttribute('src');
                frame.onload = frame.onerror = null;
                frame.removeAttribute('src'); frame.replaceWith(nextFrame); frame = nextFrame;
                fallbackDecoded = false;
                status.textContent = 'Reconnecting';
                frame.onload = function() {
                    if (disposed || activeMode !== 'fallback') return;
                    fallbackDecoded = true; reconnectDelay = 2000;
                    receivedFrame('fallback');
                    status.textContent = clearcamConfig.enabled ? 'LIVE · AI STANDBY' : 'LIVE';
                };
                frame.onerror = function() {
                    if (disposed || activeMode !== 'fallback') return;
                    status.textContent = 'Reconnecting';
                    refreshTimer = setTimeout(connectFallback, reconnectDelay);
                    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
                    updateCameraHealth();
                };
                frame.src = resourceUrl(streamBase + '&v=' + Date.now());
            }
            connectFallback();
            // DashCast can leave an MJPEG request open after its frames stall.
            fallbackRecycleTimer = setInterval(connectFallback, CAMERA_STREAM_RECYCLE_MS);
            scheduleClearcamRetry();
        }

        async function clearcamIsFresh(updateStatus) {
            try {
                var health = await fetchJSON(clearcamBase + '/health?v=' + Date.now(), 0);
                var camera = (health.cameras || []).find(function(item) {
                    return item.name === clearcamName;
                });
                var age = camera && Number(camera.frameAgeSeconds);
                var sourceAge = camera && Number(camera.sourceFrameAgeSeconds);
                var sourceFrameNumber = camera && Number(camera.sourceFrameNumber);
                var fresh = camera && Number.isFinite(age) && age <= 12 &&
                    (!Number.isFinite(sourceAge) || sourceAge <= 12);
                if (fresh && Number.isFinite(sourceFrameNumber)) {
                    if (lastSourceFrameNumber === null || sourceFrameNumber !== lastSourceFrameNumber) {
                        lastSourceFrameNumber = sourceFrameNumber;
                        lastSourceFrameAdvancedAt = Date.now();
                    } else if (lastSourceFrameAdvancedAt && Date.now() - lastSourceFrameAdvancedAt > 15000) {
                        fresh = false;
                    }
                }
                if (fresh && updateStatus) {
                    var detections = Number(camera.detections) || 0;
                    status.textContent = 'AI LIVE' + (detections ? ' · ' + detections + ' OBJECT' + (detections === 1 ? '' : 'S') : '');
                }
                return fresh;
            } catch (_) {
                return false;
            } finally { updateCameraHealth(); }
        }

        function connectClearcamFrame() {
            if (activeMode !== 'clearcam') return;
            clearTimeout(refreshTimer);
            frame.onload = function() {
                if (activeMode !== 'clearcam') return;
                clearcamFailures = 0;
                receivedFrame('clearcam');
                clearTimeout(refreshTimer);
                refreshTimer = setTimeout(connectClearcamFrame, clearcamRefreshMs);
            };
            frame.onerror = function() {
                if (activeMode !== 'clearcam') return;
                clearcamFailures += 1;
                if (clearcamFailures >= 3) {
                    startFallback();
                    return;
                }
                clearTimeout(refreshTimer);
                refreshTimer = setTimeout(connectClearcamFrame, 1800);
            };
            frame.src = resourceUrl(clearcamBase + '/' + encodeURIComponent(clearcamName) + '/live.jpg?v=' + Date.now());
            // A normal image request should complete immediately on the LAN.
            // If neither load nor error fires, force a new attempt instead of
            // letting a wedged browser request freeze this panel indefinitely.
            refreshTimer = setTimeout(function() {
                if (activeMode !== 'clearcam') return;
                clearcamFailures += 1;
                if (clearcamFailures >= 3) startFallback();
                else connectClearcamFrame();
            }, Math.max(5000, clearcamRefreshMs * 3));
        }

        async function tryClearcam() {
            if (disposed) return;
            if (!clearcamConfig.enabled) {
                startFallback();
                return;
            }
            if (!await clearcamIsFresh(false)) {
                if (activeMode !== 'fallback') startFallback();
                else scheduleClearcamRetry();
                return;
            }
            if (disposed) return;
            clearCameraTimers();
            clearTimeout(cameraDiscoveryTimer);
            clearTimeout(clearcamRetryTimer);
            activeMode = 'clearcam';
            clearcamFailures = 0;
            clearcamUnhealthyChecks = 0;
            lastSourceFrameNumber = null;
            lastSourceFrameAdvancedAt = Date.now();
            status.textContent = 'AI LIVE';
            connectClearcamFrame();
            clearcamHealthTimer = setInterval(function() {
                clearcamIsFresh(true).then(function(fresh) {
                    if (activeMode !== 'clearcam') return;
                    if (fresh) {
                        clearcamUnhealthyChecks = 0;
                        return;
                    }
                    clearcamUnhealthyChecks += 1;
                    status.textContent = 'AI RECONNECTING';
                    if (clearcamUnhealthyChecks >= 3) startFallback();
                });
            }, 5000);
        }

        var frameHealthTimer = setInterval(function() {
            if (activeMode === 'fallback' && !fallbackDecoded && frame.naturalWidth > 0) {
                fallbackDecoded = true; receivedFrame('fallback');
                status.textContent = clearcamConfig.enabled ? 'LIVE · AI STANDBY' : 'LIVE';
            }
            updateCameraHealth();
        }, 2000);
        context.onDispose(function() {
            disposed = true; clearCameraTimers(); clearInterval(frameHealthTimer);
            clearTimeout(clearcamRetryTimer); clearTimeout(cameraDiscoveryTimer);
            frame.onload = frame.onerror = null;
        });
        tryClearcam();
    }



    loadOutdoorCamera();

}
