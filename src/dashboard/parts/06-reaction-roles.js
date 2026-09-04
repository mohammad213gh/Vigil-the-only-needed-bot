// ═══ REACTION ROLES ═══
async function loadReactionRoles() {
    const sel = document.getElementById('rrSrvSelect');
    if (!sel) return;
    if (sel.options.length <= 1 && allServers.length) {
        sel.innerHTML = '<option value="">Select a server...</option>' + allServers.map(function (s) {
            return '<option value="' + s.id + '"' + (curSrv === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
        }).join('');
    }
    const serverId = sel.value;
    const cont = document.getElementById('reactionRolesContent');
    if (!cont) return;

    if (!serverId) {
        cont.innerHTML = '<div class="empty"><p>Select a server to manage reaction roles</p></div>';
        updateRefreshTimestamp('reaction-roles');
        return;
    }

    cont.innerHTML = '<div class="loading" style="padding:30px;text-align:center;"><div class="spin"></div></div>';

    try {
        const r = await fetch('/api/server/' + serverId + '/reaction-roles');
        const d = await r.json();
        const roles = d.roles || [];
        const channels = d.channels || [];
        const rolesList = d.rolesList || [];

        // Build reaction roles list
        var html = '<div class="stg" style="margin-bottom:16px;"><label>Create New Reaction Role</label>' +
            '<div class="stg-inl" style="margin-bottom:8px;flex-wrap:wrap;">' +
            '<select id="rrNewChannel" style="flex:1;min-width:200px;"><option value="">Select channel...</option>' + channels.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('') + '</select>' +
            '<input type="text" id="rrNewMessageId" placeholder="Message ID (leave empty to create new)" style="flex:1;min-width:200px;">' +
            '<input type="text" id="rrNewEmoji" placeholder="Emoji (e.g. 🎉 or name:id)" style="flex:0 0 120px;">' +
            '<select id="rrNewRole" style="flex:1;min-width:200px;"><option value="">Select role...</option>' + rolesList.map(function (r) { return '<option value="' + r.id + '" style="color:' + (r.color || '#fff') + '">' + esc(r.name) + '</option>'; }).join('') + '</select>' +
            '<input type="text" id="rrNewLabel" placeholder="Label (optional)" style="flex:1;min-width:150px;">' +
            '<button class="btn btn-s" onclick="createReactionRoleUI()" style="padding:9px 14px;font-size:11px;">Add Reaction Role</button>' +
            '</div></div>';

        if (!roles.length) {
            html += '<div class="empty"><p>No reaction roles configured</p><p class="empty-act">Add a reaction role above to get started.</p></div>';
        } else {
            html += roles.map(function (rr) {
                var ch = channels.find(function (c) { return c.id === rr.channelId; });
                var rl = rolesList.find(function (r) { return r.id === rr.roleId; });
                return '<div class="card" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">' +
                    '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">' +
                    '<span style="font-size:24px;">' + esc(rr.emoji) + '</span>' +
                    '<div>' +
                    '<strong style="font-family:monospace;">' + esc(rr.messageId) + '</strong>' +
                    '<span class="sub">#' + esc(ch?.name || rr.channelId) + ' · ' + esc(rl?.name || rr.roleId) + '</span>' +
                    (rr.label ? '<span class="sub">' + esc(rr.label) + '</span>' : '') +
                    '</div>' +
                    '</div>' +
                    '<button class="btn btn-s" style="background:var(--danger)" onclick="deleteReactionRole(\'' + serverId + '\',\'' + rr.messageId + '\',\'' + esc(rr.emoji).replace(/'/g, "\\'") + '\')">Delete</button>' +
                    '</div>';
            }).join('');
        }
        cont.innerHTML = html;
    } catch (e) {
        cont.innerHTML = '<div class="empty"><p>Failed to load reaction roles</p></div>';
    }
    updateRefreshTimestamp('reaction-roles');
}

async function createReactionRoleUI() {
    const serverId = document.getElementById('rrSrvSelect')?.value;
    const channelId = document.getElementById('rrNewChannel')?.value;
    const messageId = document.getElementById('rrNewMessageId')?.value;
    const emoji = document.getElementById('rrNewEmoji')?.value;
    const roleId = document.getElementById('rrNewRole')?.value;
    const label = document.getElementById('rrNewLabel')?.value;
    if (!serverId || !channelId || !emoji || !roleId) return showToast('Fill all required fields', true);
    try {
        const r = await fetch('/api/server/' + serverId + '/reaction-roles', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId: messageId || null, channelId, emoji, roleId, label: label || null })
        });
        const d = await r.json();
        if (d.success) {
            showToast('Reaction role added!');
            loadReactionRoles();
        } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

async function deleteReactionRole(serverId, messageId, emoji) {
    if (!confirm('Delete this reaction role?')) return;
    try {
        const r = await fetch('/api/server/' + serverId + '/reaction-roles', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId, emoji })
        });
        const d = await r.json();
        if (d.success) { showToast('Reaction role deleted'); loadReactionRoles(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

async function createReactionRoleMessageUI() {
    const serverId = document.getElementById('rrSrvSelect')?.value;
    const channelId = document.getElementById('rrMsgChannel')?.value;
    const content = document.getElementById('rrMsgContent')?.value;
    const rolesInput = document.getElementById('rrMsgRoles')?.value;
    if (!serverId || !channelId || !rolesInput) return showToast('Fill all fields', true);
    try {
        const roles = rolesInput.split(',').map(function (r) {
            var parts = r.split(':').map(function (s) { return s.trim(); });
            return { emoji: parts[0], roleId: parts[1], label: parts[2] || null };
        }).filter(function (r) { return r.emoji && r.roleId; });
        if (!roles.length) return showToast('No valid roles', true);
        const r = await fetch('/api/server/' + serverId + '/reaction-roles/message', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId, content: content || '', roles })
        });
        const d = await r.json();
        if (d.success) { showToast('Message created!'); loadReactionRoles(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

// ═══ ROLE MENUS ═══
async function loadRoleMenus() {
    const sel = document.getElementById('rmSrvSelect');
    if (!sel) return;
    if (sel.options.length <= 1 && allServers.length) {
        sel.innerHTML = '<option value="">Select a server...</option>' + allServers.map(function (s) {
            return '<option value="' + s.id + '"' + (curSrv === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
        }).join('');
    }
    const serverId = sel.value;
    const cont = document.getElementById('roleMenusContent');
    if (!cont) return;

    if (!serverId) {
        cont.innerHTML = '<div class="empty"><p>Select a server to manage role menus</p></div>';
        updateRefreshTimestamp('role-menus');
        return;
    }

    cont.innerHTML = '<div class="loading" style="padding:30px;text-align:center;"><div class="spin"></div></div>';

    try {
        const r = await fetch('/api/server/' + serverId + '/role-menus');
        const d = await r.json();
        const menus = d.menus || [];
        const channels = d.channels || [];
        const rolesList = d.rolesList || [];

        var html = '<div class="stg" style="margin-bottom:16px;"><label>Create New Role Menu</label>' +
            '<div class="stg-inl" style="margin-bottom:8px;flex-wrap:wrap;">' +
            '<input type="text" id="rmNewTitle" placeholder="Menu title (e.g. Self-Assignable Roles)" style="flex:1;min-width:200px;">' +
            '<select id="rmNewChannel" style="flex:1;min-width:200px;"><option value="">Select channel...</option>' + channels.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('') + '</select>' +
            '<button class="btn btn-s" onclick="createRoleMenuUI()" style="padding:9px 14px;font-size:11px;">Create Menu</button>' +
            '</div></div>';

        if (!menus.length) {
            html += '<div class="empty"><p>No role menus configured</p><p class="empty-act">Create a role menu above to get started.</p></div>';
        } else {
            html += menus.map(function (m) {
                var ch = channels.find(function (c) { return c.id === m.channel_id; });
                return '<div class="card" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">' +
                    '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">' +
                    '<div>' +
                    '<strong>' + esc(m.title || 'Role Menu') + '</strong>' +
                    '<span class="sub">#' + esc(ch?.name || m.channel_id) + ' · ID: ' + esc(m.message_id) + '</span>' +
                    '</div>' +
                    '</div>' +
                    '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                    '<button class="btn btn-s" onclick="editRoleMenuUI(\'' + serverId + '\',\'' + m.message_id + '\',\'' + esc(m.title || '').replace(/'/g, "\\'") + '\',\'' + m.channel_id + '\')">Edit</button>' +
                    '<button class="btn btn-s" onclick="publishRoleMenuUI(\'' + serverId + '\',\'' + m.message_id + '\',\'' + m.channel_id + '\')">Publish</button>' +
                    '<button class="btn btn-s" style="background:var(--danger)" onclick="deleteRoleMenu(\'' + serverId + '\',\'' + m.message_id + '\',\'' + m.channel_id + '\')">Delete</button>' +
                    '</div>' +
                    '</div>';
            }).join('');
        }
        cont.innerHTML = html;
    } catch (e) {
        cont.innerHTML = '<div class="empty"><p>Failed to load role menus</p></div>';
    }
    updateRefreshTimestamp('role-menus');
}

async function createRoleMenuUI() {
    const serverId = document.getElementById('rmSrvSelect')?.value;
    const channelId = document.getElementById('rmNewChannel')?.value;
    const title = document.getElementById('rmNewTitle')?.value;
    if (!serverId || !channelId) return showToast('Fill all fields', true);
    try {
        const r = await fetch('/api/server/' + serverId + '/role-menus', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId, title: title || 'Self-Assignable Roles' })
        });
        const d = await r.json();
        if (d.success) {
            showToast('Role menu created!');
            loadRoleMenus();
        } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

async function editRoleMenuUI(serverId, messageId, title, channelId) {
    const cont = document.getElementById('roleMenusContent');
    if (!cont) return;
    try {
        const r = await fetch('/api/server/' + serverId + '/role-menus');
        const d = await r.json();
        const rolesList = d.rolesList || [];
        const optionsRes = await fetch('/api/server/' + serverId + '/role-menus/' + messageId + '/options');
        const optionsData = await optionsRes.json();
        const options = optionsData.options || [];

        var html = '<div class="stg" style="margin-bottom:16px;"><label>Edit Role Menu: ' + esc(title) + '</label>' +
            '<div class="stg-inl" style="margin-bottom:8px;flex-wrap:wrap;">' +
            '<input type="text" id="rmEditTitle" value="' + esc(title) + '" placeholder="Menu title" style="flex:1;min-width:200px;">' +
            '<button class="btn btn-s" onclick="saveRoleMenuTitle(\'' + serverId + '\',\'' + messageId + '\')">Save Title</button>' +
            '</div></div>';

        html += '<div class="stg" style="margin-bottom:16px;"><label>Add Role Option</label>' +
            '<div class="stg-inl" style="margin-bottom:8px;flex-wrap:wrap;">' +
            '<select id="rmAddRole" style="flex:1;min-width:200px;"><option value="">Select role...</option>' + rolesList.map(function (r) { return '<option value="' + r.id + '" style="color:' + (r.color || '#fff') + '">' + esc(r.name) + '</option>'; }).join('') + '</select>' +
            '<input type="text" id="rmAddLabel" placeholder="Label (optional)" style="flex:1;min-width:150px;">' +
            '<input type="text" id="rmAddEmoji" placeholder="Emoji (optional)" style="flex:0 0 100px;">' +
            '<input type="text" id="rmAddDesc" placeholder="Description (optional)" style="flex:1;min-width:150px;">' +
            '<button class="btn btn-s" onclick="addRoleMenuOptionUI(\'' + serverId + '\',\'' + messageId + '\')">Add Role</button>' +
            '</div></div>';

        if (!options.length) {
            html += '<div class="empty"><p>No roles in this menu yet</p></div>';
        } else {
            html += '<div style="max-height:300px;overflow-y:auto;">' + options.map(function (o) {
                var rl = rolesList.find(function (r) { return r.id === o.role_id; });
                return '<div class="card" style="margin-bottom:4px;display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
                    '<div style="display:flex;align-items:center;gap:8px;">' +
                    (o.emoji ? '<span>' + esc(o.emoji) + '</span>' : '') +
                    '<strong>' + esc(o.label || (rl ? rl.name : o.role_id)) + '</strong>' +
                    '<span class="sub">' + esc(o.description || '') + '</span>' +
                    '</div>' +
                    '<button class="btn btn-s" style="background:var(--danger);padding:3px 8px;font-size:10px;" onclick="removeRoleMenuOptionUI(\'' + serverId + '\',\'' + messageId + '\',\'' + o.role_id + '\')">Remove</button>' +
                    '</div>';
            }).join('') + '</div>';
        }

        html += '<div style="margin-top:16px;display:flex;gap:8px;">' +
            '<button class="btn btn-s" onclick="publishRoleMenuUI(\'' + serverId + '\',\'' + messageId + '\',\'' + channelId + '\')">Publish Menu</button>' +
            '<button class="btn btn-s" style="background:var(--danger)" onclick="deleteRoleMenu(\'' + serverId + '\',\'' + messageId + '\',\'' + channelId + '\')">Delete Menu</button>' +
            '<button class="btn btn-s" onclick="loadRoleMenus()">Back</button>' +
            '</div>';

        cont.innerHTML = html;
    } catch (e) {
        cont.innerHTML = '<div class="empty"><p>Failed to load role menu editor</p></div>';
    }
}

async function saveRoleMenuTitle(serverId, messageId) {
    const title = document.getElementById('rmEditTitle')?.value;
    if (!title) return showToast('Enter a title', true);
    try {
        const r = await fetch('/api/server/' + serverId + '/role-menus/' + messageId, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        const d = await r.json();
        if (d.success) { showToast('Title updated!'); editRoleMenuUI(serverId, messageId, title, ''); } else showToast('Failed', true);
    } catch { showToast('Failed', true); }
}

async function addRoleMenuOptionUI(serverId, messageId) {
    const roleId = document.getElementById('rmAddRole')?.value;
    const label = document.getElementById('rmAddLabel')?.value;
    const emoji = document.getElementById('rmAddEmoji')?.value;
    const description = document.getElementById('rmAddDesc')?.value;
    if (!roleId) return showToast('Select a role', true);
    try {
        const r = await fetch('/api/server/' + serverId + '/role-menus/' + messageId + '/options', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roleId, label: label || null, emoji: emoji || null, description: description || null })
        });
        const d = await r.json();
        if (d.success) { showToast('Role added!'); editRoleMenuUI(serverId, messageId, '', ''); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

async function removeRoleMenuOptionUI(serverId, messageId, roleId) {
    try {
        const r = await fetch('/api/server/' + serverId + '/role-menus/' + messageId + '/options', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roleId })
        });
        const d = await r.json();
        if (d.success) { showToast('Role removed!'); editRoleMenuUI(serverId, messageId, '', ''); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

async function publishRoleMenuUI(serverId, messageId, channelId) {
    try {
        const r = await fetch('/api/server/' + serverId + '/role-menus/' + messageId + '/publish?channelId=' + channelId, { method: 'PUT' });
        const d = await r.json();
        if (d.success) { showToast('Menu published!'); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

async function deleteRoleMenu(serverId, messageId, channelId) {
    if (!confirm('Delete this role menu and its message?')) return;
    try {
        const r = await fetch('/api/server/' + serverId + '/role-menus/' + messageId + '?channelId=' + channelId, { method: 'DELETE' });
        const d = await r.json();
        if (d.success) { showToast('Role menu deleted'); loadRoleMenus(); } else showToast('Failed: ' + d.error, true);
    } catch { showToast('Failed', true); }
}

