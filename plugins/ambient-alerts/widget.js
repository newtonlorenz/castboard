export async function mount({element,context,config}) {
 const {scope}=await import(context.source('runtime').asset('runtime.js'));
 const {document,request,resourceUrl,setInterval}=await scope(element,context,"<div class=\"card camera-alerts-card\">\n            <div class=\"camera-alerts\">\n                <div class=\"camera-alert-list\" id=\"camera-alert-list\" aria-live=\"polite\">\n                    <div class=\"camera-alert-state\">Checking recent activity\u2026</div>\n                </div>\n            </div>\n        </div><dialog id=\"camera-detection-modal\" class=\"camera-detection-modal\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"camera-detection-title\" hidden>\n        <section class=\"camera-detection-panel\">\n            <header class=\"camera-detection-head\">\n                <div class=\"camera-detection-heading\">\n                    <h2 id=\"camera-detection-title\" class=\"camera-detection-title\">Activity detected</h2>\n                    <div id=\"camera-detection-meta\" class=\"camera-detection-meta\">Outdoor camera</div>\n                </div>\n                <button id=\"camera-detection-close\" class=\"camera-detection-close\" type=\"button\" aria-label=\"Close detection preview\">\u00d7</button>\n            </header>\n            <div class=\"camera-detection-viewer\">\n                <img id=\"camera-detection-image\" alt=\"Camera detection frame\" referrerpolicy=\"no-referrer\">\n                <video id=\"camera-detection-video\" controls muted autoplay playsinline preload=\"auto\" hidden></video>\n                <div id=\"camera-detection-status\" class=\"camera-detection-status\" role=\"status\" aria-live=\"polite\">Preparing video\u2026</div>\n            </div>\n        </section>\n    </dialog>",'mission.css');

    // ===== CONFIGURATION =====

    const REFRESH = {"CAMERA_ALERTS": 10000};

    let calendarTimeZone = context.app.branding.timeZone;

    // ===== UTILITY: Fetch with Retry =====

    async function fetchJSON(url, options) { return request(url, options && typeof options === 'object' ? options : {}); }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>'"]/g, function(ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch];
        });
    }

    // ===== CAMERA ALERTS =====

    function cameraAlertDate(folder) {
        if (!folder || folder === 'video') return 'Recent';
        var todayParts = new Intl.DateTimeFormat('en-GB', {
            timeZone: calendarTimeZone,
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(new Date());
        var todayMap = {};
        todayParts.forEach(function(part) { todayMap[part.type] = part.value; });
        var today = todayMap.year + '-' + todayMap.month + '-' + todayMap.day;
        if (folder === today) return 'Today';
        var parsed = new Date(folder + 'T12:00:00');
        if (isNaN(parsed.getTime())) return folder;
        return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }

    function cameraAlertClock(seconds) {
        var value = Number(seconds);
        if (!Number.isFinite(value) || value < 0) return '';
        var hours = Math.floor(value / 3600) % 24;
        var minutes = Math.floor((value % 3600) / 60);
        return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
    }

    function cameraAlertWhen(alert) {
        var capturedAt = Number(alert && alert.captured_at);
        if (Number.isFinite(capturedAt) && capturedAt > 0) {
            var captured = new Date(capturedAt * 1000);
            var time = captured.toLocaleTimeString('en-GB', {
                timeZone: calendarTimeZone,
                hour: '2-digit', minute: '2-digit', hour12: false
            });
            return cameraAlertDate(alert.folder) + ' · ' + time;
        }
        var clock = cameraAlertClock(alert && alert.timestamp);
        return cameraAlertDate(alert && alert.folder) + (clock ? ' · ' + clock : '');
    }

    function cameraAlertKind(alert) {
        var classIds = Array.isArray(alert && alert.class_ids)
            ? alert.class_ids.map(Number).filter(Number.isFinite)
            : [];
        var hasPerson = classIds.indexOf(0) !== -1;
        var vehicleNames = { 1: 'Bicycle', 2: 'Car', 3: 'Motorbike', 5: 'Bus', 7: 'Truck' };
        var vehicle = null;
        for (var i = 0; i < classIds.length; i++) {
            if (vehicleNames[classIds[i]]) {
                vehicle = vehicleNames[classIds[i]];
                break;
            }
        }
        if (hasPerson && vehicle) {
            return { title: 'Person and ' + vehicle.toLowerCase() + ' detected', badge: 'Person + ' + vehicle, kind: 'person' };
        }
        if (hasPerson) return { title: 'Person detected', badge: 'Person', kind: 'person' };
        if (vehicle) return { title: vehicle + ' detected', badge: vehicle, kind: 'vehicle' };
        var animalNames = {14:'Bird',15:'Cat',16:'Dog',17:'Horse',18:'Sheep',19:'Cow',20:'Elephant',21:'Bear',22:'Zebra',23:'Giraffe'};
        for (var j = 0; j < classIds.length; j++) {
            var animal = animalNames[classIds[j]];
            if (animal) return { title: animal + ' detected', badge: animal, kind: 'animal' };
        }
        return { title: 'Activity detected', badge: 'Motion', kind: 'activity' };
    }

    function renderCameraAlerts(alerts, cameraName) {
        var list = document.getElementById('camera-alert-list');
        var source = document.getElementById('camera-alerts-source');
        if (!list) return;
        alerts = Array.isArray(alerts) ? alerts.slice(0, config.maxAlerts || 5) : [];
        if (source) source.textContent = 'Clearcam · ' + alerts.length + ' detection' + (alerts.length === 1 ? '' : 's');
        if (!alerts.length) {
            list.innerHTML = '<div class="camera-alert-time">No detections yet. Snapshots appear when a person, animal or vehicle enters view.</div>';
            return;
        }
        list.innerHTML = alerts.map(function(alert) {
            var rawUrl = String(alert.url || '');
            var imageUrl = rawUrl ? encodeURI('/clearcam' + (rawUrl.charAt(0) === '/' ? rawUrl : '/' + rawUrl)) : '';
            var alertCamera = alert.cam_name || cameraName || 'Outdoor camera';
            var when = cameraAlertWhen(alert);
            var kind = cameraAlertKind(alert);
            var preview = encodeURIComponent(JSON.stringify({
                imageUrl: imageUrl,
                title: kind.title,
                camera: alertCamera,
                when: when,
                folder: String(alert.folder || ''),
                filename: String(alert.filename || '')
            }));
            return '<button class="camera-alert-item" type="button" data-camera-alert="' + escapeHtml(preview) + '" aria-label="Open ' + escapeHtml(kind.title + ', ' + when) + '">' +
                '<div class="camera-alert-media">' +
                    (imageUrl ? '<img class="camera-alert-thumb" src="' + escapeHtml(resourceUrl(imageUrl)) + '" alt="' + escapeHtml(kind.title) + '" referrerpolicy="no-referrer">' : '<div class="camera-alert-thumb"></div>') +
                    '<span class="camera-alert-badge ' + escapeHtml(kind.kind) + '">' + escapeHtml(kind.badge) + '</span>' +
                    '<span class="camera-alert-open" aria-hidden="true"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.7v10.6c0 .7.8 1.1 1.4.7l7.8-5.3c.5-.3.5-1.1 0-1.4L5.4 2C4.8 1.6 4 2 4 2.7Z"/></svg></span>' +
                '</div>' +
                '<div class="camera-alert-copy">' +
                    '<div class="camera-alert-time">' + escapeHtml(when) + ' · ' + escapeHtml(alertCamera) + '</div>' +
                '</div>' +
            '</button>';
        }).join('');
    }

    var cameraDetectionReturnFocus = null;

    function closeCameraDetection() {
        var modal = document.getElementById('camera-detection-modal');
        var video = document.getElementById('camera-detection-video');
        var image = document.getElementById('camera-detection-image');
        if (!modal || modal.hidden) return;
        video.pause();
        video.removeAttribute('src');
        video.load();
        image.removeAttribute('src');
        modal.close(); modal.hidden = true;
        if (cameraDetectionReturnFocus && document.contains(cameraDetectionReturnFocus)) {
            cameraDetectionReturnFocus.focus();
        }
        cameraDetectionReturnFocus = null;
    }

    function openCameraDetection(alert, trigger) {
        var modal = document.getElementById('camera-detection-modal');
        var title = document.getElementById('camera-detection-title');
        var meta = document.getElementById('camera-detection-meta');
        var image = document.getElementById('camera-detection-image');
        var video = document.getElementById('camera-detection-video');
        var status = document.getElementById('camera-detection-status');
        if (!modal || !alert || !alert.imageUrl) return;

        cameraDetectionReturnFocus = trigger || null;
        title.textContent = alert.title || 'Activity detected';
        meta.textContent = (alert.when || 'Recent') + ' · ' + (alert.camera || 'Outdoor camera');
        image.src = resourceUrl(alert.imageUrl);
        image.alt = (alert.title || 'Camera detection') + ' — ' + (alert.when || 'recent');
        image.hidden = false;
        video.hidden = true;
        status.className = 'camera-detection-status';
        status.textContent = 'Preparing video…';
        modal.hidden = false; if(!modal.open) modal.showModal();
        document.getElementById('camera-detection-close').focus();

        if (!alert.folder || !alert.filename) {
            status.className = 'camera-detection-status frame';
            status.textContent = 'Detection frame';
            return;
        }
        video.src = resourceUrl('/api/camera-alert-clip?folder=' + encodeURIComponent(alert.folder) + '&filename=' + encodeURIComponent(alert.filename));
        video.load();
    }

    (function bindCameraDetectionModal() {
        var list = document.getElementById('camera-alert-list');
        var modal = document.getElementById('camera-detection-modal');
        var close = document.getElementById('camera-detection-close');
        var video = document.getElementById('camera-detection-video');
        var image = document.getElementById('camera-detection-image');
        var status = document.getElementById('camera-detection-status');
        if (list) list.addEventListener('click', function(event) {
            var item = event.target.closest ? event.target.closest('[data-camera-alert]') : null;
            if (!item) return;
            try {
                openCameraDetection(JSON.parse(decodeURIComponent(item.getAttribute('data-camera-alert'))), item);
            } catch (_) {}
        });
        if (close) close.addEventListener('click', closeCameraDetection);
        if (modal) modal.addEventListener('click', function(event) {
            if (event.target === modal) closeCameraDetection();
        });
        if (video) {
            video.addEventListener('canplay', function() {
                if (!video.src) return;
                image.hidden = true;
                video.hidden = false;
                status.className = 'camera-detection-status ready';
                status.textContent = 'Detection video';
                var playPromise = video.play();
                if (playPromise && playPromise.catch) playPromise.catch(function() {});
            });
            video.addEventListener('error', function() {
                video.hidden = true;
                image.hidden = false;
                status.className = 'camera-detection-status frame';
                status.textContent = 'Detection frame';
            });
        }
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && modal && !modal.hidden) closeCameraDetection();
        });
    })();

    async function loadCameraAlerts() {
        var list = document.getElementById('camera-alert-list');
        var source = document.getElementById('camera-alerts-source');
        try {
            var data = await fetchJSON('/api/camera-alerts', 0);
            renderCameraAlerts(data.alerts, data.cameraName);
        } catch (_) {
            if (source) source.textContent = 'Clearcam · offline';
            if (list) list.innerHTML = '<div class="camera-alert-state error">Alerts will return when Clearcam reconnects.</div>';
        }
    }

    loadCameraAlerts();
    setInterval(loadCameraAlerts, config.refreshSeconds ? config.refreshSeconds*1000 : REFRESH.CAMERA_ALERTS);

}
