// ═══ MOD TOOLS ═══
async function loadSrvModTools(id){
  const el=document.getElementById('mgmtModTools');
  if(!el)return;
  el.innerHTML='<div class="tw"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>Staff Notes</div><div style="padding:14px;">'
  +'<div style="display:flex;gap:8px;margin-bottom:12px;"><input type="text" id="noteUserSearch" placeholder="Enter User ID..." style="flex:1;padding:9px 14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:13px;outline:none;font-family:inherit;"><button class="btn btn-s" onclick="loadSrvNotes('+id+')" style="padding:9px 14px;font-size:11px;">Search</button></div>'
  +'<div id="srvNotesList"><div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>Search a user ID above to view or add notes.</p></div></div>'
  +'</div></div>'
  +'<div class="tw"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Invite Tracking</div><div style="padding:14px;"><div id="srvInviteStats">'
  +'<div class="loading"><div class="spin"></div></div></div></div></div>'
  +'<div class="tw"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Quick Mod Actions</div><div style="padding:14px;">'
  +'<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;"><input type="text" id="modUserSearch" placeholder="Enter User ID..." style="flex:1;min-width:200px;padding:9px 14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:13px;outline:none;font-family:inherit;"><input type="text" id="modReason" placeholder="Reason (optional)..." style="flex:1;min-width:200px;padding:9px 14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:13px;outline:none;font-family:inherit;"></div>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;">'
  +'<button class="btn btn-s" onclick="warnSrvMember('+id+')" style="background:rgba(241,196,15,0.12);color:#f1c40f;border-color:rgba(241,196,15,0.2);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Warn</button>'
  +'<button class="btn btn-s" onclick="kickSrvMember('+id+')" style="background:rgba(237,66,69,0.12);color:#ed4245;border-color:rgba(237,66,69,0.2);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M16 17l5-5-5-5M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>Kick</button>'
  +'<button class="btn btn-s" onclick="banSrvMember('+id+')" style="background:rgba(237,66,69,0.12);color:#ed4245;border-color:rgba(237,66,69,0.2);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>Ban</button>'
  +'<button class="btn btn-s" onclick="timeoutSrvMember('+id+')" style="background:rgba(88,101,242,0.12);color:#5865F2;border-color:rgba(88,101,242,0.2);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Timeout</button>'
  +'</div></div></div>'
  +'<div id="modActionResult"></div>';
  try{
    const r=await fetch('/api/server/'+id+'/invites');
    if(r.ok){
      const d=await r.json();
      let html='';
      if(d.top&&d.top.length){
        html=d.top.map(function(m,i){
          return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;"><span style="color:var(--text-muted);width:20px;">'+(i+1)+'.</span><span style="flex:1;color:var(--text);">'+esc(m.inviter||"Unknown")+'</span><span style="color:var(--accent);font-weight:600;">'+m.count+' joins</span></div>';
        }).join('');
      }else{
        html='<div class="empty"><p>No invite data yet.</p></div>';
      }
      document.getElementById('srvInviteStats').innerHTML=html;
    }
  }catch(e){
    document.getElementById('srvInviteStats').innerHTML='<div class="empty"><p>Could not load invite data.</p></div>';
  }
}
async function loadSrvNotes(id){
  const userId=document.getElementById('noteUserSearch').value.trim();
  if(!userId)return showToast('Enter a user ID',true);
  const el=document.getElementById('srvNotesList');
  if(!el)return;
  el.innerHTML='<div class="loading"><div class="spin"></div></div>';
  try{
    const r=await fetch('/api/server/'+id+'/notes?userId='+encodeURIComponent(userId));
    const d=await r.json();
    var notesHtml='';
    if(d.notes&&d.notes.length){
      notesHtml='<div style="margin-bottom:10px;">'+d.notes.map(function(n){
        return '<div style="display:flex;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:6px;">'
          +'<div style="flex:1;"><div style="font-size:12px;color:var(--text);line-height:1.4;">'+esc(n.note)+'</div>'
          +'<div style="display:flex;gap:8px;margin-top:4px;font-size:10px;color:var(--text-muted);">'
          +'<span>By: '+esc(n.authorTag)+'</span><span>'+new Date(n.createdAt).toLocaleDateString()+'</span></div></div></div>';
      }).join('')+'</div>';
    }else{
      notesHtml='<div class="empty"><p>No notes for this user.</p></div>';
    }
    notesHtml+='<div style="display:flex;gap:6px;margin-top:8px;"><input type="text" id="newNoteText" placeholder="Add a note..." style="flex:1;padding:8px 12px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:12px;outline:none;font-family:inherit;"><button class="btn btn-s" onclick="addSrvNote('+id+',\''+userId+'\')" style="padding:8px 14px;font-size:11px;">Add Note</button></div>';
    el.innerHTML=notesHtml;
  }catch(e){
    el.innerHTML='<div class="empty"><p>Could not load notes.</p></div>';
  }
}
async function addSrvNote(serverId,userId){
  const text=document.getElementById('newNoteText');if(!text||!text.value.trim())return showToast('Enter note text',true);
  try{
    const r=await fetch('/api/server/'+serverId+'/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({targetUserId:userId,note:text.value.trim()})});
    const d=await r.json();
    if(d.success){showToast('Note added!');loadSrvNotes(serverId);}
    else showToast(d.error||'Failed',true);
  }catch(e){showToast('Failed to add note',true);}
}
async function warnSrvMember(serverId){
  const uidEl=document.getElementById('modUserSearch'),reasonEl=document.getElementById('modReason');if(!uidEl||!reasonEl)return showToast('Mod panel not ready',true);
  const uid=uidEl.value.trim(),reason=reasonEl.value.trim()||'No reason provided';
  if(!uid)return showToast('Enter a user ID',true);
  document.getElementById('modActionResult').innerHTML='<div class="loading"><div class="spin"></div></div>';
  try{
    const r=await fetch('/api/server/'+serverId+'/mod/warn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:uid,reason:reason})});
    const d=await r.json();
    if(d.success)document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(59,165,92,0.08);border:1px solid rgba(59,165,92,0.15);border-radius:var(--radius-sm);color:#3ba55c;font-size:13px;font-weight:500;">✅ Warned user '+esc(d.user)+'</div>';
    else document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(237,66,69,0.08);border:1px solid rgba(237,66,69,0.15);border-radius:var(--radius-sm);color:#ed4245;font-size:13px;font-weight:500;">❌ '+esc(d.error)+'</div>';
  }catch{document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(237,66,69,0.08);border:1px solid rgba(237,66,69,0.15);border-radius:var(--radius-sm);color:#ed4245;font-size:13px;font-weight:500;">❌ Request failed</div>';}
}
async function kickSrvMember(serverId){
  const uidEl=document.getElementById('modUserSearch'),reasonEl=document.getElementById('modReason');if(!uidEl||!reasonEl)return showToast('Mod panel not ready',true);
  const uid=uidEl.value.trim(),reason=reasonEl.value.trim()||'No reason provided';
  if(!uid)return showToast('Enter a user ID',true);
  document.getElementById('modActionResult').innerHTML='<div class="loading"><div class="spin"></div></div>';
  try{
    const r=await fetch('/api/server/'+serverId+'/mod/kick',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:uid,reason:reason})});
    const d=await r.json();
    if(d.success)document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(59,165,92,0.08);border:1px solid rgba(59,165,92,0.15);border-radius:var(--radius-sm);color:#3ba55c;font-size:13px;font-weight:500;">✅ Kicked user '+esc(d.user)+'</div>';
    else document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(237,66,69,0.08);border:1px solid rgba(237,66,69,0.15);border-radius:var(--radius-sm);color:#ed4245;font-size:13px;font-weight:500;">❌ '+esc(d.error)+'</div>';
  }catch{document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(237,66,69,0.08);border:1px solid rgba(237,66,69,0.15);border-radius:var(--radius-sm);color:#ed4245;font-size:13px;font-weight:500;">❌ Request failed</div>';}
}
async function banSrvMember(serverId){
  const uidEl=document.getElementById('modUserSearch'),reasonEl=document.getElementById('modReason');if(!uidEl||!reasonEl)return showToast('Mod panel not ready',true);
  const uid=uidEl.value.trim(),reason=reasonEl.value.trim()||'No reason provided';
  if(!uid)return showToast('Enter a user ID',true);
  document.getElementById('modActionResult').innerHTML='<div class="loading"><div class="spin"></div></div>';
  try{
    const r=await fetch('/api/server/'+serverId+'/mod/ban',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:uid,reason:reason})});
    const d=await r.json();
    if(d.success)document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(59,165,92,0.08);border:1px solid rgba(59,165,92,0.15);border-radius:var(--radius-sm);color:#3ba55c;font-size:13px;font-weight:500;">✅ Banned user '+esc(d.user)+'</div>';
    else document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(237,66,69,0.08);border:1px solid rgba(237,66,69,0.15);border-radius:var(--radius-sm);color:#ed4245;font-size:13px;font-weight:500;">❌ '+esc(d.error)+'</div>';
  }catch{document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(237,66,69,0.08);border:1px solid rgba(237,66,69,0.15);border-radius:var(--radius-sm);color:#ed4245;font-size:13px;font-weight:500;">❌ Request failed</div>';}
}
async function timeoutSrvMember(serverId){
  const uidEl=document.getElementById('modUserSearch'),reasonEl=document.getElementById('modReason');if(!uidEl||!reasonEl)return showToast('Mod panel not ready',true);
  const uid=uidEl.value.trim(),reason=reasonEl.value.trim()||'No reason provided';
  if(!uid)return showToast('Enter a user ID',true);
  const duration=prompt('Timeout duration in minutes:','10');if(!duration||isNaN(duration))return;
  document.getElementById('modActionResult').innerHTML='<div class="loading"><div class="spin"></div></div>';
  try{
    const r=await fetch('/api/server/'+serverId+'/mod/timeout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:uid,reason:reason,duration:parseInt(duration)})});
    const d=await r.json();
    if(d.success)document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(59,165,92,0.08);border:1px solid rgba(59,165,92,0.15);border-radius:var(--radius-sm);color:#3ba55c;font-size:13px;font-weight:500;">✅ Timed out user '+esc(d.user)+' for '+duration+' min</div>';
    else document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(237,66,69,0.08);border:1px solid rgba(237,66,69,0.15);border-radius:var(--radius-sm);color:#ed4245;font-size:13px;font-weight:500;">❌ '+esc(d.error)+'</div>';
  }catch{document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(237,66,69,0.08);border:1px solid rgba(237,66,69,0.15);border-radius:var(--radius-sm);color:#ed4245;font-size:13px;font-weight:500;">❌ Request failed</div>';}
}


// ═══ MOD STATS ═══
async function loadMod(){
  const summary=document.getElementById('modSummary'),recent=document.getElementById('modRecent'),topW=document.getElementById('modTopWarned');
  if(!summary||!recent||!topW)return;
  summary.innerHTML='<div class="card sk" style="padding:20px 16px;text-align:center;"><div class="sk-line w40" style="margin:0 auto;"></div><div class="sk-line w30 h24" style="margin:6px auto 0;"></div></div><div class="card sk" style="padding:20px 16px;text-align:center;"><div class="sk-line w40" style="margin:0 auto;"></div><div class="sk-line w30 h24" style="margin:6px auto 0;"></div></div><div class="card sk" style="padding:20px 16px;text-align:center;"><div class="sk-line w40" style="margin:0 auto;"></div><div class="sk-line w30 h24" style="margin:6px auto 0;"></div></div><div class="card sk" style="padding:20px 16px;text-align:center;"><div class="sk-line w40" style="margin:0 auto;"></div><div class="sk-line w30 h24" style="margin:6px auto 0;"></div></div>';
  recent.innerHTML='<div class="mod-list" style="padding:12px;"><div class="sk"><div class="sk-line w60"></div><div class="sk-line w40" style="margin-top:4px;"></div></div><div class="sk"><div class="sk-line w50"></div><div class="sk-line w35" style="margin-top:4px;"></div></div><div class="sk"><div class="sk-line w70"></div><div class="sk-line w45" style="margin-top:4px;"></div></div></div>';
  topW.innerHTML='<div class="mod-list" style="padding:12px;"><div class="sk"><div class="sk-line w50"></div><div class="sk-line w20" style="margin-top:4px;"></div></div><div class="sk"><div class="sk-line w45"></div><div class="sk-line w25" style="margin-top:4px;"></div></div><div class="sk"><div class="sk-line w55"></div><div class="sk-line w30" style="margin-top:4px;"></div></div></div>';

  // Use the first server in the list, or the currently selected server
  let serverId=curSrv||(allServers.length?allServers[0].id:null);
  if(!serverId){summary.innerHTML='<div class="empty" style="grid-column:1/-1;"><p>No server selected</p><p class="empty-act">Select a server from the Servers tab to view mod stats.</p></div>';recent.innerHTML='';topW.innerHTML='';return}

  try{
    const r=await fetch('/api/server/'+serverId+'/modstats');
    const d=await r.json();
    if(!d||d.error)throw new Error(d.error||'No data');

    // Summary cards
    const byTypeHtml=d.byType&&d.byType.length?d.byType.map(function(t){
      const colors={warn:'#f1c40f',kick:'#e67e22',ban:'#ed4245',timeout:'#9b59b6',unban:'#3ba55c',tempban:'#e74c3c',lock:'#3498db',unlock:'#2ecc71',purge:'#95a5a6'};
      return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:11px;"><span style="width:10px;height:10px;border-radius:3px;background:'+((colors[t.action]||'#5865F2'))+';flex-shrink:0;"></span><span style="flex:1;color:var(--text-dim);text-transform:capitalize;">'+t.action+'</span><span style="color:var(--text);font-weight:700;font-family:monospace;">'+t.count+'</span></div>';
    }).join(''):'<div style="font-size:11px;color:var(--text-muted);padding:4px 0;">No actions recorded</div>';

    summary.innerHTML=
      '<div class="card" style="text-align:center;padding:20px 16px;"><div class="lbl" style="font-size:9px;">Total Cases</div><div class="val" style="font-size:28px;font-weight:800;font-family:monospace;">'+(d.total||0)+'</div><div class="sub" style="font-size:10px;">'+((d.active||0))+' active</div></div>'+
      '<div class="card" style="text-align:center;padding:20px 16px;"><div class="lbl" style="font-size:9px;">By Type</div><div style="margin-top:8px;">'+byTypeHtml+'</div></div>'+
      '<div class="card" style="text-align:center;padding:20px 16px;"><div class="lbl" style="font-size:9px;">Server</div><div class="val" style="font-size:20px;font-weight:700;font-family:monospace;">'+(allServers.find(function(s){return s.id===serverId})?.name||serverId).slice(0,20)+'</div><div class="sub" style="font-size:10px;">'+((allServers.find(function(s){return s.id===serverId})?.memberCount)||'?')+' members</div></div>'+
      '<div class="card" style="text-align:center;padding:20px 16px;"><div class="lbl" style="font-size:9px;">Case Types</div><div class="val" style="font-size:20px;font-weight:700;font-family:monospace;">'+(d.byType?.length||0)+'</div><div class="sub" style="font-size:10px;">Unique action types</div></div>';

    // Recent cases
    if(d.recent&&d.recent.length){
      recent.innerHTML='<div class="mod-list" style="padding:8px 12px 12px;">'+d.recent.slice(0,10).map(function(c){
        const cs={warn:'#f1c40f',kick:'#e67e22',ban:'#ed4245',timeout:'#9b59b6',unban:'#3ba55c',tempban:'#e74c3c',lock:'#3498db',unlock:'#2ecc71'};
        return '<div class="mod-item">'+
          '<div class="mod-icon" style="background:rgba('+((cs[c.actionType]||'#5865F2').replace('#','').match(/.{2}/g).map(function(x){return parseInt(x,16)}).join(',')||'88,101,242')+',0.1);">'+
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;color:'+(cs[c.actionType]||'#5865F2')+'"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>'+
          '<div class="mod-body"><div class="mod-top"><span class="mod-type" style="text-transform:capitalize;">'+c.actionType+' <span class="mod-user">#'+c.caseNumber+'</span></span><span class="mod-badge '+(c.active?'active':'closed')+'">'+(c.active?'Active':'Closed')+'</span></div>'+
          '<div class="mod-reason">'+(c.reason||'No reason')+'</div></div>'+
          '<div class="mod-time">By '+(c.moderatorTag?.split('#')[0]||'Unknown')+'</div></div>';
      }).join('')+'</div>';
    }else recent.innerHTML='<div class="mod-list"><div class="empty"><p>No recent cases</p><p class="empty-act">Moderation actions will appear here.</p></div></div>';

    // Top warned
    if(d.topWarned&&d.topWarned.length){
      topW.innerHTML='<div class="mod-list" style="padding:8px 12px 12px;">'+d.topWarned.map(function(u,i){
        const medals=['\uD83E\uDD47','\uD83E\uDD48','\uD83E\uDD49','',''];
        return '<div class="mod-item"><span style="font-size:14px;width:24px;text-align:center;">'+(medals[i]||i+1)+'</span><div class="mod-body"><div class="mod-top"><span class="mod-type">'+(u.tag||u.userId).slice(0,25)+'</span></div></div><div class="mod-count">'+u.count+'</div></div>';
      }).join('')+'</div>';
    }else topW.innerHTML='<div class="mod-list"><div class="empty"><p>No warnings yet</p></div></div>';

    updateRefreshTimestamp('moderation');
  }catch(e){
    summary.innerHTML='<div class="empty" style="grid-column:1/-1;"><p>Could not load moderation data</p><p class="empty-act">'+e.message+'</p></div>';
    recent.innerHTML='';topW.innerHTML='';
  }
}

// ═══ MOD: MEMBER PROFILE LOOKUP ═══
function loadMpServers(){
  var sel=document.getElementById('mpSrv');if(!sel)return;
  var cur=sel.value;
  sel.innerHTML='<option value="">Select server…</option>'+allServers.map(function(s){return '<option value="'+s.id+'">'+esc(s.name)+'</option>'}).join('');
  if(cur)sel.value=cur;
}
async function searchMembers(){
  var srv=document.getElementById('mpSrv').value;
  var q=document.getElementById('mpSearch').value.trim();
  var el=document.getElementById('mpResults');
  if(!srv||!q){el.innerHTML='<div class="tk-chip-none">Select a server and type a name or user ID.</div>';return}
  try{
    var r=await fetch('/api/server/'+srv+'/members/search?q='+encodeURIComponent(q)),d=await r.json();
    var mems=d.members||[];
    if(!mems.length){el.innerHTML='<div class="tk-chip-none">No members found.</div>';return}
    el.innerHTML='<div class="mp-results">'+mems.map(function(m){
      return '<div class="mp-result" onclick="loadMemberProfile(\''+srv+'\',\''+m.id+'\')"><img class="mp-avatar-s" src="'+esc(m.avatar||'')+'" onerror="this.style.display=\'none\'"><span class="mp-tag-s">'+esc(m.tag)+'</span><span class="mp-sub-s">'+(m.isBot?'BOT':'@'+esc(m.displayName||m.tag.split('#')[0]))+'</span></div>';
    }).join('')+'</div>';
  }catch{el.innerHTML='<div class="empty"><p>Search failed.</p></div>'}
}
async function loadMemberProfile(srv,userId){
  var el=document.getElementById('mpProfile');
  el.style.display='block';
  el.innerHTML='<div class="empty"><p>Loading profile…</p></div>';
  try{
    var r=await fetch('/api/server/'+srv+'/member/'+userId+'/profile'),d=await r.json();
    if(d.error){el.innerHTML='<div class="empty"><p>'+esc(d.error)+'</p></div>';return}
    renderMemberProfile(el,d);
  }catch{el.innerHTML='<div class="empty"><p>Failed to load profile.</p></div>'}
}
function mpDate(v){var t=tkTimeAgo(v);return t||(v?esc(String(v)):'—')}
function renderMemberProfile(el,d){
  var m=d.member;
  var header;
  if(m){
    var rolesHtml=(m.roles&&m.roles.length)?'<div class="mp-roles">'+m.roles.slice(0,8).map(function(r){return '<span class="mp-role" style="border-color:'+(r.color&&r.color!=='#000000'?r.color:'var(--border)')+';">'+esc(r.name)+'</span>'}).join('')+(m.roles.length>8?'<span class="mp-role">+'+(m.roles.length-8)+'</span>':'')+'</div>':'';
    header='<div class="mp-head"><img class="mp-avatar" src="'+esc(m.avatar||'')+'" onerror="this.style.display=\'none\'"><div class="mp-head-info"><div class="mp-tag">'+esc(m.tag)+(m.isBot?' <span class="err-badge">BOT</span>':'')+'</div><div class="mp-sub">'+(m.displayName&&m.displayName!==m.tag?'@'+esc(m.displayName)+' · ':'')+'joined '+mpDate(m.joinedAt)+'</div>'+rolesHtml+'</div></div>';
  }else{
    header='<div class="mp-head"><div class="mp-head-info"><div class="mp-sub">Member no longer in the server — showing stored data.</div></div></div>';
  }
  var w=d.warnings||[],n=d.notes||[],c=d.cases||[],inv=d.invites||{total:0,joiners:[]};
  var stats='<div class="mp-stats">'+
    '<div class="mp-stat"><div class="mp-stat-v" style="color:#f1c40f;">'+w.length+'</div><div class="mp-stat-l">Warnings</div></div>'+
    '<div class="mp-stat"><div class="mp-stat-v" style="color:#5865F2;">'+n.length+'</div><div class="mp-stat-l">Notes</div></div>'+
    '<div class="mp-stat"><div class="mp-stat-v" style="color:#ed4245;">'+c.length+'</div><div class="mp-stat-l">Cases</div></div>'+
    '<div class="mp-stat"><div class="mp-stat-v" style="color:#3ba55c;">'+inv.total+'</div><div class="mp-stat-l">Invites</div></div></div>';

  var cs={warn:'#f1c40f',kick:'#e67e22',ban:'#ed4245',timeout:'#9b59b6',unban:'#3ba55c',tempban:'#e74c3c',lock:'#3498db',unlock:'#2ecc71'};
  var casesHtml=c.length?'<div class="mp-sec"><div class="mp-sec-h">Mod Cases ('+c.length+')</div>'+c.slice(0,15).map(function(x){
    return '<div class="mp-row"><span class="mp-type" style="color:'+(cs[x.actionType]||'#5865F2')+';">'+esc(x.actionType)+' #'+x.caseNumber+'</span><span class="mp-reason">'+esc(x.reason||'No reason')+'</span><span class="mp-meta">'+(x.active?'<span class="tk-status-pill tk-st-open">Active</span>':'<span class="tk-status-pill tk-st-closed">Closed</span>')+' · by '+(x.moderatorTag?esc(x.moderatorTag):'?')+' · '+mpDate(x.createdAt)+'</span></div>';
  }).join('')+'</div>':'<div class="mp-sec"><div class="mp-sec-h">Mod Cases</div><div class="tk-chip-none">No cases.</div></div>';

  var warnsHtml=w.length?'<div class="mp-sec"><div class="mp-sec-h">Warnings ('+w.length+')</div>'+w.slice(0,10).map(function(x){
    return '<div class="mp-row"><span class="mp-type" style="color:#f1c40f;">warning</span><span class="mp-reason">'+esc(x.reason||'No reason')+'</span><span class="mp-meta">by '+(x.moderator?esc(x.moderator):'?')+' · '+mpDate(x.date)+'</span></div>';
  }).join('')+'</div>':'<div class="mp-sec"><div class="mp-sec-h">Warnings</div><div class="tk-chip-none">No warnings.</div></div>';

  var notesHtml=n.length?'<div class="mp-sec"><div class="mp-sec-h">Staff Notes ('+n.length+')</div>'+n.slice(0,10).map(function(x){
    return '<div class="mp-row"><span class="mp-type" style="color:#5865F2;">note</span><span class="mp-reason">'+esc(x.note||'')+'</span><span class="mp-meta">by '+(x.authorTag?esc(x.authorTag):'?')+' · '+mpDate(x.createdAt)+'</span></div>';
  }).join('')+'</div>':'<div class="mp-sec"><div class="mp-sec-h">Staff Notes</div><div class="tk-chip-none">No notes.</div></div>';

  var invHtml='<div class="mp-sec"><div class="mp-sec-h">Invites ('+inv.total+')</div>'+(inv.joiners&&inv.joiners.length?inv.joiners.slice(0,10).map(function(x){
    return '<div class="mp-row"><span class="mp-type" style="color:#3ba55c;">invite</span><span class="mp-reason">joined '+(x.joiner_id?'<@'+x.joiner_id+'>':'unknown')+'</span><span class="mp-meta">'+mpDate(x.joined_at)+'</span></div>';
  }).join(''):'<div class="tk-chip-none">No invite records.</div>')+'</div>';

  el.innerHTML='<div class="mp-card">'+header+stats+casesHtml+warnsHtml+notesHtml+invHtml+'</div>';
}

// ═══ INSIGHTS ═══
async function loadInsights(){
  const sel=document.getElementById('insSrvSelect');
  if(!sel)return;
  // Populate server select if empty
  if(sel.options.length<=1&&allServers.length){
    sel.innerHTML='<option value="">Select a server...</option>'+allServers.map(function(s){return '<option value="'+s.id+'"'+(curSrv===s.id?' selected':'')+'>'+esc(s.name)+'</option>';}).join('');
  }

  const serverId=sel.value;
  const topUsers=document.getElementById('insTopUsers'),topChannels=document.getElementById('insTopChannels'),totalEl=document.getElementById('insTotal');
  if(!serverId){
    topUsers.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><p>Select a server to view insights</p></div>';
    topChannels.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/></svg><p>Server activity data appears here</p></div>';
    if(totalEl)totalEl.textContent='0';
    updateRefreshTimestamp('insights');
    return;
  }

  topUsers.innerHTML='<div class="loading" style="padding:24px;"><div class="spin"></div></div>';
  topChannels.innerHTML='<div class="loading" style="padding:24px;"><div class="spin"></div></div>';

  try{
    const r=await fetch('/api/insights/'+serverId);
    const d=await r.json();
    if(!d||d.error)throw new Error(d.error||'No data');

    if(d.topUsers&&d.topUsers.length){
      topUsers.innerHTML='<div style="padding:8px 12px 12px;">'+d.topUsers.map(function(u,i){
        const medals=['\uD83E\uDD47','\uD83E\uDD48','\uD83E\uDD49'];
        return '<div class="mod-item">'+
          '<span style="font-size:13px;width:22px;text-align:center;">'+(medals[i]||i+1)+'</span>'+
          (u.avatar?'<img src="'+u.avatar+'" style="width:24px;height:24px;border-radius:50%;">':'<div class="mod-icon" style="background:rgba(var(--accent-rgb),0.1);color:var(--accent);font-size:10px;">'+(u.tag?u.tag[0].toUpperCase():'?')+'</div>')+
          '<div class="mod-body"><div class="mod-top"><span class="mod-type">'+(u.tag||u.userId).slice(0,25)+'</span></div></div>'+
          '<div class="mod-count" style="color:var(--accent);">'+u.total.toLocaleString()+'</div></div>';
      }).join('')+'</div>';
    }else topUsers.innerHTML='<div class="empty"><p>No activity data yet</p><p class="empty-act">Messages must be tracked and logged first.</p></div>';

    if(d.topChannels&&d.topChannels.length){
      topChannels.innerHTML='<div style="padding:8px 12px 12px;">'+d.topChannels.map(function(c,i){
        return '<div class="mod-item"><span class="mod-icon" style="background:rgba(var(--accent-rgb),0.08);color:var(--accent);">#'+(i+1)+'</span><div class="mod-body"><div class="mod-top"><span class="mod-type">#'+c.name+'</span></div></div><div class="mod-count">'+c.total.toLocaleString()+'</div></div>';
      }).join('')+'</div>';
    }else topChannels.innerHTML='<div class="empty"><p>No channel data</p></div>';

    if(totalEl)totalEl.textContent=d.totalTracked.toLocaleString();
    updateRefreshTimestamp('insights');
  }catch(e){
    topUsers.innerHTML='<div class="empty"><p>Failed to load insights</p><p class="empty-act">'+e.message+'</p></div>';
    topChannels.innerHTML='';
  }
}

// ═══ INVITES ═══
async function loadInvites(){
  const sel=document.getElementById('invSrvSelect');
  if(!sel)return;
  // Populate server select if empty
  if(sel.options.length<=1&&allServers.length){
    sel.innerHTML='<option value="">Select a server...</option>'+allServers.map(function(s){return '<option value="'+s.id+'"'+(curSrv===s.id?' selected':'')+'>'+esc(s.name)+'</option>';}).join('');
  }

  const serverId=sel.value;
  const list=document.getElementById('invList');
  if(!list)return;

  if(!serverId){
    list.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg><p>Select a server to view invite leaderboard</p><p class="empty-act">Invite tracking must be enabled for the server.</p></div>';
    updateRefreshTimestamp('invites');
    return;
  }

  list.innerHTML='<div class="loading" style="padding:24px;"><div class="spin"></div></div>';

  try{
    const r=await fetch('/api/server/'+serverId+'/invites');
    const d=await r.json();
    if(!Array.isArray(d))throw new Error('Invalid response');

    if(d.length){
      const maxCount=Math.max.apply(null,d.map(function(i){return i.count}));
      list.innerHTML='<div style="padding:8px 12px 12px;">'+d.map(function(inv,i){
        const medals=['\uD83E\uDD47','\uD83E\uDD48','\uD83E\uDD49','','','','','','',''];
        const pct=Math.max(4,(inv.count/maxCount)*100);
        return '<div class="mod-item" style="flex-direction:column;align-items:stretch;"><div style="display:flex;align-items:center;gap:10px;">'+
          '<span style="font-size:14px;width:24px;text-align:center;">'+(medals[i]||(i+1))+'</span>'+
          '<div class="mod-body"><div class="mod-top"><span class="mod-type">'+(inv.tag||inv.inviterId||'Unknown').slice(0,30)+'</span></div></div>'+
          '<div class="mod-count" style="color:#f59e0b;">'+inv.count+' joins</div></div>'+
          '<div style="display:flex;align-items:center;gap:6px;padding-left:34px;"><div style="flex:1;height:4px;background:rgba(255,255,255,0.04);border-radius:2px;overflow:hidden;"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#f59e0b,#ffd700);border-radius:2px;transition:width 0.6s ease;"></div></div></div></div>';
      }).join('')+'</div>';
    }else list.innerHTML='<div class="empty"><p>No invite data yet</p><p class="empty-act">Invite tracking must be enabled. Use <code>track add</code> in a channel to start tracking.</p></div>';

    updateRefreshTimestamp('invites');
  }catch(e){
    list.innerHTML='<div class="empty"><p>Failed to load invites</p><p class="empty-act">'+e.message+'</p></div>';
  }
}

// ── Compact Mode Toggle (settings) ──
function toggleCompact(){
  var t=document.getElementById('compactToggle');
  if(!t)return;
  var on=!t.classList.contains('on');
  t.classList.toggle('on',on);
  document.documentElement.style.setProperty('--layout-dense',on?'0.7':'1');
  try{localStorage.setItem('layoutDensity',on?'compact':'normal')}catch(e){}
}
function applyCompactPref(){
  var pref='normal';
  try{pref=localStorage.getItem('layoutDensity')||'normal'}catch(e){}
  var t=document.getElementById('compactToggle');
  if(t)t.classList.toggle('on',pref==='compact');
  document.documentElement.style.setProperty('--layout-dense',pref==='compact'?'0.7':'1');
}

