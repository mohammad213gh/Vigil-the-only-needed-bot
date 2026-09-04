import { allServers, curSrv, esc, showToast, timeSince, updateRefreshTimestamp } from './01-foundation.mjs';
// ═══ POLLS & ANNOUNCEMENTS ═══
export async function loadPollsAnnouncements() {
    const sel = document.getElementById('paSrvSelect');
    if (!sel) return;
    if (sel.options.length <= 1 && allServers.length) {
        sel.innerHTML = '<option value="">Select a server...</option>' + allServers.map(function (s) {
            return '<option value="' + s.id + '"' + (curSrv === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
        }).join('');
    }
    const serverId = sel.value;
    const cont = document.getElementById('pollsAnnouncementsContent');
    if (!cont) return;

    if (!serverId) {
        cont.innerHTML = '<div class="empty"><p>Select a server to manage polls & announcements</p></div>';
        updateRefreshTimestamp('polls-announcements');
        return;
    }

    cont.innerHTML = '<div class="loading" style="padding:30px;text-align:center;"><div class="spin"></div></div>';

    try {
        const channelsRes = await fetch('/api/server/' + serverId + '/channels');
        const channelsData = await channelsRes.json();
        const textChannels = channelsData.filter(function(c) { return c.type === 0 || c.type === 5 || c.type === 15; });

        var html = '<div class="stg" style="margin-bottom:16px;"><label>Create Poll</label>' +
            '<div class="stg-inl" style="margin-bottom:8px;flex-wrap:wrap;">' +
            '<input type="text" id="paPollQuestion" placeholder="Poll question" style="flex:1;min-width:200px;">' +
            '<input type="text" id="paPollOpt1" placeholder="Option 1" style="flex:1;min-width:150px;">' +
            '<input type="text" id="paPollOpt2" placeholder="Option 2" style="flex:1;min-width:150px;">' +
            '<input type="text" id="paPollOpt3" placeholder="Option 3 (optional)" style="flex:1;min-width:150px;">' +
            '<input type="text" id="paPollOpt4" placeholder="Option 4 (optional)" style="flex:1;min-width:150px;">' +
            '<select id="paPollType" style="flex:0 0 150px;"><option value="single">Single Vote</option><option value="multi">Multi Vote</option><option value="anonymous">Anonymous</option></select>' +
            '<input type="number" id="paPollDuration" placeholder="Duration (hours)" value="24" min="0.25" max="720" step="0.25" style="flex:0 0 120px;">' +
            '<select id="paPollChannel" style="flex:1;min-width:200px;"><option value="">Select channel...</option>' + textChannels.map(function(c){return '<option value="' + c.id + '">#' + esc(c.name) + '</option>';}).join('') + '</select>' +
            '<button class="btn btn-s" onclick="createPollUI(\'' + serverId + '\')">Create Poll</button>' +
            '</div></div>';

        html += '<div class="stg" style="margin-top:16px;margin-bottom:16px;"><label>Create Announcement</label>' +
            '<div class="stg-inl" style="margin-bottom:8px;flex-wrap:wrap;">' +
            '<input type="text" id="paAnnounceTitle" placeholder="Title" style="flex:1;min-width:200px;">' +
            '<textarea id="paAnnounceMessage" placeholder="Message" style="flex:1;min-width:300px;min-height:80px;"></textarea>' +
            '<input type="color" id="paAnnounceColor" value="#5865F2" style="flex:0 0 80px;">' +
            '<select id="paAnnounceChannel" style="flex:1;min-width:200px;"><option value="">Select channel...</option>' + textChannels.map(function(c){return '<option value="' + c.id + '">#' + esc(c.name) + '</option>';}).join('') + '</select>' +
            '<button class="btn btn-s" onclick="createAnnouncementUI(\'' + serverId + '\')">Send Announcement</button>' +
            '</div></div>';

        cont.innerHTML = html;
    } catch (e) {
        cont.innerHTML = '<div class="empty"><p>Failed to load polls & announcements</p></div>';
    }
    updateRefreshTimestamp('polls-announcements');
}

export async function createPollUI(serverId) {
    const question = document.getElementById('paPollQuestion')?.value;
    const opt1 = document.getElementById('paPollOpt1')?.value;
    const opt2 = document.getElementById('paPollOpt2')?.value;
    const opt3 = document.getElementById('paPollOpt3')?.value;
    const opt4 = document.getElementById('paPollOpt4')?.value;
    const type = document.getElementById('paPollType')?.value;
    const durationHours = parseFloat(document.getElementById('paPollDuration')?.value) || 24;
    const channelId = document.getElementById('paPollChannel')?.value;
    const options = [opt1, opt2, opt3, opt4].filter(function(o) { return o && o.trim(); });
    if (!question || options.length < 2 || !channelId) return showToast('Fill all required fields', true);
    try {
        const r = await fetch('/api/polls/create', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guildId: serverId, channelId, question, options, multi: type === 'multi', anonymous: type === 'anonymous', durationHours })
        });
        const d = await r.json();
        if (d.success) { showToast('Poll created!'); loadPollsAnnouncements(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

export async function createAnnouncementUI(serverId) {
    const title = document.getElementById('paAnnounceTitle')?.value;
    const message = document.getElementById('paAnnounceMessage')?.value;
    const color = document.getElementById('paAnnounceColor')?.value;
    const channelId = document.getElementById('paAnnounceChannel')?.value;
    if (!title || !message || !channelId) return showToast('Fill all fields', true);
    try {
        const r = await fetch('/api/announcements/create', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guildId: serverId, channelId, title, message, color })
        });
        const d = await r.json();
        if (d.success) { showToast('Announcement sent!'); loadPollsAnnouncements(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

// ═══ KEYBOARD SHORTCUTS & ACCESSIBILITY ═══
(function() {
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ignore if typing in input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        
        const shortcuts = {
            'KeyR': () => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); location.reload(); } }, // Ctrl+R: Reload
            'KeyS': () => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); const btn = document.querySelector('.btn[onclick*="Save"], .btn[onclick*="save"]'); if (btn) btn.click(); } }, // Ctrl+S: Save
            'KeyF': () => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); const search = document.querySelector('input[placeholder*="Search"], input[id*="Search"]'); if (search) search.focus(); } }, // Ctrl+F: Focus search
            'KeyK': () => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); const search = document.querySelector('input[placeholder*="Search"], input[id*="Search"]'); if (search) search.focus(); } }, // Ctrl+K: Focus search
            'Slash': () => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); const search = document.querySelector('input[placeholder*="Search"], input[id*="Search"]'); if (search) search.focus(); } }, // Ctrl+/: Focus search
            'Escape': () => { const modals = document.querySelectorAll('.modal, [role="dialog"]'); modals.forEach(m => m.style.display = 'none'); document.querySelectorAll('.toast.show').forEach(t => t.classList.remove('show')); }, // Escape: Close modals/toasts
            'KeyG': () => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); const select = document.getElementById('geSrvSelect') || document.getElementById('paSrvSelect') || document.getElementById('rrSrvSelect') || document.getElementById('rmSrvSelect') || document.getElementById('vpSrvSelect') || document.getElementById('tvSrvSelect') || document.getElementById('wtSrvSelect') || document.getElementById('baSrvSelect') || document.getElementById('pcSrvSelect') || document.getElementById('geSrvSelect'); if (select) select.focus(); } }, // Ctrl+G: Focus server select
            'ArrowLeft': () => { if (e.altKey) { e.preventDefault(); const active = document.querySelector('.notch-link.active, .notch-mobile-link.active'); const prev = active?.previousElementSibling; if (prev && (prev.classList.contains('notch-link') || prev.classList.contains('notch-mobile-link'))) prev.click(); } }, // Alt+Left: Previous section
            'ArrowRight': () => { if (e.altKey) { e.preventDefault(); const active = document.querySelector('.notch-link.active, .notch-mobile-link.active'); const next = active?.nextElementSibling; if (next && (next.classList.contains('notch-link') || next.classList.contains('notch-mobile-link'))) next.click(); } }, // Alt+Right: Next section
        };
        
        const key = e.key === '/' ? 'Slash' : e.code;
        if (shortcuts[key]) shortcuts[key]();
    });
    
    // Announce keyboard shortcuts on load
    window.addEventListener('load', function() {
        setTimeout(function() {
            console.log('%c Dashboard Keyboard Shortcuts:', 'font-size:12px;color:#5865F2;font-weight:bold;',
                '\nCtrl+R: Reload',
                '\nCtrl+S: Save',
                '\nCtrl+F/K: Focus search',
                '\nEsc: Close modals/toasts',
                '\nCtrl+G: Focus server select',
                '\nAlt+←/→: Prev/Next section');
        }, 1000);
    });
})();

