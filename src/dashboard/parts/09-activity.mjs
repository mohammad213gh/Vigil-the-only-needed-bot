import { allServers, curSrv, esc, fnData, showToast, timeSince, updateRefreshTimestamp } from './01-foundation.mjs';
// ═══ BOT ACTIVITY ═══
export async function loadBotActivity() {
    const cont = document.getElementById('botActivityFeed');
    if (!cont) return;
    const days = document.getElementById('activityDays')?.value || '7';
    const type = document.getElementById('activityType')?.value || '';
    cont.innerHTML = '<div class="sk"><div class="sk-line w40"></div></div>';
    try {
        const r = await fetch('/api/activity/timeline?days=' + days + '&type=' + type);
        const events = await r.json();
        if (!events.length) {
            cont.innerHTML = '<div class="empty"><p>No activity found</p></div>';
            return;
        }
        cont.innerHTML = events.map(e => `
            <div class="audit-item" style="margin-bottom:8px;">
                <div class="audit-ico">${esc(e.icon || '📌')}</div>
                <div class="audit-body">
                    <div class="audit-h">
                        <span class="audit-type">${esc(e.type)}</span>
                        <span class="audit-ts">${timeSince(e.timestamp)}</span>
                    </div>
                    <div class="audit-meta">${esc(e.server || '')} ${esc(e.user ? '• ' + e.user : '')} ${esc(e.details ? '• ' + e.details : '')}</div>
                </div>
            </div>
        `).join('');
    } catch { cont.innerHTML = '<div class="empty"><p>Failed to load activity</p></div>'; }
}

// ═══ SERVER COMPARISON ═══
export async function loadServerCompare() {
    const cont = document.getElementById('compareCards');
    if (!cont) return;
    const metric = document.getElementById('compareMetric')?.value || 'members';
    const limit = document.getElementById('compareLimit')?.value || '10';
    cont.innerHTML = '<div class="sk"><div class="sk-line w40"></div></div>';
    try {
        const r = await fetch('/api/analytics/servers/compare?metric=' + metric + '&limit=' + limit);
        const { servers } = await r.json();
        if (!servers.length) {
            cont.innerHTML = '<div class="empty"><p>No servers to compare</p></div>';
            return;
        }
        cont.innerHTML = servers.map(s => `
            <div class="card sr">
                <img src="${esc(s.icon)}" alt="" style="width:32px;height:32px;border-radius:8px;margin-bottom:8px;">
                <div class="lbl">${esc(s.name)}</div>
                <div class="val">${s.value.toLocaleString()}</div>
                <div class="sub">${esc(metric)}</div>
            </div>
        `).join('');
    } catch { cont.innerHTML = '<div class="empty"><p>Failed to load comparison</p></div>'; }
}

