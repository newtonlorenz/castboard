export async function mount({element,context,config}) {
 const {scope}=await import(context.source('runtime').asset('runtime.js'));
 const {document,request,setTimeout,setInterval,clearTimeout}=await scope(element,context,"<div class=\"card player-card\">\n            <div class=\"card-label\">Now Playing</div>\n            <div class=\"player-top\">\n                <div id=\"player-art\" class=\"player-art placeholder\" aria-label=\"Player art placeholder\">\u266a</div>\n                <div class=\"player-meta\">\n                    <div class=\"player-kicker\">\n                        <div id=\"player-speaker\" class=\"player-speaker\">Sonos</div>\n                        <div id=\"player-state\" class=\"player-state\" data-state=\"idle\" aria-live=\"polite\">\n                            <span class=\"player-state-eq\" aria-hidden=\"true\"><i></i><i></i><i></i></span>\n                            <span id=\"player-state-label\">Ready</span>\n                        </div>\n                    </div>\n                    <div id=\"player-title\" class=\"player-title\" title=\"Open Spotify Web\">Nothing playing</div>\n                    <div id=\"player-subtitle\" class=\"player-subtitle\">Spotify / Sonos</div>\n                </div>\n            </div>\n            <div class=\"player-controls\">\n                <button class=\"player-btn\" id=\"player-radio\" aria-label=\"Start radio from current song\" title=\"Song Radio\">\n                    <svg class=\"player-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                        <circle class=\"icon-fill\" cx=\"12\" cy=\"12\" r=\"2.2\"></circle>\n                        <path d=\"M8.4 8.5a5 5 0 0 0 0 7M15.6 8.5a5 5 0 0 1 0 7\"></path>\n                        <path d=\"M5.6 5.8a8.8 8.8 0 0 0 0 12.4M18.4 5.8a8.8 8.8 0 0 1 0 12.4\"></path>\n                    </svg>\n                </button>\n                <button class=\"player-btn\" id=\"player-prev\" aria-label=\"Previous track\">\n                    <svg class=\"player-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                        <path d=\"M7 6v12\"></path>\n                        <path class=\"icon-fill\" d=\"M18.2 6.5v11a1 1 0 0 1-1.55.83L8.8 12.83a1 1 0 0 1 0-1.66l7.85-5.5a1 1 0 0 1 1.55.83Z\"></path>\n                    </svg>\n                </button>\n                <button class=\"player-btn\" id=\"player-toggle\" data-state=\"paused\" aria-label=\"Play or pause\">\n                    <svg class=\"player-icon icon-play\" viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                        <path class=\"icon-fill\" d=\"M8.25 5.7v12.6a1.15 1.15 0 0 0 1.8.95l8.45-6.3a1.18 1.18 0 0 0 0-1.9l-8.45-6.3a1.15 1.15 0 0 0-1.8.95Z\"></path>\n                    </svg>\n                    <svg class=\"player-icon icon-pause\" viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                        <rect class=\"icon-fill\" x=\"7\" y=\"5.5\" width=\"3.6\" height=\"13\" rx=\"1.1\"></rect>\n                        <rect class=\"icon-fill\" x=\"13.4\" y=\"5.5\" width=\"3.6\" height=\"13\" rx=\"1.1\"></rect>\n                    </svg>\n                </button>\n                <button class=\"player-btn\" id=\"player-next\" aria-label=\"Next track\">\n                    <svg class=\"player-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                        <path class=\"icon-fill\" d=\"M5.8 6.5v11a1 1 0 0 0 1.55.83l7.85-5.5a1 1 0 0 0 0-1.66l-7.85-5.5a1 1 0 0 0-1.55.83Z\"></path>\n                        <path d=\"M17 6v12\"></path>\n                    </svg>\n                </button>\n                <button class=\"player-btn\" id=\"player-dj\" aria-label=\"Start Spotify DJ\" title=\"Spotify DJ\">\n                    <svg class=\"player-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                        <path d=\"M5 15.5v-3M9 18v-8M13 16.5v-5M17 18v-8\"></path>\n                        <path d=\"m18.5 4 .55 1.45L20.5 6l-1.45.55L18.5 8l-.55-1.45L16.5 6l1.45-.55L18.5 4Z\"></path>\n                    </svg>\n                </button>\n            </div>\n            <div class=\"player-actions\">\n                <button class=\"player-select-btn\" id=\"player-choose-speaker\">Choose Sonos</button>\n                <button class=\"player-select-btn\" id=\"player-choose-playlist\">Playlists</button>\n                <button id=\"player-volume\" class=\"player-volume\" type=\"button\">Vol --</button>\n            </div>\n        </div><dialog id=\"link-modal\" class=\"link-modal\">\n        <div class=\"link-modal-panel\">\n            <div class=\"link-modal-topbar\">\n                <div id=\"link-modal-title\" class=\"link-modal-title\">Open link</div>\n                <button id=\"link-modal-cast\" class=\"link-modal-btn\">Open on Hub</button>\n                <button id=\"link-modal-close\" class=\"link-modal-btn\">Close</button>\n            </div>\n            <div class=\"link-modal-body\">\n                <div id=\"link-modal-launcher\" class=\"link-modal-launcher\">\n                    <div class=\"link-modal-launcher-title\">Open Spotify</div>\n                    <div class=\"link-modal-launcher-copy\">Spotify Web does not embed reliably inside DashCast. Use the button below to open it on the Hub, or keep using the Sonos controls here in Dashboard.</div>\n                    <button id=\"link-modal-launcher-btn\" class=\"link-modal-launcher-btn\">Open Spotify on Hub</button>\n                </div>\n                <div id=\"sonos-group-list\" class=\"sonos-group-list\"></div>\n                <div id=\"spotify-playlist-list\" class=\"spotify-playlist-list\"></div>\n                <div id=\"sonos-volume-control\" class=\"sonos-volume-control\">\n                    <div id=\"sonos-volume-value\" class=\"sonos-volume-value\">--</div>\n                    <input id=\"sonos-volume-slider\" class=\"sonos-volume-slider\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"Sonos volume\">\n                </div>\n                <iframe id=\"link-modal-frame\" class=\"link-modal-frame\" referrerpolicy=\"no-referrer\"></iframe>\n            </div>\n        </div>\n    </dialog>",'mission.css');

    if(config.showControls===false) for(const node of document.querySelectorAll('.player-controls,.player-actions,.player-selects'))node.hidden=true;
    // ===== CONFIGURATION =====

    const REFRESH = {"STATUS": 60000};

    // ===== UTILITY: Fetch with Retry =====

    async function fetchJSON(url, options) { return request(url, options && typeof options === 'object' ? options : {}); }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>'"]/g, function(ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch];
        });
    }

    // ===== STATUS =====

    function statusDotClass(status) {
        var green = ['healthy', 'nominal', 'live', 'active'];
        var yellow = ['stale', 'quiet', 'idle'];
        if (green.indexOf(status) !== -1) return 'green';
        if (yellow.indexOf(status) !== -1) return 'yellow';
        return 'red';
    }

    var SONOS_API_BASE = '';
    var LINK_API_BASE = '';
    var activeModalUrl = null;
    var currentSonosVolume = 0;
    var currentSpotifyTrack = '';
    var savedSpotifyTrack = '';
    var savingSpotifyTrack = '';
    var sonosVolumeCommitTimer = null;
    var playerActionError = '';

    function openLinkModal(url, title, options) {
        activeModalUrl = url;
        var modal = document.getElementById('link-modal');
        modal.classList.remove('spotify-home-mode');
        var frame = document.getElementById('link-modal-frame');
        var launcher = document.getElementById('link-modal-launcher');
        var groupList = document.getElementById('sonos-group-list');
        var playlistList = document.getElementById('spotify-playlist-list');
        var volumeControl = document.getElementById('sonos-volume-control');
        var embed = !(options && options.launchOnly);
        document.getElementById('link-modal-title').textContent = title || url;
        launcher.classList.toggle('open', !embed);
        groupList.classList.remove('open');
        groupList.innerHTML = '';
        playlistList.classList.remove('open');
        playlistList.innerHTML = '';
        volumeControl.classList.remove('open');
        document.getElementById('link-modal-cast').style.display = '';
        frame.style.display = embed ? 'block' : 'none';
        frame.src = embed ? url : 'about:blank';
        modal.classList.add('open'); if(!modal.open) modal.showModal();
    }

    function closeLinkModal() {
        document.getElementById('link-modal').classList.remove('open', 'spotify-home-mode'); document.getElementById('link-modal').close();
        document.getElementById('link-modal-frame').src = 'about:blank';
        document.getElementById('link-modal-frame').style.display = 'block';
        document.getElementById('link-modal-launcher').classList.remove('open');
        document.getElementById('sonos-group-list').classList.remove('open');
        document.getElementById('sonos-group-list').innerHTML = '';
        document.getElementById('spotify-playlist-list').classList.remove('open');
        document.getElementById('spotify-playlist-list').innerHTML = '';
        document.getElementById('sonos-volume-control').classList.remove('open');
        document.getElementById('link-modal-cast').style.display = '';
        activeModalUrl = null;
    }

    async function castModalLink() {
        if (!activeModalUrl) return;
        await request(LINK_API_BASE + '/api/link/launch?url=' + encodeURIComponent(activeModalUrl), { method: 'POST' });
    }

    async function openSonosChooser() {
        var modal = document.getElementById('link-modal');
        modal.classList.remove('spotify-home-mode');
        var frame = document.getElementById('link-modal-frame');
        var launcher = document.getElementById('link-modal-launcher');
        var groupList = document.getElementById('sonos-group-list');
        document.getElementById('link-modal-title').textContent = 'Choose Sonos';
        activeModalUrl = null;
        launcher.classList.remove('open');
        frame.style.display = 'none';
        frame.src = 'about:blank';
        document.getElementById('link-modal-cast').style.display = 'none';
        groupList.classList.add('open');
        groupList.innerHTML = '<div class="sonos-group-empty">Looking for Sonos speakers…</div>';
        modal.classList.add('open'); if(!modal.open) modal.showModal();

        try {
            var data = await fetchJSON(SONOS_API_BASE + '/api/sonos/groups');
            var groups = data.groups || [];
            if (!groups.length) {
                groupList.innerHTML = '<div class="sonos-group-empty">No speakers found. Check that your media service can reach the speakers on your network.</div>';
                return;
            }
            groupList.innerHTML = groups.map(function(group) {
                var members = (group.members || []).join(' • ');
                var name = group.coordinator || 'Sonos Group';
                return '<div class="sonos-group-item" data-speaker="' + escapeHtml(name) + '">' +
                    '<div class="sonos-group-name">' + escapeHtml(name) + '</div>' +
                    '<div class="sonos-group-members">' + escapeHtml(members || 'No group members reported') + '</div>' +
                '</div>';
            }).join('');
            groupList.querySelectorAll('.sonos-group-item').forEach(function(el) {
                el.addEventListener('click', async function() {
                    var speaker = el.getAttribute('data-speaker');
                    document.getElementById('player-speaker').textContent = speaker;
                    document.getElementById('player-choose-speaker').textContent = 'Speaker: ' + speaker;
                    document.getElementById('player-choose-speaker').title = speaker;
                    closeLinkModal();
                    try {
                        await fetchJSON(SONOS_API_BASE + '/api/sonos/select?speaker=' + encodeURIComponent(speaker), { method: 'POST' }, 0);
                        loadPlayer();
                    } catch (err) {
                        setSpotifyStatus('Could not select ' + speaker + ': ' + errorMessage(err), true);
                    }
                });
            });
        } catch (e) {
            groupList.innerHTML = '<div class="sonos-group-empty">Could not load Sonos speakers from the local service.</div>';
        }
    }

    function spotifyHue(value) {
        var hash = 0;
        String(value || '').split('').forEach(function(ch) { hash = ((hash << 5) - hash) + ch.charCodeAt(0); });
        return Math.abs(hash) % 360;
    }

    function spotifyArtwork(item, className) {
        if (item.artwork) {
            return '<img class="' + className + '" src="' + escapeHtml(item.artwork) + '" alt="" loading="lazy" referrerpolicy="no-referrer">';
        }
        var initial = String(item.title || 'S').trim().charAt(0).toUpperCase();
        return '<div class="' + className + ' spotify-home-art-fallback" style="--spotify-hue:' + spotifyHue(item.uri || item.title) + '">' + escapeHtml(initial) + '</div>';
    }

    function spotifyPlayIcon() {
        return '<span class="spotify-home-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.4v13.2c0 .8.9 1.25 1.55.8l9.05-6.6a.98.98 0 0 0 0-1.6L9.55 4.6A.96.96 0 0 0 8 5.4Z"></path></svg></span>';
    }

    function spotifyItemAttrs(item) {
        return ' data-spotify-uri="' + escapeHtml(item.uri) + '" data-spotify-title="' + escapeHtml(item.title) + '" data-spotify-type="' + escapeHtml(item.type || '') + '"';
    }

    function renderSpotifyQuick(items) {
        return '<div class="spotify-home-quick-grid">' + items.slice(0, 6).map(function(item) {
            return '<button type="button" class="spotify-home-quick"' + spotifyItemAttrs(item) + '>' +
                spotifyArtwork(item, 'spotify-home-quick-art') +
                '<span class="spotify-home-quick-title">' + escapeHtml(item.title) + '</span>' +
                spotifyPlayIcon() +
            '</button>';
        }).join('') + '</div>';
    }

    function renderSpotifyRail(section) {
        return '<section class="spotify-home-section">' +
            '<div class="spotify-home-section-head"><h3 class="spotify-home-section-title">' + escapeHtml(section.title) + '</h3>' +
            '<span class="spotify-home-section-note">Tap to play on Office</span></div>' +
            '<div class="spotify-home-rail">' + (section.items || []).slice(0, 5).map(function(item) {
                return '<button type="button" class="spotify-home-card"' + spotifyItemAttrs(item) + '>' +
                    '<span class="spotify-home-card-art-wrap">' + spotifyArtwork(item, 'spotify-home-card-art') + spotifyPlayIcon() + '</span>' +
                    '<span class="spotify-home-card-title">' + escapeHtml(item.title) + '</span>' +
                    '<span class="spotify-home-card-subtitle">' + escapeHtml(item.subtitle || (item.type === 'track' ? 'Recently played' : 'Playlist')) + '</span>' +
                '</button>';
            }).join('') + '</div>' +
        '</section>';
    }

    function bindSpotifyHomeActions(container) {
        container.querySelectorAll('[data-spotify-uri]').forEach(function(el) {
            el.addEventListener('click', async function() {
                var uri = el.getAttribute('data-spotify-uri');
                var title = el.getAttribute('data-spotify-title');
                var type = el.getAttribute('data-spotify-type');
                if (type === 'playlist' || uri.indexOf('spotify:playlist:') === 0) {
                    document.getElementById('player-choose-playlist').textContent = 'Playlist: ' + title;
                    document.getElementById('player-choose-playlist').title = title;
                }
                setPlayerBusy(true);
                setSpotifyStatus('Starting ' + title + '…', false);
                closeLinkModal();
                try {
                    await fetchJSON(SONOS_API_BASE + '/api/sonos/open', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uri: uri, title: title }),
                    }, 0);
                    setSpotifyStatus('Playing ' + title, false);
                    loadPlayer();
                } catch (err) {
                    setSpotifyStatus('Could not play ' + title + ': ' + errorMessage(err), true);
                } finally {
                    setPlayerBusy(false);
                }
            });
        });

        var search = container.querySelector('.spotify-library-search');
        if (search) search.addEventListener('input', function() {
            var query = search.value.trim().toLowerCase();
            container.querySelectorAll('.spotify-library-item').forEach(function(item) {
                item.hidden = query && (item.getAttribute('data-search') || '').indexOf(query) === -1;
            });
        });
    }

    function spotifyHomeSkeleton() {
        var quick = Array(6).fill('<div class="spotify-home-quick"><div class="spotify-home-quick-art"></div><span class="spotify-home-quick-title">Loading recommendation</span></div>').join('');
        var cards = Array(5).fill('<div class="spotify-home-card"><div class="spotify-home-card-art-wrap"></div><div class="spotify-home-card-title">Loading</div><div class="spotify-home-card-subtitle">Spotify suggestion</div></div>').join('');
        return '<div class="spotify-home-skeleton"><div class="spotify-home-heading"><div><h2>For you</h2><p>Reading your Spotify listening</p></div></div>' +
            '<div class="spotify-home-quick-grid">' + quick + '</div>' +
            '<section class="spotify-home-section"><div class="spotify-home-section-head"><h3 class="spotify-home-section-title">Recently played</h3></div><div class="spotify-home-rail">' + cards + '</div></section></div>';
    }

    var spotifyHomeRequest = 0;
    var spotifyHomeLastGood = null;

    async function fetchSpotifyHome() {
        var controller = new AbortController();
        var timeout = setTimeout(function() { controller.abort(); }, 45000);
        try {
            var data = await fetchJSON(SONOS_API_BASE + '/api/sonos/playlists', { signal: controller.signal }, 0);
            if (!data || (!Array.isArray(data.sections) && !Array.isArray(data.playlists))) throw new Error('Spotify returned an incomplete response');
            spotifyHomeLastGood = data;
            try { localStorage.setItem('spotify-home-last-good', JSON.stringify(data)); } catch (_) {}
            return data;
        } catch (error) {
            var saved = spotifyHomeLastGood;
            if (!saved) {
                try { saved = JSON.parse(localStorage.getItem('spotify-home-last-good') || 'null'); } catch (_) {}
            }
            if (saved && (Array.isArray(saved.sections) || Array.isArray(saved.playlists))) {
                return Object.assign({}, saved, { stale: true, cached: true });
            }
            if (error.name === 'AbortError') throw new Error('Spotify took too long to respond. Try again shortly.');
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    async function openSpotifyPlaylists() {
        var request = ++spotifyHomeRequest;
        var modal = document.getElementById('link-modal');
        var frame = document.getElementById('link-modal-frame');
        var launcher = document.getElementById('link-modal-launcher');
        var groupList = document.getElementById('sonos-group-list');
        var playlistList = document.getElementById('spotify-playlist-list');
        document.getElementById('sonos-volume-control').classList.remove('open');
        activeModalUrl = null;
        modal.classList.add('spotify-home-mode');
        document.getElementById('link-modal-title').textContent = 'Spotify Home';
        document.getElementById('link-modal-cast').style.display = 'none';
        launcher.classList.remove('open');
        groupList.classList.remove('open');
        groupList.innerHTML = '';
        frame.style.display = 'none';
        frame.src = 'about:blank';
        playlistList.classList.add('open');
        playlistList.innerHTML = spotifyHomeSkeleton();
        modal.classList.add('open'); if(!modal.open) modal.showModal();

        try {
            var data = await fetchSpotifyHome();
            if (request !== spotifyHomeRequest || !modal.classList.contains('open') || !modal.classList.contains('spotify-home-mode')) return;
            var sections = data.sections || [];
            var quick = sections.find(function(section) { return section.id === 'quick'; }) || { items: [] };
            var rails = sections.filter(function(section) { return section.id !== 'quick' && (section.items || []).length; });
            var playlists = data.playlists || [];
            if (!(quick.items || []).length && !rails.length && !playlists.length) {
                playlistList.innerHTML = '<div class="spotify-home-empty">Spotify has no suggestions available right now.<br><button class="spotify-home-retry" type="button">Try again</button></div>';
                playlistList.querySelector('.spotify-home-retry').addEventListener('click', openSpotifyPlaylists);
                return;
            }

            var hour = new Date().getHours();
            var greeting = hour < 12 ? 'Good morning' : (hour < 18 ? 'Good afternoon' : 'Good evening');
            document.getElementById('link-modal-title').textContent = 'Spotify Home · ' + (data.targetRoom || 'Office');
            var feedStatus = data.stale ? 'Spotify refresh is unavailable or in progress. Showing your last available suggestions; reopen to refresh.' : 'Suggestions based on your Spotify listening';
            var html = '<div class="spotify-home-heading"><div><h2>' + greeting + '</h2><p role="status">' + escapeHtml(feedStatus) + '</p></div></div>' +
                renderSpotifyQuick(quick.items || []) +
                rails.map(renderSpotifyRail).join('');

            if (playlists.length) {
                html += '<section class="spotify-home-section"><div class="spotify-home-section-head"><h3 class="spotify-home-section-title">Your playlists</h3><span class="spotify-home-section-note">' + escapeHtml(data.total || playlists.length) + ' saved</span></div>' +
                    '<div class="spotify-library-tools"><input class="spotify-library-search" type="search" placeholder="Filter your playlists" aria-label="Filter your Spotify playlists"></div>' +
                    '<div class="spotify-library-grid">' + playlists.map(function(item) {
                        var searchText = (item.title + ' ' + (item.subtitle || '')).toLowerCase();
                        return '<button type="button" class="spotify-library-item" data-search="' + escapeHtml(searchText) + '"' + spotifyItemAttrs(item) + '>' +
                            spotifyArtwork(item, 'spotify-library-art') +
                            '<span class="spotify-library-name">' + escapeHtml(item.title) + '</span>' +
                        '</button>';
                    }).join('') + '</div></section>';
            }
            playlistList.innerHTML = html;
            playlistList.scrollTop = 0;
            bindSpotifyHomeActions(playlistList);
        } catch (err) {
            if (request !== spotifyHomeRequest || !modal.classList.contains('open') || !modal.classList.contains('spotify-home-mode')) return;
            playlistList.innerHTML = '<div class="spotify-home-empty">Could not load Spotify suggestions.<br><span>' + escapeHtml(errorMessage(err)) + '</span><br><button class="spotify-home-retry" type="button">Try again</button></div>';
            playlistList.querySelector('.spotify-home-retry').addEventListener('click', openSpotifyPlaylists);
        }
    }

    function openSonosVolume() {
        var modal = document.getElementById('link-modal');
        modal.classList.remove('spotify-home-mode');
        var frame = document.getElementById('link-modal-frame');
        var control = document.getElementById('sonos-volume-control');
        activeModalUrl = null;
        document.getElementById('link-modal-title').textContent = 'Sonos Volume';
        document.getElementById('link-modal-cast').style.display = 'none';
        document.getElementById('link-modal-launcher').classList.remove('open');
        document.getElementById('sonos-group-list').classList.remove('open');
        document.getElementById('spotify-playlist-list').classList.remove('open');
        frame.style.display = 'none';
        frame.src = 'about:blank';
        document.getElementById('sonos-volume-slider').value = currentSonosVolume;
        document.getElementById('sonos-volume-value').textContent = currentSonosVolume;
        control.classList.add('open');
        modal.classList.add('open'); if(!modal.open) modal.showModal();
    }

    async function commitSonosVolume(value) {
        value = Math.max(0, Math.min(100, Number(value) || 0));
        currentSonosVolume = value;
        document.getElementById('player-volume').textContent = 'Vol ' + value;
        document.getElementById('sonos-volume-value').textContent = value;
        try {
            var data = await fetchJSON(SONOS_API_BASE + '/api/sonos/volume?value=' + encodeURIComponent(value), { method: 'POST' }, 0);
            var confirmed = Number(data.volume);
            if (data.volume !== null && data.volume !== undefined && !isNaN(confirmed)) {
                currentSonosVolume = confirmed;
                document.getElementById('player-volume').textContent = 'Vol ' + confirmed;
                document.getElementById('sonos-volume-slider').value = confirmed;
                document.getElementById('sonos-volume-value').textContent = confirmed;
            }
        } catch (err) {
            setSpotifyStatus('Could not set Sonos volume: ' + errorMessage(err), true);
        }
    }

    function scheduleSonosVolume(value) {
        value = Math.max(0, Math.min(100, Number(value) || 0));
        currentSonosVolume = value;
        document.getElementById('player-volume').textContent = 'Vol ' + value;
        document.getElementById('sonos-volume-value').textContent = value;
        clearTimeout(sonosVolumeCommitTimer);
        sonosVolumeCommitTimer = setTimeout(function() {
            sonosVolumeCommitTimer = null;
            commitSonosVolume(value);
        }, 180);
    }

    document.getElementById('link-modal-close').addEventListener('click', closeLinkModal);
    document.getElementById('link-modal-cast').addEventListener('click', castModalLink);
    document.getElementById('link-modal-launcher-btn').addEventListener('click', castModalLink);
    document.getElementById('link-modal').addEventListener('click', function(e) {
        if (e.target && e.target.id === 'link-modal') closeLinkModal();
    });

    var djButton = document.getElementById('player-dj');
    djButton.textContent = 'DJ';
    djButton.style.fontSize = '15px';
    djButton.style.fontWeight = '800';
    var radioButton = document.getElementById('player-radio');
    radioButton.title = 'Create radio station from this song';
    radioButton.setAttribute('aria-label', radioButton.title);
    radioButton.style.display = 'flex';
    radioButton.style.flexDirection = 'column';
    radioButton.style.alignItems = 'center';
    radioButton.style.justifyContent = 'center';
    var radioLabel = globalThis.document.createElement('span');
    radioLabel.textContent = 'Radio';
    radioLabel.style.cssText = 'font-size:9px;font-weight:700;line-height:10px';
    radioButton.appendChild(radioLabel);

    var progressData = null;
    var progressUpdatedAt = 0;
    var progressBar = globalThis.document.createElement('div');
    progressBar.id = 'player-progress';
    progressBar.setAttribute('role', 'progressbar');
    progressBar.setAttribute('aria-label', 'Track progress');
    progressBar.setAttribute('aria-valuemin', '0');
    progressBar.setAttribute('aria-valuemax', '100');
    progressBar.style.cssText = 'height:3px;margin-top:10px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden';
    var progressFill = globalThis.document.createElement('div');
    progressFill.style.cssText = 'height:100%;width:0;background:var(--accent,#1ed760);border-radius:inherit;transition:width 1s linear';
    progressBar.appendChild(progressFill);
    document.querySelector('.player-top').after(progressBar);
    function playbackSeconds(value) {
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        var parts = String(value || '').split(':').map(Number);
        return parts.every(Number.isFinite) ? parts.reduce(function(total, part) {return total * 60 + part;}, 0) : 0;
    }
    function updateProgress() {
        var duration = playbackSeconds(progressData && progressData.duration);
        var elapsed = playbackSeconds(progressData && progressData.position);
        if (progressData && progressData.state === 'PLAYING') elapsed += (Date.now() - progressUpdatedAt) / 1000;
        var percent = duration > 0 ? Math.max(0, Math.min(100, elapsed / duration * 100)) : 0;
        progressBar.hidden = duration <= 0;
        progressFill.style.width = percent + '%';
        progressBar.setAttribute('aria-valuenow', String(Math.round(percent)));
        progressBar.setAttribute('aria-valuetext', Math.floor(Math.min(elapsed, duration)) + ' of ' + Math.floor(duration) + ' seconds');
    }
    updateProgress();
    setInterval(updateProgress, 1000);

    var likeButton = globalThis.document.createElement('button');
    likeButton.type = 'button';
    likeButton.className = 'player-btn';
    likeButton.id = 'player-like';
    likeButton.innerHTML = '<svg class="player-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"></path></svg>';
    likeButton.disabled = true;
    likeButton.title = 'Add to liked songs';
    likeButton.setAttribute('aria-label', likeButton.title);
    document.querySelector('.player-controls').appendChild(likeButton);

    function updateLikeButton() {
        var saved = !!currentSpotifyTrack && savedSpotifyTrack === currentSpotifyTrack;
        likeButton.disabled = !currentSpotifyTrack || saved || !!savingSpotifyTrack;
        likeButton.title = savingSpotifyTrack ? 'Adding to liked songs…' : saved ? 'Added to liked songs' : 'Add to liked songs';
        likeButton.setAttribute('aria-label', likeButton.title);
        likeButton.setAttribute('aria-pressed', String(saved));
        likeButton.querySelector('path').style.fill = saved ? 'currentColor' : 'none';
    }

    likeButton.addEventListener('click', async function() {
        var trackUri = currentSpotifyTrack;
        if (!trackUri || savingSpotifyTrack) return;
        savingSpotifyTrack = trackUri;
        updateLikeButton();
        try {
            await fetchJSON(SONOS_API_BASE + '/api/sonos/like', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({trackUri: trackUri})
            }, 0);
            savedSpotifyTrack = trackUri;
            if (currentSpotifyTrack === trackUri) setSpotifyStatus('Added to liked songs', false);
        } catch (error) {
            setSpotifyStatus('Could not add to liked songs: ' + errorMessage(error), true);
        } finally {
            savingSpotifyTrack = '';
            updateLikeButton();
        }
    });

    function setPlayerArt(url) {
        var art = document.getElementById('player-art');
        if (url) {
            art.outerHTML = '<img id="player-art" class="player-art" alt="Album art" src="' + escapeHtml(url) + '" />';
        } else {
            art.outerHTML = '<div id="player-art" class="player-art placeholder" aria-label="Player art placeholder">♪</div>';
        }
        document.getElementById('player-art').addEventListener('click', openSpotifyWeb);
    }

    function setSpotifyStatus(message, isError) {
        var subtitle = document.getElementById('player-subtitle');
        subtitle.textContent = message;
        subtitle.style.color = isError ? 'var(--danger)' : 'var(--text-muted)';
    }

    function setPlayerBusy(isBusy) {
        document.querySelector('.player-card').classList.toggle('busy', !!isBusy);
    }

    function errorMessage(e) {
        try {
            var parsed = JSON.parse(e.message);
            return parsed.error || e.message;
        } catch (_) {
            return e.message || 'Unknown error';
        }
    }

    function setPlayerToggleState(isPlaying) {
        var toggle = document.getElementById('player-toggle');
        toggle.dataset.state = isPlaying ? 'playing' : 'paused';
        toggle.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
        toggle.title = isPlaying ? 'Pause' : 'Play';
    }

    function setPlayerPlaybackState(state, hasSong, isReachable) {
        var normalized = String(state || '').toUpperCase();
        var visualState = 'idle';
        var label = 'Ready';
        if (isReachable === false || normalized === 'OFFLINE' || normalized === 'UNAVAILABLE') {
            visualState = 'offline';
            label = 'Offline';
        } else if (normalized === 'PLAYING') {
            visualState = 'playing';
            label = 'Playing';
        } else if (normalized === 'TRANSITIONING') {
            visualState = 'idle';
            label = 'Connecting';
        } else if (normalized === 'PAUSED_PLAYBACK' || normalized === 'PAUSED' || hasSong) {
            visualState = 'paused';
            label = 'Paused';
        }

        var card = document.querySelector('.player-card');
        card.classList.remove('is-playing', 'is-paused', 'is-idle', 'is-offline');
        card.classList.add('is-' + visualState);
        var indicator = document.getElementById('player-state');
        indicator.dataset.state = visualState;
        document.getElementById('player-state-label').textContent = label;
    }

    async function loadPlayer() {
        try {
            var data = await fetchJSON(SONOS_API_BASE + '/api/sonos/status');
            progressData = data;
            progressUpdatedAt = Date.now();
            updateProgress();
            var trackMatch = decodeURIComponent(data.trackUri || data.uri || '').match(/spotify:track:([A-Za-z0-9]{22})(?![A-Za-z0-9])/);
            currentSpotifyTrack = trackMatch ? trackMatch[0] : '';
            updateLikeButton();
            var hasSong = !!(data.title || data.artist || data.albumArtURI);
            var rawDevice = data.raw && data.raw.device;
            var isReachable = data.reachable !== undefined ? data.reachable : !rawDevice || !!(rawDevice.ip || rawDevice.name || rawDevice.location);
            var selectedSpeaker = data.targetRoom || data.speaker || 'Sonos';
            var selectedPlaylist = data.selectedPlaylist || {};
            document.getElementById('player-speaker').textContent = selectedSpeaker;
            document.getElementById('player-choose-speaker').textContent = 'Speaker: ' + selectedSpeaker;
            document.getElementById('player-choose-speaker').title = selectedSpeaker;
            document.getElementById('player-choose-playlist').textContent = selectedPlaylist.title ? ('Playlist: ' + selectedPlaylist.title) : 'Choose Playlist';
            document.getElementById('player-choose-playlist').title = selectedPlaylist.title || 'Choose Playlist';
            document.getElementById('player-title').textContent = !isReachable
                ? (selectedSpeaker + ' unavailable')
                : (hasSong ? (data.title || 'Now playing') : 'Sonos ready');
            document.getElementById('player-subtitle').textContent = !isReachable
                ? 'Waiting for Sonos to reconnect'
                : (hasSong
                    ? ([data.artist, data.album].filter(Boolean).join(' • ') || (data.state || 'Idle'))
                    : ((data.state === 'PLAYING' ? 'Playing audio source' : 'No track metadata available')));
            if (hasSong) playerActionError = '';
            document.getElementById('player-subtitle').style.color = '';
            if (playerActionError && !hasSong) setSpotifyStatus(playerActionError, true);
            var volume = (data.volume === null || data.volume === undefined) ? null : Number(data.volume);
            if (!isReachable) volume = null;
            if (volume !== null && !isNaN(volume)) {
                currentSonosVolume = volume;
                document.getElementById('sonos-volume-slider').value = volume;
                document.getElementById('sonos-volume-value').textContent = volume;
            }
            document.getElementById('player-volume').textContent = 'Vol ' + (volume === null || isNaN(volume) ? '--' : volume);
            setPlayerToggleState(data.state === 'PLAYING');
            setPlayerPlaybackState(data.state, hasSong, isReachable);
            setPlayerArt(hasSong ? data.albumArtURI : '');
        } catch (e) {
            currentSpotifyTrack = '';
            progressData = null;
            updateProgress();
            updateLikeButton();
            var status = null;
            try { status = JSON.parse(e.message); } catch (_) {}
            if (status && status.error && (status.error.indexOf('239.255.255.250') !== -1 || status.error.indexOf('sendto: no route to host') !== -1)) {
                document.getElementById('player-speaker').textContent = status.targetRoom || 'Sonos';
                document.getElementById('player-title').textContent = 'Sonos unavailable';
                document.getElementById('player-subtitle').textContent = 'Reconnecting automatically…';
                document.getElementById('player-volume').textContent = 'Vol --';
                setPlayerToggleState(false);
                setPlayerPlaybackState('OFFLINE', false, false);
                setPlayerArt('');
            } else if (status && status.error === 'No Sonos speaker found') {
                document.getElementById('player-speaker').textContent = status.targetRoom || 'Sonos';
                document.getElementById('player-title').textContent = 'No Sonos discovered';
                document.getElementById('player-subtitle').textContent = 'Service is running, but no Sonos groups are reachable on the LAN right now';
                document.getElementById('player-volume').textContent = 'Vol --';
                setPlayerToggleState(false);
                setPlayerPlaybackState('OFFLINE', false, false);
                setPlayerArt('');
            } else {
                document.getElementById('player-speaker').textContent = 'Sonos';
                document.getElementById('player-title').textContent = 'Sonos service unavailable';
                document.getElementById('player-subtitle').textContent = 'Check the local Sonos API service';
                document.getElementById('player-volume').textContent = 'Vol --';
                setPlayerToggleState(false);
                setPlayerPlaybackState('OFFLINE', false, false);
                setPlayerArt('');
            }
        }
    }

    async function postPlayer(action) {
        if (action === 'play' || action === 'pause') {
            var isPlaying = action === 'play';
            setPlayerToggleState(isPlaying);
            setPlayerPlaybackState(isPlaying ? 'PLAYING' : 'PAUSED_PLAYBACK', true, true);
        }
        try {
            await fetchJSON(SONOS_API_BASE + '/api/sonos/' + action, { method: 'POST' }, 0);
            playerActionError = '';
            await loadPlayer();
        } catch (e) {
            playerActionError = errorMessage(e);
            await loadPlayer();
            setSpotifyStatus(playerActionError, true);
        }
    }

    async function startSongRadio() {
        var button = document.getElementById('player-radio');
        if (button.disabled) return;
        button.disabled = true;
        setPlayerBusy(true);
        setSpotifyStatus('Starting radio from this song…', false);
        try {
            var data = await fetchJSON(SONOS_API_BASE + '/api/sonos/radio', { method: 'POST' }, 0);
            setSpotifyStatus('Song Radio • ' + (data.sourceTitle || 'Current song'), false);
            await loadPlayer();
        } catch (err) {
            setSpotifyStatus('Could not start Song Radio: ' + errorMessage(err), true);
        } finally {
            button.disabled = false;
            setPlayerBusy(false);
        }
    }

    async function startSpotifyDJ() {
        var button = document.getElementById('player-dj');
        if (button.disabled) return;
        button.disabled = true;
        setPlayerBusy(true);
        setSpotifyStatus('Starting Spotify DJ…', false);
        try {
            await fetchJSON(SONOS_API_BASE + '/api/sonos/dj', { method: 'POST' }, 0);
            setSpotifyStatus('Spotify DJ on Office', false);
            await loadPlayer();
        } catch (err) {
            setSpotifyStatus('Could not start Spotify DJ: ' + errorMessage(err), true);
        } finally {
            button.disabled = false;
            setPlayerBusy(false);
        }
    }

    function openSpotifyWeb() {
        openLinkModal('https://open.spotify.com/', 'Spotify Web', { launchOnly: true });
    }

    document.getElementById('player-art').addEventListener('click', openSpotifyWeb);
    document.getElementById('player-title').addEventListener('click', openSpotifyWeb);
    document.getElementById('player-choose-speaker').addEventListener('click', openSonosChooser);
    document.getElementById('player-choose-playlist').addEventListener('click', openSpotifyPlaylists);
    document.getElementById('player-volume').addEventListener('click', openSonosVolume);
    document.getElementById('sonos-volume-slider').addEventListener('input', function() {
        scheduleSonosVolume(this.value);
    });
    document.getElementById('sonos-volume-slider').addEventListener('change', function() {
        clearTimeout(sonosVolumeCommitTimer);
        sonosVolumeCommitTimer = null;
        commitSonosVolume(this.value);
    });
    document.getElementById('player-prev').addEventListener('click', function() { postPlayer('previous'); });
    document.getElementById('player-next').addEventListener('click', function() { postPlayer('next'); });
    document.getElementById('player-radio').addEventListener('click', startSongRadio);
    document.getElementById('player-dj').addEventListener('click', startSpotifyDJ);
    document.getElementById('player-toggle').addEventListener('click', async function() {
        var isPlaying = document.getElementById('player-toggle').dataset.state === 'playing';
        await postPlayer(isPlaying ? 'pause' : 'play');
    });

    loadPlayer();
    setInterval(loadPlayer, config.refreshSeconds ? config.refreshSeconds*1000 : REFRESH.STATUS);

}