// ═══ MOBILE RESPONSIVENESS ═══
(function() {
    // Touch-friendly improvements
    document.addEventListener('touchstart', function() {}, { passive: true });
    
    // Improve scroll on mobile
    var style = document.createElement('style');
    style.textContent = 
        '@media (max-width: 768px) {' +
        '  .card { margin: 8px 0; border-radius: 12px; }' +
        '  .stg-inl { flex-direction: column; align-items: stretch; }' +
        '  .stg-inl > * { width: 100% !important; margin-bottom: 8px; }' +
        '  .btn { padding: 12px 16px; font-size: 14px; min-height: 44px; }' +
        '  .btn-s { padding: 10px 14px; font-size: 13px; min-height: 40px; }' +
        '  input, select, textarea { font-size: 16px !important; }' + // Prevent zoom on iOS
        '  .notch-nav { padding: 8px 12px; }' +
        '  .notch-body { gap: 8px; }' +
        '  .notch-link { padding: 10px 12px; min-height: 44px; }' +
        '  .card { padding: 16px; }' +
        '  .stg { margin-bottom: 16px; }' +
        '  .grid { grid-template-columns: 1fr !important; }' +
        '  .tw { padding: 12px; }' +
        '  .srv-search { flex-direction: column; }' +
        '}';
    document.head.appendChild(style);
    
    // Prevent zoom on input focus (iOS)
    var viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
    
    // Auto-hide mobile menu on link click
    document.addEventListener('click', function(e) {
        if (e.target.closest('.notch-mobile-link')) {
            var menu = document.getElementById('notchMobileMenu');
            if (menu) menu.classList.remove('open');
        }
    });
    
    // Swipe gestures for section navigation
    var touchStartX = 0;
    document.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });
    
    document.addEventListener('touchend', function(e) {
        var touchEndX = e.changedTouches[0].clientX;
        var diff = touchEndX - touchStartX;
        if (Math.abs(diff) > 50) {
            var active = document.querySelector('.notch-link.active, .notch-mobile-link.active');
            if (diff > 0) {
                var prev = active?.previousElementSibling;
                if (prev && (prev.classList.contains('notch-link') || prev.classList.contains('notch-mobile-link'))) prev.click();
            } else {
                var next = active?.nextElementSibling;
                if (next && (next.classList.contains('notch-link') || next.classList.contains('notch-mobile-link'))) next.click();
            }
        }
    }, { passive: true });
    
    // Improve form validation UX
    document.addEventListener('invalid', function(e) {
        e.target.style.borderColor = 'var(--danger)';
        e.target.style.boxShadow = '0 0 0 2px rgba(237,66,69,0.2)';
        showToast('Please fill in this field correctly', true);
    }, true);
    
    document.addEventListener('input', function(e) {
        if (e.target.style.borderColor === 'var(--danger)') {
            e.target.style.borderColor = '';
            e.target.style.boxShadow = '';
        }
    });
    
    // Lazy load images
    if ('IntersectionObserver' in window) {
        var imgObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    var img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        imgObserver.unobserve(img);
                    }
                }
            });
        }, { rootMargin: '50px' });
        document.querySelectorAll('img[data-src]').forEach(function(img) {
            imgObserver.observe(img);
        });
    }
    
    // Reduce motion preference
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion.matches) {
        document.documentElement.style.setProperty('--anim-speed', '0.01');
    }
})();