// ═══ COMMAND HEATMAP ═══
export async function loadCmdHeatmap() {
    const cont = document.getElementById('heatmapGrid');
    if (!cont) return;
    const days = document.getElementById('heatmapDays')?.value || '7';
    cont.innerHTML = '<div class="sk"><div class="sk-line w40"></div></div>';
    try {
        const r = await fetch('/api/stats/commands/heatmap?days=' + days);
        const heatmap = await r.json();
        if (!Object.keys(heatmap).length) {
            cont.innerHTML = '<div class="empty"><p>No command data</p></div>';
            return;
        }
        const commands = Object.keys(heatmap).sort((a,b) => {
            const ta = Object.values(heatmap[a]).reduce((x,y)=>x+y,0);
            const tb = Object.values(heatmap[b]).reduce((x,y)=>x+y,0);
            return tb - ta;
        });
        const servers = new Set();
        commands.forEach(c => Object.keys(heatmap[c]).forEach(s => servers.add(s)));
        const serverList = Array.from(servers).sort();
        
        cont.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead>
                    <tr style="background:var(--surface-2);"><th style="padding:8px;text-align:left;">Command</th>${serverList.map(s => '<th style="padding:8px;text-align:center;">' + esc(s.slice(0,12)) + '</th>').join('')}<th style="padding:8px;text-align:right;">Total</th></tr>
                </thead>
                <tbody>
                    ${commands.map(c => {
                        const row = heatmap[c];
                        const total = Object.values(row).reduce((x,y)=>x+y,0);
                        return '<tr style="border-bottom:1px solid var(--border);"><td style="padding:8px;font-family:monospace;">' + esc(c) + '</td>' +
                            serverList.map(s => {
                                const v = row[s] || 0;
                                return '<td style="padding:8px;text-align:center;background:' + (v ? 'rgba(var(--accent-rgb),' + Math.min(0.5, v/100) + ')' : 'transparent') + ';">' + (v ? v.toLocaleString() : '—') + '</td>';
                            }).join('') +
                            '<td style="padding:8px;text-align:right;font-weight:600;">' + total.toLocaleString() + '</td></tr>';
                    }).join('')}
                </tbody>
            </table>
        `;
    } catch { cont.innerHTML = '<div class="empty"><p>Failed to load heatmap</p></div>'; }
}

export function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => showToast('Copied!')).catch(() => showToast('Failed', true));
}

// ═══ BAN APPEALS ═══
export async function loadBanAppeals() {
    const sel = document.getElementById('baSrvSelect');
    if (!sel) return;
    if (sel.options.length <= 1 && allServers.length) {
        sel.innerHTML = '<option value="">Select a server...</option>' + allServers.map(function (s) {
            return '<option value="' + s.id + '"' + (curSrv === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
        }).join('');
    }
    const serverId = sel.value;
    const cont = document.getElementById('banAppealsContent');
    const statsCont = document.getElementById('baStats');
    if (!cont) return;

    if (!serverId) {
        cont.innerHTML = '<div class="empty"><p>Select a server to manage ban appeals</p></div>';
        updateRefreshTimestamp('ban-appeals');
        return;
    }

    // Load stats
    if (statsCont) {
        try {
            const r = await fetch('/api/server/' + serverId + '/ban-appeals/stats');
            const stats = await r.json();
            statsCont.innerHTML = `
                <div class="card sr"><div class="lbl">Pending</div><div class="val">${stats.pending || 0}</div></div>
                <div class="card sr"><div class="lbl">Approved</div><div class="val">${stats.approved || 0}</div></div>
                <div class="card sr"><div class="lbl">Denied</div><div class="val">${stats.denied || 0}</div></div>
                <div class="card sr"><div class="lbl">Total</div><div class="val">${stats.total || 0}</div></div>
            `;
        } catch { statsCont.innerHTML = ''; }
    }

    const statusFilter = document.getElementById('baStatusFilter')?.value || '';
    cont.innerHTML = '<div class="loading" style="padding:30px;text-align:center;"><div class="spin"></div></div>';

    try {
        const r = await fetch('/api/server/' + serverId + '/ban-appeals' + (statusFilter ? '?status=' + statusFilter : ''));
        const d = await r.json();
        const appeals = d.appeals || [];

        var html = '<div class="stg" style="margin-bottom:16px;"><label>Submit New Appeal</label>' +
            '<div class="stg-inl" style="margin-bottom:8px;flex-wrap:wrap;">' +
            '<input type="text" id="baUserId" placeholder="User ID" style="flex:0 0 150px;">' +
            '<input type="text" id="baUserTag" placeholder="User Tag (e.g. User#1234)" style="flex:1;min-width:200px;">' +
            '<input type="text" id="baReason" placeholder="Ban reason" style="flex:1;min-width:200px;">' +
            '<textarea id="baMessage" placeholder="Appeal message" style="flex:1;min-width:200px;min-height:60px;"></textarea>' +
            '<button class="btn btn-s" data-fn="submitBanAppealUI" data-args=\'['+fnData(serverId)+']\'>Submit Appeal</button>' +
            '</div></div>';

        if (!appeals.length) {
            html += '<div class="empty"><p>No ban appeals found</p><p class="empty-act">Submit a new appeal above or wait for users to appeal.</p></div>';
        } else {
            html += appeals.map(function (a) {
                var statusClass = a.status === 'pending' ? '' : (a.status === 'approved' ? 'style="color:#3ba55c"' : 'style="color:#ed4245"');
                return '<div class="card" style="margin-bottom:8px;">' +
                    '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
                    '<div style="flex:1;min-width:250px;">' +
                    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
                    '<strong>' + esc(a.user_tag) + '</strong>' +
                    '<span ' + statusClass + '><strong>' + a.status.toUpperCase() + '</strong></span>' +
                    '<span class="sub">ID: ' + esc(a.id) + ' · ' + timeSince(a.created_at) + ' ago</span>' +
                    '</div>' +
                    '<div class="sub">Reason: ' + esc(a.reason || 'None') + '</div>' +
                    '<div class="sub">Message: ' + esc(a.message || 'None') + '</div>' +
                    (a.reviewed_by ? '<div class="sub">Reviewed by: ' + esc(a.reviewed_by) + (a.reviewed_at ? ' · ' + timeSince(a.reviewed_at) : '') + '</div>' : '') +
                    (a.review_note ? '<div class="sub">Review note: ' + esc(a.review_note) + '</div>' : '') +
                    '</div>' +
                    (a.status === 'pending' ? '<div style="display:flex;gap:8px;">' +
                    '<button class="btn btn-s" data-fn="updateBanAppealStatusUI" data-args=\'['+fnData(serverId)+','+fnData(a.id)+',\"approved\"]\'>Approve</button>' +
                    '<button class="btn btn-s" style="background:var(--danger)" data-fn="updateBanAppealStatusUI" data-args=\'['+fnData(serverId)+','+fnData(a.id)+',\"denied\"]\'>Deny</button>' +
                    '</div>' : '') +
                    '</div>';
            }).join('');
        }
        cont.innerHTML = html;
    } catch (e) {
        cont.innerHTML = '<div class="empty"><p>Failed to load ban appeals</p></div>';
    }
    updateRefreshTimestamp('ban-appeals');
}

export async function submitBanAppealUI(serverId) {
    const userId = document.getElementById('baUserId')?.value;
    const userTag = document.getElementById('baUserTag')?.value;
    const reason = document.getElementById('baReason')?.value;
    const message = document.getElementById('baMessage')?.value;
    if (!userId || !userTag || !reason || !message) return showToast('Fill all fields', true);
    try {
        const r = await fetch('/api/server/' + serverId + '/ban-appeals', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, userTag, reason, message })
        });
        const d = await r.json();
        if (d.success) { showToast('Appeal submitted!'); loadBanAppeals(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

export async function updateBanAppealStatusUI(serverId, appealId, status) {
    const reviewNote = prompt('Enter review note (optional):') || null;
    try {
        const r = await fetch('/api/server/' + serverId + '/ban-appeals/' + appealId, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, reviewedBy: 'Dashboard', reviewNote })
        });
        const d = await r.json();
        if (d.success) { showToast('Appeal ' + status + '!'); loadBanAppeals(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

// ═══ REMINDERS ═══
async function loadReminders() {
    const cont = document.getElementById('remindersContent');
    if (!cont) return;

    cont.innerHTML = '<div class="loading" style="padding:30px;text-align:center;"><div class="spin"></div></div>';

    try {
        const r = await fetch('/api/reminders');
        const reminders = await r.json();

        var html = '<div class="stg" style="margin-bottom:16px;"><label>Create Reminder</label>' +
            '<div class="stg-inl" style="margin-bottom:8px;flex-wrap:wrap;">' +
            '<input type="text" id="remUserId" placeholder="User ID" style="flex:0 0 150px;">' +
            '<input type="text" id="remChannelId" placeholder="Channel ID (optional)" style="flex:1;min-width:200px;">' +
            '<input type="text" id="remText" placeholder="Reminder text" style="flex:1;min-width:200px;">' +
            '<input type="number" id="remDuration" placeholder="Duration (ms)" min="1000" style="flex:0 0 150px;">' +
            '<button class="btn btn-s" data-fn="createReminderUI">Create</button>' +
            '</div></div>';

        if (!reminders.length) {
            html += '<div class="empty"><p>No pending reminders</p></div>';
        } else {
            html += reminders.map(function (rem) {
                return '<div class="card" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
                    '<div style="flex:1;min-width:250px;">' +
                    '<strong>' + esc(rem.text.slice(0, 100)) + '</strong>' +
                    '<span class="sub">User: ' + rem.userId + ' · ' + timeSince(rem.createdAt) + ' ago</span>' +
                    '<span class="sub">Due: ' + new Date(rem.remindAt).toLocaleString() + '</span>' +
                    '</div>' +
                    '<button class="btn btn-s" style="background:var(--danger)" data-fn="deleteReminderUI" data-args=\'['+fnData(rem.id)+','+fnData(rem.userId)+']\'>Delete</button>' +
                    '</div>';
            }).join('');
        }
        cont.innerHTML = html;
    } catch (e) {
        cont.innerHTML = '<div class="empty"><p>Failed to load reminders</p></div>';
    }
    updateRefreshTimestamp('reminders');
}

export async function createReminderUI() {
    const userId = document.getElementById('remUserId')?.value;
    const channelId = document.getElementById('remChannelId')?.value;
    const text = document.getElementById('remText')?.value;
    const durationMs = parseInt(document.getElementById('remDuration')?.value);
    if (!userId || !text || !durationMs) return showToast('Fill all fields', true);
    try {
        const r = await fetch('/api/reminders', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, channelId: channelId || null, text, durationMs })
        });
        const d = await r.json();
        if (d.success) { showToast('Reminder created!'); loadReminders(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

export async function deleteReminderUI(id, userId) {
    if (!confirm('Delete this reminder?')) return;
    try {
        const r = await fetch('/api/reminders/' + id, {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        const d = await r.json();
        if (d.success) { showToast('Reminder deleted!'); loadReminders(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

