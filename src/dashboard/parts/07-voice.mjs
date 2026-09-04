import { allServers, curSrv, esc, showToast, timeSince, updateRefreshTimestamp } from './01-foundation.mjs';
// ═══ VOICE PRESENCE ═══
export async function loadVoicePresence() {
    const sel = document.getElementById('vpSrvSelect');
    if (!sel) return;
    if (sel.options.length <= 1 && allServers.length) {
        sel.innerHTML = '<option value="">Select a server...</option>' + allServers.map(function (s) {
            return '<option value="' + s.id + '"' + (curSrv === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
        }).join('');
    }
    const serverId = sel.value;
    const cont = document.getElementById('voicePresenceContent');
    if (!cont) return;

    if (!serverId) {
        cont.innerHTML = '<div class="empty"><p>Select a server to manage voice presence</p></div>';
        updateRefreshTimestamp('voice-presence');
        return;
    }

    cont.innerHTML = '<div class="loading" style="padding:30px;text-align:center;"><div class="spin"></div></div>';

    try {
        const r = await fetch('/api/server/' + serverId + '/voice-presence');
        const d = await r.json();
        const presence = d.presence;
        const channels = d.channels || [];

        var html = '<div class="card" style="margin-bottom:16px;padding:16px;">' +
            '<h3 style="margin-bottom:12px;">Current Status</h3>' +
            (presence ? '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">' +
                '<span class="badge" style="background:' + (presence.status ? 'rgba(59,165,92,0.2)' : 'rgba(237,66,69,0.2)') + ';color:' + (presence.status ? '#3ba55c' : '#ed4245') + ';">' +
                (presence.status ? '🎧 Connected' : '⭕ Disconnected') + '</span>' +
                '<div style="flex:1;min-width:200px;">' +
                '<strong>Channel:</strong> #' + esc(channels.find(function(c){return c.id===presence.channel_id})?.name || presence.channel_id) + '<br>' +
                '<strong>Status:</strong> ' + esc(presence.status || 'None') +
                '</div>' +
                '<button class="btn btn-s" onclick="leaveVoicePresence(\'' + serverId + '\')">Disconnect</button>' +
                '<button class="btn btn-s" onclick="moveVoicePresenceUI(\'' + serverId + '\')">Move Channel</button>' +
                '</div>' :
                '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">' +
                '<span class="badge" style="background:rgba(237,66,69,0.2);color:#ed4245;">⭕ Not Connected</span>' +
                '<div style="flex:1;min-width:200px;">Bot is not in a voice channel</div>' +
                '<button class="btn btn-s" onclick="joinVoicePresenceUI(\'' + serverId + '\')">Join Channel</button>' +
                '</div>') + '</div>';

        html += '<div class="card" style="margin-bottom:16px;padding:16px;">' +
            '<h3 style="margin-bottom:12px;">Listening Status</h3>' +
            '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">' +
            '<input type="text" id="vpStatusInput" placeholder="Listening to..." value="' + esc(presence?.status || '') + '" style="flex:1;min-width:200px;">' +
            '<button class="btn btn-s" onclick="setVoicePresenceStatus(\'' + serverId + '\')">Update Status</button>' +
            '</div>' +
            (presence ? '<div class="stg-hint">Current: ' + esc(presence.status || 'None') + '</div>' : '') +
            '</div>';

        if (presence) {
            html += '<div class="card" style="padding:16px;">' +
                '<h3 style="margin-bottom:12px;">Move to Another Channel</h3>' +
                '<div class="stg-inl" style="margin-bottom:8px;">' +
                '<select id="vpMoveChannel" style="flex:1;min-width:200px;"><option value="">Select channel...</option>' + channels.map(function(c){return '<option value="' + c.id + '">#' + esc(c.name) + '</option>';}).join('') + '</select>' +
                '<input type="text" id="vpMoveStatus" placeholder="New status (optional)" style="flex:1;min-width:200px;">' +
                '<button class="btn btn-s" onclick="moveVoicePresence(\'' + serverId + '\')">Move</button>' +
                '</div></div>';
        }

        cont.innerHTML = html;
    } catch (e) {
        cont.innerHTML = '<div class="empty"><p>Failed to load voice presence</p></div>';
    }
    updateRefreshTimestamp('voice-presence');
}

export async function joinVoicePresenceUI(serverId) {
    const cont = document.getElementById('voicePresenceContent');
    if (!cont) return;
    try {
        const r = await fetch('/api/server/' + serverId + '/voice-presence');
        const d = await r.json();
        const channels = d.channels || [];

        var html = '<div class="stg" style="margin-bottom:16px;"><label>Join Voice Channel</label>' +
            '<div class="stg-inl" style="margin-bottom:8px;flex-wrap:wrap;">' +
            '<select id="vpJoinChannel" style="flex:1;min-width:200px;"><option value="">Select channel...</option>' + channels.map(function(c){return '<option value="' + c.id + '">#' + esc(c.name) + '</option>';}).join('') + '</select>' +
            '<input type="text" id="vpJoinStatus" placeholder="Listening status (optional)" style="flex:1;min-width:200px;">' +
            '<button class="btn btn-s" onclick="joinVoicePresence(\'' + serverId + '\')">Join</button>' +
            '</div></div>' +
            '<button class="btn btn-s" onclick="loadVoicePresence()">Back</button>';
        cont.innerHTML = html;
    } catch { showToast('Failed', true); }
}

export async function joinVoicePresence(serverId) {
    const channelId = document.getElementById('vpJoinChannel')?.value;
    const status = document.getElementById('vpJoinStatus')?.value;
    if (!channelId) return showToast('Select a channel', true);
    try {
        const r = await fetch('/api/server/' + serverId + '/voice-presence/join', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId, status: status || null })
        });
        const d = await r.json();
        if (d.success) { showToast('Joined voice channel!'); loadVoicePresence(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

export async function leaveVoicePresence(serverId) {
    try {
        const r = await fetch('/api/server/' + serverId + '/voice-presence/leave', { method: 'POST' });
        const d = await r.json();
        if (d.success) { showToast('Left voice channel'); loadVoicePresence(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

export async function moveVoicePresenceUI(serverId) {
    const cont = document.getElementById('voicePresenceContent');
    if (!cont) return;
    try {
        const r = await fetch('/api/server/' + serverId + '/voice-presence');
        const d = await r.json();
        const channels = d.channels || [];

        var html = '<div class="stg" style="margin-bottom:16px;"><label>Move to Another Channel</label>' +
            '<div class="stg-inl" style="margin-bottom:8px;flex-wrap:wrap;">' +
            '<select id="vpMoveChannel" style="flex:1;min-width:200px;"><option value="">Select channel...</option>' + channels.map(function(c){return '<option value="' + c.id + '">#' + esc(c.name) + '</option>';}).join('') + '</select>' +
            '<input type="text" id="vpMoveStatus" placeholder="New status (optional)" style="flex:1;min-width:200px;">' +
            '<button class="btn btn-s" onclick="moveVoicePresence(\'' + serverId + '\')">Move</button>' +
            '</div></div>' +
            '<button class="btn btn-s" onclick="loadVoicePresence()">Back</button>';
        cont.innerHTML = html;
    } catch { showToast('Failed', true); }
}

export async function moveVoicePresence(serverId) {
    const channelId = document.getElementById('vpMoveChannel')?.value;
    const status = document.getElementById('vpMoveStatus')?.value;
    if (!channelId) return showToast('Select a channel', true);
    try {
        const r = await fetch('/api/server/' + serverId + '/voice-presence/move', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId, status: status || null })
        });
        const d = await r.json();
        if (d.success) { showToast('Moved to new channel!'); loadVoicePresence(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

export async function setVoicePresenceStatus(serverId) {
    const status = document.getElementById('vpStatusInput')?.value;
    try {
        const r = await fetch('/api/server/' + serverId + '/voice-presence/status', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: status || '' })
        });
        const d = await r.json();
        if (d.success) { showToast('Status updated!'); loadVoicePresence(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

async function restoreVoicePresence(serverId) {
    try {
        const r = await fetch('/api/server/' + serverId + '/voice-presence/restore', { method: 'POST' });
        const d = await r.json();
        if (d.success) { showToast('Presences restored!'); loadVoicePresence(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

// ═══ WEBHOOKS ═══
export async function loadWebhooks() {
    const srv = document.getElementById('whSrvSelect')?.value;
    const cont = document.getElementById('webhooksContent');
    if (!srv || !cont) return;
    cont.innerHTML = '<div class="sk"><div class="sk-line w40"></div></div>';
    try {
        const r = await fetch('/api/server/' + srv + '/webhooks');
        const webhooks = await r.json();
        if (!webhooks.length) {
            cont.innerHTML = '<div class="empty"><p>No webhooks found</p><p class="empty-act">Create a webhook to send messages via external integrations.</p></div>';
            return;
        }
        cont.innerHTML = webhooks.map(w => `
            <div class="card" style="margin-bottom:12px;">
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                    <div style="flex:1;min-width:200px;">
                        <strong>${esc(w.name)}</strong>
                        <span class="sub">#${esc(w.channelName)} · ${esc(w.type === 1 ? 'Incoming' : 'Channel Follower')}</span>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button class="btn btn-s" onclick="copyToClipboard('${esc(w.url)}')">Copy URL</button>
                        <button class="btn btn-s" style="background:var(--danger)" onclick="deleteWebhook('${srv}','${w.id}')">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch {
        cont.innerHTML = '<div class="empty"><p>Failed to load webhooks</p></div>';
    }
}

async function createWebhookUI() {
    const srv = document.getElementById('whSrvSelect')?.value;
    const name = document.getElementById('whNewName')?.value;
    const channelId = document.getElementById('whNewChannel')?.value;
    if (!srv || !name || !channelId) return showToast('Fill all fields', true);
    try {
        const r = await fetch('/api/server/' + srv + '/webhooks', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, channelId })
        });
        const d = await r.json();
        if (d.success) {
            showToast('Webhook created! URL: ' + d.webhook.url);
            loadWebhooks();
        } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

export async function deleteWebhook(serverId, webhookId) {
    if (!confirm('Delete this webhook?')) return;
    try {
        const r = await fetch('/api/server/' + serverId + '/webhooks/' + webhookId, { method: 'DELETE' });
        const d = await r.json();
        if (d.success) { showToast('Webhook deleted'); loadWebhooks(); } else showToast('Failed', true);
    } catch { showToast('Failed', true); }
}

// ═══ API TOKENS ═══
async function loadApiTokens() {
    const cont = document.getElementById('apiTokensList');
    if (!cont) return;
    try {
        const r = await fetch('/api/tokens');
        const tokens = await r.json();
        cont.innerHTML = tokens.map(t => `
            <div class="card" style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
                <div>
                    <strong>${esc(t.name)}</strong>
                    <span class="sub">${esc(t.token_hash)} · Scopes: ${esc((t.scopes||[]).join(', ') || 'none')} · Created: ${new Date(t.created_at).toLocaleDateString()}</span>
                    ${t.expires_at ? '<span class="sub">Expires: ' + new Date(t.expires_at).toLocaleDateString() + '</span>' : ''}
                    ${t.last_used_at ? '<span class="sub">Last used: ' + timeSince(t.last_used_at) + '</span>' : '<span class="sub">Never used</span>'}
                </div>
                <button class="btn btn-s" style="background:var(--danger)" onclick="deleteApiToken(${t.id})">Revoke</button>
            </div>
        `).join('');
    } catch { cont.innerHTML = '<div class="empty"><p>Failed to load tokens</p></div>'; }
}

export async function createApiToken() {
    const name = document.getElementById('apiTokenName')?.value;
    const scopesSel = document.getElementById('apiTokenScopes');
    const scopes = scopesSel ? Array.from(scopesSel.selectedOptions).map(o => o.value) : [];
    const expiresInDays = parseInt(document.getElementById('apiTokenExpiry')?.value) || 0;
    if (!name) return showToast('Enter a name', true);
    try {
        const r = await fetch('/api/tokens', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, scopes, expiresInDays })
        });
        const d = await r.json();
        if (d.success) {
            showToast('Token created! Save it now: ' + d.token);
            document.getElementById('apiTokenName').value = '';
            if (scopesSel) Array.from(scopesSel.options).forEach(o => o.selected = false);
            document.getElementById('apiTokenExpiry').value = '';
            loadApiTokens();
        } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

export async function deleteApiToken(id) {
    if (!confirm('Revoke this API token?')) return;
    try {
        const r = await fetch('/api/tokens/' + id, { method: 'DELETE' });
        const d = await r.json();
        if (d.success) { showToast('Token revoked'); loadApiTokens(); } else showToast('Failed', true);
    } catch { showToast('Failed', true); }
}