// ═══ AUDIT TRAIL UI ═══
async function loadAuditTrail() {
    const cont = document.getElementById('auditTrailContent');
    if (!cont) return;
    const serverId = document.getElementById('atSrvSelect')?.value;
    const typeFilter = document.getElementById('atTypeFilter')?.value;
    if (!cont) return;
    
    cont.innerHTML = '<div class="loading" style="padding:30px;text-align:center;"><div class="spin"></div></div>';
    
    try {
        var url = '/api/audit-trail?limit=100';
        if (serverId) url += '&guildId=' + serverId;
        if (typeFilter) url += '&type=' + typeFilter;
        
        const r = await fetch(url);
        const d = await r.json();
        const trails = d.trails || [];
        
        if (!trails.length) {
            cont.innerHTML = '<div class="empty"><p>No audit trail entries found</p></div>';
            return;
        }
        
        cont.innerHTML = trails.map(function(t) {
            var details = t.details ? JSON.parse(t.details) : {};
            return '<div class="audit-item" style="margin-bottom:8px;">' +
                '<div class="audit-ico" style="color:' + (t.type === 'config' ? '#3ba55c' : t.type === 'mod' ? '#ed4245' : '#5865F2') + ';">' +
                    (t.type === 'config' ? '⚙️' : t.type === 'mod' ? '🛡️' : '⚙️') +
                '</div>' +
                '<div class="audit-body">' +
                    '<div class="audit-h">' +
                        '<span class="audit-type">' + esc(t.action) + '</span>' +
                        '<span class="audit-ts">' + timeSince(t.created_at) + '</span>' +
                        '<span class="audit-source" style="color:#5865F2;">' + esc(t.type) + '</span>' +
                    '</div>' +
                    '<div class="audit-meta">' +
                        (t.user_tag ? '<span class="audit-exec">' + esc(t.user_tag) + '</span>' : '') +
                        (t.guild_id ? '<span class="audit-target">Server: ' + esc(t.guild_id) + '</span>' : '') +
                    '</div>' +
                    (Object.keys(details).length ? '<div class="audit-changes">' + Object.entries(details).map(function([k,v]) {
                        return '<span class="audit-change"><span class="audit-change-k">' + esc(k) + '</span><span class="audit-change-v">' + esc(JSON.stringify(v)) + '</span></span>';
                    }).join('') + '</div>' : '') +
                '</div>' +
            '</div>';
        }).join('');
    } catch (e) {
        cont.innerHTML = '<div class="empty"><p>Failed to load audit trail</p></div>';
    }
    updateRefreshTimestamp('audit-trail');
}

