import { allServers, curSrv, esc, showToast, updateRefreshTimestamp } from './01-foundation.mjs';
// ═══ TEMP VOICE CHANNELS ═══
// Mirrors DEFAULT_TEMPLATE in src/tempVoice.js — the server falls back to
// this when a guild has no custom template.
const DEFAULT_TEMPLATE = "{name}'s channel";
export async function loadTempVoice() {
    const sel = document.getElementById('tvSrvSelect');
    if (!sel) return;
    if (sel.options.length <= 1 && allServers.length) {
        sel.innerHTML = '<option value="">Select a server...</option>' + allServers.map(function (s) {
            return '<option value="' + s.id + '"' + (curSrv === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
        }).join('');
    }
    const serverId = sel.value;
    const cont = document.getElementById('tempVoiceContent');
    if (!cont) return;

    if (!serverId) {
        cont.innerHTML = '<div class="empty"><p>Select a server to configure temp voice channels</p></div>';
        updateRefreshTimestamp('temp-voice');
        return;
    }

    cont.innerHTML = '<div class="loading" style="padding:30px;text-align:center;"><div class="spin"></div></div>';

    try {
        const r = await fetch('/api/server/' + serverId + '/temp-voice');
        const d = await r.json();
        const config = d.config || { name_template: DEFAULT_TEMPLATE };
        const triggers = d.triggers || [];
        const spawned = d.spawned || [];
        const channels = d.channels || [];

        var html = '<div class="stg" style="margin-bottom:16px;"><label>Channel Name Template</label>' +
            '<div class="stg-inl" style="margin-bottom:8px;">' +
            '<input type="text" id="tvNameTemplate" value="' + esc(config.name_template || DEFAULT_TEMPLATE) + '" placeholder="' + esc(DEFAULT_TEMPLATE) + '" style="flex:1;min-width:200px;">' +
            '<button class="btn btn-s" onclick="saveTempVoiceConfig(\'' + serverId + '\')">Save Template</button>' +
            '</div>' +
            '<div class="stg-hint">Use {name} for username and {number} for spawn counter. Max 100 chars.</div>' +
            '</div>';

        // Triggers
        html += '<div class="stg" style="margin-bottom:16px;"><label>Trigger Channels (Join to Create)</label>' +
            '<div class="stg-inl" style="margin-bottom:8px;flex-wrap:wrap;">' +
            '<select id="tvNewTriggerChannel" style="flex:1;min-width:200px;"><option value="">Select voice channel...</option>' + channels.filter(function(c){return c.type===2}).map(function(c){return '<option value="' + c.id + '">#' + esc(c.name) + '</option>';}).join('') + '</select>' +
            '<select id="tvNewTriggerCategory" style="flex:1;min-width:200px;"><option value="">Category (optional)</option>' + channels.filter(function(c){return c.type===4}).map(function(c){return '<option value="' + c.id + '">' + esc(c.name) + '</option>';}).join('') + '</select>' +
            '<button class="btn btn-s" onclick="addTempVoiceTrigger(\'' + serverId + '\')">Add Trigger</button>' +
            '</div></div>';

        if (!triggers.length) {
            html += '<div class="empty"><p>No trigger channels configured</p></div>';
        } else {
            html += triggers.map(function (t) {
                var ch = channels.find(function (c) { return c.id === t.channel_id; });
                var cat = channels.find(function (c) { return c.id === t.category_id; });
                return '<div class="card" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">' +
                    '<div>' +
                    '<strong>#' + esc(ch?.name || t.channel_id) + '</strong>' +
                    (cat ? '<span class="sub"> → Category: #' + esc(cat.name) + '</span>' : '') +
                    '</div>' +
                    '<button class="btn btn-s" style="background:var(--danger)" onclick="removeTempVoiceTrigger(\'' + serverId + '\',\'' + t.channel_id + '\')">Remove</button>' +
                    '</div>';
            }).join('');
        }

        // Spawned channels
        html += '<div class="stg" style="margin-top:16px;"><label>Active Temp Channels</label>';
        if (!spawned.length) {
            html += '<div class="empty"><p>No active temp channels</p></div></div>';
        } else {
            html += spawned.map(function (s) {
                var ch = channels.find(function (c) { return c.id === s.channel_id; });
                return '<div class="card" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
                    '<div>' +
                    '<strong>' + esc(ch?.name || s.channel_id) + '</strong>' +
                    '<span class="sub">Owner: <@' + s.owner_id + '> · Trigger: ' + esc(s.trigger_id || 'N/A') + '</span>' +
                    '</div>' +
                    '<button class="btn btn-s" style="background:var(--danger)" onclick="deleteTempVoiceChannel(\'' + serverId + '\',\'' + s.channel_id + '\')">Delete</button>' +
                    '</div>';
            }).join('') + '</div>';
        }

        // Panels are managed from Discord (/tempvc) or the API — the dashboard
        // does not expose panel creation, so no button is rendered.
        html += '<div class="stg" style="margin-top:16px;"><label>Control Panels</label>' +
            '<div class="stg-hint">Panels are registered per text channel. Manage them from Discord with /tempvc or the API.</div></div>';

        cont.innerHTML = html;
    } catch (e) {
        cont.innerHTML = '<div class="empty"><p>Failed to load temp voice config</p></div>';
    }
    updateRefreshTimestamp('temp-voice');
}

export async function saveTempVoiceConfig(serverId) {
    const nameTemplate = document.getElementById('tvNameTemplate')?.value;
    if (!nameTemplate) return showToast('Enter a template', true);
    try {
        const r = await fetch('/api/server/' + serverId + '/temp-voice/config', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nameTemplate })
        });
        const d = await r.json();
        if (d.success) { showToast('Template saved!'); loadTempVoice(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

export async function addTempVoiceTrigger(serverId) {
    const channelId = document.getElementById('tvNewTriggerChannel')?.value;
    const categoryId = document.getElementById('tvNewTriggerCategory')?.value;
    if (!channelId) return showToast('Select a voice channel', true);
    try {
        const r = await fetch('/api/server/' + serverId + '/temp-voice/triggers', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId, categoryId: categoryId || null })
        });
        const d = await r.json();
        if (d.success) { showToast('Trigger added!'); loadTempVoice(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

export async function removeTempVoiceTrigger(serverId, channelId) {
    if (!confirm('Remove this trigger channel?')) return;
    try {
        const r = await fetch('/api/server/' + serverId + '/temp-voice/triggers', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId })
        });
        const d = await r.json();
        if (d.success) { showToast('Trigger removed!'); loadTempVoice(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

export async function deleteTempVoiceChannel(serverId, channelId) {
    if (!confirm('Delete this temp voice channel?')) return;
    try {
        // Note: This would need a dedicated API endpoint
        showToast('Use /tempvc delete in Discord or the panel controls', true);
    } catch { showToast('Failed', true); }
}

// ═══ WARNING THRESHOLDS ═══
export async function loadWarningThresholds() {
    const sel = document.getElementById('wtSrvSelect');
    if (!sel) return;
    if (sel.options.length <= 1 && allServers.length) {
        sel.innerHTML = '<option value="">Select a server...</option>' + allServers.map(function (s) {
            return '<option value="' + s.id + '"' + (curSrv === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
        }).join('');
    }
    const serverId = sel.value;
    const cont = document.getElementById('warningThresholdsContent');
    if (!cont) return;

    if (!serverId) {
        cont.innerHTML = '<div class="empty"><p>Select a server to configure warning thresholds</p></div>';
        updateRefreshTimestamp('warning-thresholds');
        return;
    }

    cont.innerHTML = '<div class="loading" style="padding:30px;text-align:center;"><div class="spin"></div></div>';

    try {
        const r = await fetch('/api/server/' + serverId + '/warning-thresholds');
        const d = await r.json();
        const thresholds = d.thresholds || [];

        var html = '<div class="stg" style="margin-bottom:16px;"><label>Add Warning Threshold</label>' +
            '<div class="stg-inl" style="margin-bottom:8px;flex-wrap:wrap;">' +
            '<input type="number" id="wtWarnCount" placeholder="Warning count (e.g. 3)" min="1" max="100" style="flex:0 0 150px;">' +
            '<select id="wtAction" style="flex:0 0 150px;"><option value="timeout">Timeout</option><option value="kick">Kick</option><option value="ban">Ban</option></select>' +
            '<input type="number" id="wtDuration" placeholder="Duration (min, for timeout)" min="1" max="40320" style="flex:0 0 150px;">' +
            '<button class="btn btn-s" onclick="addWarningThresholdUI(\'' + serverId + '\')">Add Threshold</button>' +
            '</div></div>';

        if (!thresholds.length) {
            html += '<div class="empty"><p>No warning thresholds configured</p><p class="empty-act">Add a threshold above to enable auto-punishment at warning milestones.</p></div>';
        } else {
            html += thresholds.map(function (t) {
                return '<div class="card" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
                    '<div>' +
                    '<strong>' + t.warnCount + ' warnings</strong> → <strong>' + t.action + '</strong>' +
                    (t.action === 'timeout' && t.duration ? ' for ' + t.duration + ' min' : '') +
                    '</div>' +
                    '<button class="btn btn-s" style="background:var(--danger)" onclick="removeWarningThresholdUI(\'' + serverId + '\', ' + t.warnCount + ')">Remove</button>' +
                    '</div>';
            }).join('');
        }

        cont.innerHTML = html;
    } catch (e) {
        cont.innerHTML = '<div class="empty"><p>Failed to load warning thresholds</p></div>';
    }
    updateRefreshTimestamp('warning-thresholds');
}

export async function addWarningThresholdUI(serverId) {
    const warnCount = parseInt(document.getElementById('wtWarnCount')?.value);
    const action = document.getElementById('wtAction')?.value;
    const duration = parseInt(document.getElementById('wtDuration')?.value) || null;
    if (!warnCount || !action) return showToast('Fill all fields', true);
    try {
        const r = await fetch('/api/server/' + serverId + '/warning-thresholds', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ warnCount, action, duration })
        });
        const d = await r.json();
        if (d.success) { showToast('Threshold added!'); loadWarningThresholds(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

export async function removeWarningThresholdUI(serverId, warnCount) {
    if (!confirm('Remove this warning threshold?')) return;
    try {
        const r = await fetch('/api/server/' + serverId + '/warning-thresholds', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ warnCount })
        });
        const d = await r.json();
        if (d.success) { showToast('Threshold removed!'); loadWarningThresholds(); } else showToast('Failed: ' + d.error, true);
} catch { showToast('Failed', true); }
}

// ═══ PREFIX COMMANDS ═══
export async function loadPrefixCommands() {
    const sel = document.getElementById('pcSrvSelect');
    if (!sel) return;
    if (sel.options.length <= 1 && allServers.length) {
        sel.innerHTML = '<option value="">Select a server...</option>' + allServers.map(function (s) {
            return '<option value="' + s.id + '"' + (curSrv === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
        }).join('');
    }
    const serverId = sel.value;
    const cont = document.getElementById('prefixCommandsContent');
    if (!cont) return;

    if (!serverId) {
        cont.innerHTML = '<div class="empty"><p>Select a server to manage prefix commands</p></div>';
        updateRefreshTimestamp('prefix-commands');
        return;
    }

    cont.innerHTML = '<div class="loading" style="padding:30px;text-align:center;"><div class="spin"></div></div>';

    try {
        const r = await fetch('/api/server/' + serverId);
        const d = await r.json();
        const prefix = d.prefix || ';';

        var html = '<div class="stg" style="margin-bottom:16px;"><label>Command Prefix</label>' +
            '<div class="stg-inl" style="margin-bottom:8px;">' +
            '<input type="text" id="pcPrefixInput" value="' + esc(prefix) + '" maxlength="5" style="flex:0 0 120px;">' +
            '<button class="btn btn-s" onclick="savePrefixUI(\'' + serverId + '\')">Save Prefix</button>' +
            '</div>' +
            '<div class="stg-hint">Prefix for text commands (default: ;). Max 5 characters, no spaces.</div>' +
            '</div>';

        // Show prefix usage stats
        try {
            const statsRes = await fetch('/api/stats/commands');
            const statsData = await statsRes.json();
            const prefixUsage = statsData.perServer?.filter(function(r) { return r.guild_id === serverId; }) || [];
            if (prefixUsage.length > 0) {
                html += '<div class="stg" style="margin-top:16px;"><label>Prefix Command Usage (this server)</label>';
                html += '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
                html += '<thead><tr style="background:var(--surface-2);"><th style="padding:8px;text-align:left;">Command</th><th style="padding:8px;text-align:center;">Uses</th></tr></thead><tbody>';
                prefixUsage.forEach(function(r) {
                    html += '<tr style="border-bottom:1px solid var(--border);"><td style="padding:8px;font-family:monospace;">' + esc(r.command) + '</td><td style="padding:8px;text-align:center;">' + r.count.toLocaleString() + '</td></tr>';
                });
                html += '</tbody></table></div>';
            }
        } catch {}

        cont.innerHTML = html;
    } catch (e) {
        cont.innerHTML = '<div class="empty"><p>Failed to load prefix commands</p></div>';
    }
    updateRefreshTimestamp('prefix-commands');
}

export async function savePrefixUI(serverId) {
    const prefix = document.getElementById('pcPrefixInput')?.value?.trim();
    if (!prefix || prefix.length > 5) return showToast('Prefix must be 1-5 characters', true);
    try {
        const r = await fetch('/api/server/' + serverId + '/prefix', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefix })
        });
        const d = await r.json();
        if (d.success) { showToast('Prefix saved!'); loadPrefixCommands(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

// ═══ RATE LIMITS ═══

async function loadRateLimits() {
    const cont = document.getElementById('rateLimitsContent');
    if (!cont) return;
    try {
        const r = await fetch('/api/ratelimit/config');
        const config = await r.json();
        cont.innerHTML = `
            <div class="grid grid-2">
                <div class="card"><h4>Global API</h4>
                    <input type="number" id="rlGlobalWindow" placeholder="Window (ms)" value="${config.global?.windowMs||60000}" style="width:100%;margin-bottom:8px;">
                    <input type="number" id="rlGlobalMax" placeholder="Max requests" value="${config.global?.max||120}" style="width:100%;">
                </div>
                <div class="card"><h4>Login</h4>
                    <input type="number" id="rlLoginWindow" placeholder="Window (ms)" value="${config.login?.windowMs||60000}" style="width:100%;margin-bottom:8px;">
                    <input type="number" id="rlLoginMax" placeholder="Max attempts" value="${config.login?.max||10}" style="width:100%;">
                </div>
                <div class="card"><h4>API</h4>
                    <input type="number" id="rlApiWindow" placeholder="Window (ms)" value="${config.api?.windowMs||60000}" style="width:100%;margin-bottom:8px;">
                    <input type="number" id="rlApiMax" placeholder="Max requests" value="${config.api?.max||100}" style="width:100%;">
                </div>
                <div class="card"><h4>Mod Actions</h4>
                    <input type="number" id="rlModWindow" placeholder="Window (ms)" value="${config.modActions?.windowMs||60000}" style="width:100%;margin-bottom:8px;">
                    <input type="number" id="rlModMax" placeholder="Max requests" value="${config.modActions?.max||30}" style="width:100%;">
                </div>
            </div>
            <button class="btn" onclick="saveRateLimits()" style="margin-top:16px;">Save Rate Limits</button>
        `;
    } catch { cont.innerHTML = '<div class="empty"><p>Failed to load rate limit config</p></div>'; }
}

export async function saveRateLimits() {
    const config = {
        global: { windowMs: parseInt(document.getElementById('rlGlobalWindow')?.value) || 60000, max: parseInt(document.getElementById('rlGlobalMax')?.value) || 120 },
        login: { windowMs: parseInt(document.getElementById('rlLoginWindow')?.value) || 60000, max: parseInt(document.getElementById('rlLoginMax')?.value) || 10 },
        api: { windowMs: parseInt(document.getElementById('rlApiWindow')?.value) || 60000, max: parseInt(document.getElementById('rlApiMax')?.value) || 100 },
        modActions: { windowMs: parseInt(document.getElementById('rlModWindow')?.value) || 60000, max: parseInt(document.getElementById('rlModMax')?.value) || 30 },
    };
    try {
        const r = await fetch('/api/ratelimit/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
        const d = await r.json();
        if (d.success) showToast('Rate limits saved!'); else showToast('Failed', true);
    } catch { showToast('Failed', true); }
}