// ═══ MOBILE INIT ═══
document.addEventListener('DOMContentLoaded', function() {
    // Add mobile class for CSS targeting
    if (window.innerWidth <= 768) document.body.classList.add('mobile');
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth <= 768) document.body.classList.add('mobile');
        else document.body.classList.remove('mobile');
    });
    
    // Initialize tooltips
    document.querySelectorAll('[title]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            var tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = this.getAttribute('title');
            tooltip.style.cssText = 'position:absolute;background:var(--surface-3);color:var(--text);padding:6px 10px;border-radius:6px;font-size:11px;z-index:1000;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.3);pointer-events:none;';
            document.body.appendChild(tooltip);
            var rect = this.getBoundingClientRect();
            tooltip.style.left = rect.left + (rect.width/2) - (tooltip.offsetWidth/2) + 'px';
            tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
            this._tooltip = tooltip;
        });
        el.addEventListener('mouseleave', function() {
            if (this._tooltip) { this._tooltip.remove(); this._tooltip = null; }
        });
    });
});
export async function loadGreetingsEditor() {
    const sel = document.getElementById('geSrvSelect');
    if (!sel) return;
    if (sel.options.length <= 1 && allServers.length) {
        sel.innerHTML = '<option value="">Select a server...</option>' + allServers.map(function (s) {
            return '<option value="' + s.id + '"' + (curSrv === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
        }).join('');
    }
    const serverId = sel.value;
    const cont = document.getElementById('greetingsEditorContent');
    if (!cont) return;

    if (!serverId) {
        cont.innerHTML = '<div class="empty"><p>Select a server to configure welcome/goodbye messages</p></div>';
        updateRefreshTimestamp('greetings-editor');
        return;
    }

    cont.innerHTML = '<div class="loading" style="padding:30px;text-align:center;"><div class="spin"></div></div>';

    try {
        const [gr, ch] = await Promise.all([
            fetch('/api/server/' + serverId + '/greetings').then(function(r){return r.json()}),
            fetch('/api/server/' + serverId + '/channels').then(function(r){return r.json()}).catch(function(){return []})
        ]);
        const welcome = gr.welcome || {};
        const goodbye = gr.goodbye || {};
        const channels = ch.filter(function(c) { return c.type === 0 || c.type === 5 || c.type === 15; });

        function renderEditor(type, config, channels) {
            var typeLabel = type === 'welcome' ? '👋 Welcome' : '👋 Goodbye';
            var typeColor = type === 'welcome' ? '#3ba55c' : '#ed4245';
            var defaults = type === 'welcome'
                ? {enabled:false,channelId:null,content:null,embedTitle:'👋 Welcome!',embedDescription:'Welcome {user} to **{server}**!',embedColor:'#5865F2',embedFooter:'Member #{membercount}',embedFooterIcon:null,embedThumbnail:null,embedImage:null,embedAuthor:null,embedAuthorIcon:null}
                : {enabled:false,channelId:null,content:null,embedTitle:'👋 Goodbye!',embedDescription:'{user} has left **{server}**.',embedColor:'#E74C3C',embedFooter:'Member #{membercount}',embedFooterIcon:null,embedThumbnail:null,embedImage:null,embedAuthor:null,embedAuthorIcon:null};
            var cfg = {...defaults, ...config};

            var html = '<div class="card" style="margin-bottom:24px;border-left:4px solid '+typeColor+';">';
            html += '<div style="padding:16px 16px 0;">';
            html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">';
            html += '<div class="tg-wr" onclick="toggleGreeting(\''+serverId+'\',\''+type+'\')"><div class="tg '+(cfg.enabled?'on':'')+'" id="tg_'+type+'_'+serverId+'"></div><div class="tg-lbl"><b style="font-size:16px;">'+typeLabel+' Messages</b><small>When enabled, this message will be sent automatically when someone '+(type==='welcome'?'joins':'leaves')+' the server.</small></div></div>';
            html += '<h3 style="margin:0;color:'+typeColor+';">'+typeLabel+' Editor</h3>';
            html += '</div>';

            html += '<div style="display:grid;grid-template-columns:1fr 380px;gap:24px;">';
            // Left panel - Form
            html += '<div style="display:flex;flex-direction:column;gap:16px;">';
            html += '<div class="stg"><label>Channel</label><select id="grCh_'+type+'_'+serverId+'" style="width:100%;"><option value="">Select channel...</option>'+channels.filter(function(c){return c.type===0||c.type===5||c.type===15}).map(function(c){return '<option value="'+c.id+'"'+(cfg.channelId===c.id?' selected':'')+'>#'+esc(c.name)+'</option>';}).join('')+'</select></div>';
            html += '<div class="stg"><label>Plain Text Content (optional)</label><textarea id="grMsg_'+type+'_'+serverId+'" placeholder="Plain text message (supports placeholders like {user}, {server}, etc.)" rows="3" style="width:100%;font-family:inherit;">'+esc(cfg.content||'')+'</textarea></div>';
            html += '<div class="stg"><label>Embed Title</label><input type="text" id="grT_'+type+'_'+serverId+'" value="'+esc(cfg.embedTitle||'')+'" placeholder="e.g. 👋 Welcome!" oninput="updatePreview(\''+serverId+'\',\''+type+'\')" style="width:100%;"></div>';
            html += '<div class="stg"><label>Embed Description</label><textarea id="grD_'+type+'_'+serverId+'" placeholder="Embed description (supports placeholders like {user}, {server}, {membercount}, etc.)" rows="4" style="width:100%;font-family:inherit;">'+esc(cfg.embedDescription||'')+'</textarea></div>';
            html += '<div class="stg"><label>Embed Color</label><div class="stg-inl"><input type="color" id="grCoT_'+type+'_'+serverId+'" value="'+cfg.embedColor+'" style="flex:0 0 60px;height:36px;" oninput="updatePreview(\''+serverId+'\',\''+type+'\')"><span style="font-size:12px;color:var(--text-dim);font-family:monospace;">'+cfg.embedColor+'</span></div></div>';
            html += '<div class="stg"><label>Embed Footer</label><input type="text" id="grF_'+type+'_'+serverId+'" value="'+esc(cfg.embedFooter||'')+'" placeholder="e.g. Member #{membercount}" oninput="updatePreview(\''+serverId+'\',\''+type+'\')" style="width:100%;"></div>';
            html += '<div class="stg"><label>Footer Icon URL</label><input type="url" id="grFI_'+type+'_'+serverId+'" value="'+esc(cfg.embedFooterIcon||'')+'" placeholder="https://..." oninput="updatePreview(\''+serverId+'\',\''+type+'\')" style="width:100%;"></div>';
            html += '<div class="stg"><label>Thumbnail URL</label><input type="url" id="grTh_'+type+'_'+serverId+'" value="'+esc(cfg.embedThumbnail||'')+'" placeholder="https://..." oninput="updatePreview(\''+serverId+'\',\''+type+'\')" style="width:100%;"></div>';
            html += '<div class="stg"><label>Image URL</label><input type="url" id="grIm_'+type+'_'+serverId+'" value="'+esc(cfg.embedImage||'')+'" placeholder="https://..." oninput="updatePreview(\''+serverId+'\',\''+type+'\')" style="width:100%;"></div>';
            html += '<div class="stg"><label>Author Name</label><input type="text" id="grA_'+type+'_'+serverId+'" value="'+esc(cfg.embedAuthor||'')+'" placeholder="e.g. Welcome Bot" oninput="updatePreview(\''+serverId+'\',\''+type+'\')" style="width:100%;"></div>';
            html += '<div class="stg"><label>Author Icon URL</label><input type="url" id="grAI_'+type+'_'+serverId+'" value="'+esc(cfg.embedAuthorIcon||'')+'" placeholder="https://..." oninput="updatePreview(\''+serverId+'\',\''+type+'\')" style="width:100%;"></div>';
            html += '<div class="stg-inl" style="margin-top:16px;"><button class="btn" onclick="saveGreetingConfig(\''+serverId+'\',\''+type+'\')">Save '+type.charAt(0).toUpperCase()+type.slice(1)+' Config</button><button class="btn btn-s" onclick="resetGreetingConfig(\''+serverId+'\',\''+type+'\')">Reset to Defaults</button></div>';
            html += '</div>';

            // Right panel - Live Preview
            html += '<div style="background:var(--surface-2);border-radius:12px;padding:16px;min-height:400px;">';
            html += '<h4 style="margin:0 0 12px;color:'+typeColor+';">Live Preview</h4>';
            html += '<div id="pv_'+type+'_'+serverId+'" style="min-height:350px;"></div>';
            html += '</div>';
            html += '</div></div>';
            return html;
        }

        var welcomeHtml = renderEditor('welcome', welcome, channels);
        var goodbyeHtml = renderEditor('goodbye', goodbye, channels);

        cont.innerHTML = '<div style="display:flex;flex-direction:column;gap:24px;">'+
            welcomeHtml +
            goodbyeHtml +
            '<div class="card"><h3>📝 Available Placeholders</h3><div style="display:grid;grid-template-columns:auto 1fr;gap:4px 16px;font-size:12px;color:var(--text-dim);padding:12px;">'+
                '<div style="grid-column:1/-1;font-weight:700;color:var(--accent);margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid var(--border);font-size:11px;letter-spacing:0.5px;text-transform:uppercase;">👤 User</div>'+
                '<code style="font-size:12px;">{user}</code><span>@Mentions the user</span>'+
                '<code style="font-size:12px;">{username}</code><span>Username#0000</span>'+
                '<code style="font-size:12px;">{name}</code><span>Just the username (no discriminator)</span>'+
                '<code style="font-size:12px;">{displayname}</code><span>Server nickname (or username)</span>'+
                '<code style="font-size:12px;">{mention}</code><span>Same as {user} — @mention</span>'+
                '<code style="font-size:12px;">{userid}</code><span>User\'s Discord ID</span>'+
                '<code style="font-size:12px;">{discriminator}</code><span>#0000 discriminator</span>'+
                '<code style="font-size:12px;">{avatar}</code><span>User\'s avatar URL</span>'+
                '<code style="font-size:12px;">{created}</code><span>Account creation date (relative)</span>'+
                '<code style="font-size:12px;">{age}</code><span>How old the account is (e.g. 2y 3m)</span>'+
                '<div style="grid-column:1/-1;font-weight:700;color:var(--accent);margin-top:12px;padding-bottom:6px;border-bottom:1px solid var(--border);font-size:11px;letter-spacing:0.5px;text-transform:uppercase;">🏠 Server</div>'+
                '<code style="font-size:12px;">{server}</code><span>Server name</span>'+
                '<code style="font-size:12px;">{serverid}</code><span>Server ID</span>'+
                '<code style="font-size:12px;">{servericon}</code><span>Server icon URL</span>'+
                '<code style="font-size:12px;">{owner}</code><span>@Mentions the server owner</span>'+
                '<code style="font-size:12px;">{ownerid}</code><span>Server owner\'s ID</span>'+
                '<code style="font-size:12px;">{membercount}</code><span>Total members (bots + humans)</span>'+
                '<code style="font-size:12px;">{members}</code><span>Same as {membercount}</span>'+
                '<code style="font-size:12px;">{humancount}</code><span>Human members only</span>'+
                '<code style="font-size:12px;">{botcount}</code><span>Bots only</span>'+
                '<code style="font-size:12px;">{channelcount}</code><span>Total channels</span>'+
                '<code style="font-size:12px;">{textchannelcount}</code><span>Text channels only</span>'+
                '<code style="font-size:12px;">{voicechannelcount}</code><span>Voice channels only</span>'+
                '<code style="font-size:12px;">{rolecount}</code><span>Total roles</span>'+
                '<code style="font-size:12px;">{boosts}</code><span>Server boost count</span>'+
                '<code style="font-size:12px;">{boosttier}</code><span>Boost tier (0-3)</span>'+
                '<div style="grid-column:1/-1;font-weight:700;color:var(--accent);margin-top:12px;padding-bottom:6px;border-bottom:1px solid var(--border);font-size:11px;letter-spacing:0.5px;text-transform:uppercase;">📅 Date / Time</div>'+
                '<code style="font-size:12px;">{date}</code><span>Today\'s date (e.g. 7/21/2026)</span>'+
                '<code style="font-size:12px;">{time}</code><span>Current time (e.g. 3:45 PM)</span>'+
                '<code style="font-size:12px;">{year}</code><span>Current year (e.g. 2026)</span>'+
                '<div style="grid-column:1/-1;font-weight:700;color:#3ba55c;margin-top:12px;padding-bottom:6px;border-bottom:1px solid var(--border);font-size:11px;letter-spacing:0.5px;text-transform:uppercase;">👋 Welcome-only</div>'+
                '<code style="font-size:12px;">{joined}</code><span>When they joined (relative time)</span>'+
                '<code style="font-size:12px;">{created_relative}</code><span>Account creation (relative)</span>'+
                '<div style="grid-column:1/-1;font-weight:700;color:#ed4245;margin-top:12px;padding-bottom:6px;border-bottom:1px solid var(--border);font-size:11px;letter-spacing:0.5px;text-transform:uppercase;">👋 Goodbye-only</div>'+
                '<code style="font-size:12px;">{joined}</code><span>When they originally joined</span>'+
                '<code style="font-size:12px;">{duration}</code><span>How long they were in the server</span>'+
                '<code style="font-size:12px;">{left}</code><span>When they left (relative time)</span>'+
            '</div></div>';

    } catch (e) {
        cont.innerHTML = '<div class="empty"><p>Failed to load greetings editor</p></div>';
    }
    updateRefreshTimestamp('greetings-editor');
}

// ═══ RATE LIMITS ═══
