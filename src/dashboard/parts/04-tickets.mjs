import { allServers, curSrv, esc, fnData, showToast, srObs, tkTimeAgo, updateRefreshTimestamp } from './01-foundation.mjs';
// ═══ TICKETS ═══
// Drag-drop state

export async function loadTickets(){
  const sel=document.getElementById('tkSrvSelect');
  if(!sel)return;
  if(sel.options.length<=1&&allServers.length){
    sel.innerHTML='<option value="">Select a server...</option>'+allServers.map(function(s){return '<option value="'+s.id+'"'+(curSrv===s.id?' selected':'')+'>'+esc(s.name)+'</option>';}).join('');
  }
  const serverId=sel.value;
  const el=document.getElementById('ticketsContent');
  if(!el)return;
  // Capture the currently selected panel BEFORE the loading spinner replaces the
  // DOM — otherwise the re-render wipes #tkSelPanel and the selection is lost,
  // making it impossible to switch panels.
  var prevPanelSel=document.getElementById('tkSelPanel') ? document.getElementById('tkSelPanel').value : '';
  var prevTypeSel=document.getElementById('tkTypeSel') ? document.getElementById('tkTypeSel').value : '';
  if(!serverId){el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:32px;height:32px;"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M7 7h10v10H7z"/><path d="M3 10h18M3 14h18"/></svg><p>Select a server to manage tickets</p><p class="empty-act">Create ticket panels, configure ticket types, and view recent tickets.</p></div>';updateRefreshTimestamp('tickets');return;}
  el.innerHTML='<div class="loading" style="padding:24px;"><div class="spin"></div></div>';
  try{
    const r=await fetch('/api/server/'+serverId+'/tickets');
    if(!r.ok)throw new Error('Failed to fetch');
    const d=await r.json();
    if(!d||!d.config)throw new Error('Invalid data');

    // Build channels lookup
    var channelsById={};(d.channels||[]).forEach(function(c){channelsById[c.id]=c});
    var rolesById={};(d.roles||[]).forEach(function(r2){rolesById[r2.id]=r2});

    // ── General Ticket Options ──
    var logChOpts=((d.channels||[]).filter(function(c){return c.type===0||c.type===5}).map(function(c){return '<option value="'+c.id+'"'+(c.id===d.config.logChannelId?' selected':'')+'>#'+esc(c.name)+'</option>'}).join(''));
    var cfgHtml='<div class="tk-glass">'+
      '<div class="tk-glass-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><path d="M9 21V9"/></svg>General Ticket Options</div>'+
      '<div class="tk-glass-b">'+
        '<div class="tk-opt-row"><div><div class="tk-opt-t">Ticket System</div><div class="tk-opt-d">Enable or disable tickets on this server</div></div>'+
          '<div class="tg-wr" data-fn="ticketToggle" data-args=\'['+fnData(serverId)+','+fnData((!d.config.enabled))+']\'><div class="tg '+(d.config.enabled?'on':'')+'"></div><div class="tg-lbl">'+(d.config.enabled?'Enabled':'Disabled')+'</div></div></div>'+
        '<div class="stg" style="margin-bottom:10px;"><label>Transcript Log Channel</label><select id="tkLogCh" class="tk-select" data-fn="ticketSetLog" data-args=\'['+fnData(serverId)+']\'><option value="">None</option>'+logChOpts+'</select></div>'+
        '<div class="tk-stat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><div><div class="tk-stat-v">'+d.config.ticketCount+'</div><div class="tk-stat-l">tickets created</div></div></div>'+
      '</div></div>';

    // Selected panel (persisted across reloads via the dropdown)
    var panels=d.panels||[];
    var tkSelectedPanel=prevPanelSel;
    var selPanel=null;
    for(var pi=0;pi<panels.length;pi++){if(panels[pi].id===tkSelectedPanel){selPanel=panels[pi];break}}
    if(!selPanel&&panels.length>0)selPanel=panels[0];
    var noPanel=!selPanel;
    var panelId=selPanel?selPanel.id:'';

    // Resolve the selected ticket type (persisted across re-renders via the dropdown)
    var pTypes=selPanel?selPanel.types||[]:[];
    var selType=null;
    for(var ti2=0;ti2<pTypes.length;ti2++){if(pTypes[ti2].id===prevTypeSel){selType=pTypes[ti2];break}}
    if(!selType&&pTypes.length>0)selType=pTypes[0];

    // ── Advanced Settings ──
    var advHtml='<div class="tk-glass">'+
      '<div class="tk-glass-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>Advanced Settings</div>'+
      '<div class="tk-glass-b">'+
        '<div class="tk-opt-row"><div><div class="tk-opt-t">Auto-Close on Leave</div><div class="tk-opt-d">Close tickets when the creator leaves the server</div></div>'+
          '<div class="tg-wr" data-fn="ticketToggleLeave" data-args=\'['+fnData(serverId)+','+fnData((!d.config.closeOnLeave))+']\'><div class="tg '+(d.config.closeOnLeave?'on':'')+'"></div><div class="tg-lbl">'+(d.config.closeOnLeave?'On':'Off')+'</div></div></div>'+
        '<div class="tk-pill-group">'+
          tkPill('Add Ticket Type','Create a new type on the selected panel',noPanel?'showToast':'addTicketType',noPanel?'["Select a panel first",true]':'["'+serverId+'","'+panelId+'"]')+
          tkPill('Transcript & Logging','Where transcripts are posted','tkCardClick','["transcript","'+serverId+'","'+panelId+'"]')+
          tkPill('Claim System','How staff claim tickets','tkCardClick','["claiming","'+serverId+'","'+panelId+'"]')+
        '</div>'+
      '</div></div>';

    // ── Panel Settings ──
    var panelSelOpts=panels.map(function(p,i){return '<option value="'+p.id+'"'+(selPanel&&p.id===selPanel.id?' selected':'')+'>'+(i+1)+' | '+esc(p.name)+'</option>'}).join('');
    var panelsHtml='<div class="tk-glass">'+
      '<div class="tk-glass-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>Panel Settings <span class="tk-h-count">'+panels.length+'</span></div>'+
      '<div class="tk-glass-b">'+
        '<div class="tk-sel-row">'+
          '<select id="tkSelPanel" class="tk-select" data-fn="loadTickets"><option value="">Select a panel...</option>'+panelSelOpts+'</select>'+
          '<button class="btn" data-fn="createTicketPanel" data-args=\'['+fnData(serverId)+']\' style="padding:9px 14px;font-size:12px;flex-shrink:0;" title="Create new panel">+</button></div>';
    
    if(!selPanel){
      panelsHtml+='<div class="tk-empty"><p>No panel selected.</p><p class="empty-act">Select a panel above, or click + to create a new one.</p></div>';
    }else{
      // Action row — Clone, Rename, Send, Set Count, Update, Delete
      panelsHtml+='<div class="tk-act-row">'+
        '<button type="button" class="tk-act-btn tk-act-blue" data-fn="previewTicketPanel" data-args=\'['+fnData(serverId)+','+fnData(selPanel.id)+']\'>\uD83D\uDC40 Preview</button>'+
        '<button type="button" class="tk-act-btn tk-act-green" data-fn="previewTicketPanel" data-args=\'['+fnData(serverId)+','+fnData(selPanel.id)+']\'>\uD83D\uDCE8 Send</button>'+
        '<button type="button" class="tk-act-btn tk-act-blue" data-fn="tkClonePanel" data-args=\'['+fnData(serverId)+','+fnData(selPanel.id)+']\'>\uD83D\uDD04 Clone</button>'+
        '<button type="button" class="tk-act-btn tk-act-blue" data-fn="tkRenamePanel" data-args=\'['+fnData(serverId)+','+fnData(selPanel.id)+']\'>\u270F\uFE0F Rename</button>'+
        '<button type="button" class="tk-act-btn tk-act-blue" data-fn="tkSetCount" data-args=\'['+fnData(serverId)+','+fnData(selPanel.id)+']\'>\uD83D\uDD22 Set Count</button>'+
        '<button type="button" class="tk-act-btn tk-act-blue" data-fn="tkEditPanel" data-args=\'['+fnData(serverId)+','+fnData(selPanel.id)+']\'>\u2B06\uFE0F Update</button>'+
        '<button type="button" class="tk-act-btn tk-act-red" data-fn="tkDeletePanel" data-args=\'['+fnData(serverId)+','+fnData(selPanel.id)+']\'>\u2716 Delete</button></div>';

      // Ticket Type dropdown — Ticket Tool style: the panel is the "main ticket" and
      // each type is a sub-ticket (e.g. Support / Application / Reporting). Pick the
      // type you want to configure from the dropdown below.
      panelsHtml+='<div class="tk-type-sel-row">'+
        '<span class="tk-type-sel-label">Ticket Type</span>'+
        '<select id="tkTypeSel" class="tk-select" data-fn="loadTickets">'+
          (pTypes.length?pTypes.map(function(t){return '<option value="'+t.id+'"'+(selType&&t.id===selType.id?' selected':'')+'>'+esc(t.emoji||'\uD83C\uDFAB')+' '+esc(t.name)+'</option>'}).join(''):'<option value="">No types yet</option>')+
        '</select>'+
        '<button class="btn" data-fn="addTicketType" data-args=\'['+fnData(serverId)+','+fnData(selPanel.id)+']\' style="padding:9px 12px;font-size:11px;flex-shrink:0;" title="Add a new ticket type">+</button></div>';
      if(selType){
        var tQCount=parseTkArray(selType.questions).length;
        var tRoleCount=parseTkArray(selType.support_roles).length;
        var tCat='None';
        if(selType.category_id&&channelsById[selType.category_id])tCat=channelsById[selType.category_id].name;
        panelsHtml+='<div class="tk-type-sum">'+
          '<div class="tk-type-sum-head"><span class="tk-type-sum-emoji">'+esc(selType.emoji||'\uD83C\uDFAB')+'</span><span class="tk-type-sum-name">'+esc(selType.name||'Unnamed type')+'</span></div>'+
          '<div class="tk-type-sum-grid">'+
            '<div class="tk-type-sum-item"><span>Category</span><b>'+esc(tCat)+'</b></div>'+
            '<div class="tk-type-sum-item"><span>Questions</span><b>'+tQCount+'</b></div>'+
            '<div class="tk-type-sum-item"><span>Support roles</span><b>'+(tRoleCount?tRoleCount:'None')+'</b></div>'+
            '<div class="tk-type-sum-item"><span>Name format</span><b>'+esc(selType.ticket_name_format||'ticket-{username}-{number}')+'</b></div>'+
          '</div>'+
          '<div class="tk-type-sum-actions">'+
            '<button type="button" class="tk-act-btn tk-act-blue" data-fn="editTicketTypeSettings" data-args=\'['+fnData(serverId)+','+fnData(selPanel.id)+','+fnData(selType.id)+']\'>\u2699\uFE0F Edit</button>'+
            '<button type="button" class="tk-act-btn tk-act-blue" data-fn="editQuestions" data-args=\'['+fnData(serverId)+','+fnData(selPanel.id)+','+fnData(selType.id)+']\'>\uD83D\uDCDD Questions</button>'+
            '<button type="button" class="tk-act-btn tk-act-red" data-fn="deleteTicketType" data-args=\'['+fnData(serverId)+','+fnData(selPanel.id)+','+fnData(selType.id)+']\'>\uD83D\uDDD1\uFE0F Delete</button>'+
          '</div></div>';
      }

      // Pill navigation
      panelsHtml+='<div class="tk-pill-group">'+
        tkPill('Ticket Types',(pTypes.length?pTypes.length+' type'+(pTypes.length>1?'s':''):'No types yet'),'tkCardClick','["types","'+serverId+'","'+selPanel.id+'"]')+
        tkPill('Custom Questions','Up to 5 per type','tkCardClick','["forms","'+serverId+'","'+selPanel.id+'"]')+
        tkPill('Panel Message','Embed title & description','tkEditMessage','["'+serverId+'","panel"]')+
        tkPill('Ticket Message','Welcome message for new tickets','tkEditMessage','["'+serverId+'","ticket"]')+
      '</div>';

      // Frequently Used Configs
      panelsHtml+='<div id="tk-freq-wr" class="tk-freq-wr">'+
        '<div class="tk-freq-h" data-fn="tkToggleFreq"><span id="tk-freq-caret" class="tk-freq-caret">\u25BC</span>Frequently Used Configs</div>'+
        '<div id="tk-freq-body" class="tk-freq-grid">'+
          // Left: Support Team Roles + Panel Message
          '<div><div class="stg" style="margin-bottom:10px;"><label>Support Team Roles <span title="Roles that can view and manage tickets" style="cursor:help;color:var(--text-dim);font-size:11px;">\u24D8</span></label>'+
            '<div id="tk-freq-roles" class="tk-role-chips"></div><div class="tk-hint">Click roles to toggle them on/off</div></div>'+
            '<button class="btn btn-s" data-fn="tkEditMessage" data-args=\'['+fnData(serverId)+',\"panel\"]\' style="padding:6px 12px;font-size:10px;">\uD83D\uDCAC Edit Panel Message</button></div>'+
          // Right: Category + Ticket Message
          '<div><div class="stg" style="margin-bottom:10px;"><label>Category Created/Opened <span title="Categories where tickets can be created" style="cursor:help;color:var(--text-dim);font-size:11px;">\u24D8</span></label>'+
            '<select id="tk-freq-cats" class="tk-select" data-fn="tkMarkUnsaved"></select><div class="tk-hint">Category for the selected type (per-type settings override)</div></div>'+
            '<button class="btn btn-s" data-fn="tkEditMessage" data-args=\'['+fnData(serverId)+',\"ticket\"]\' style="padding:6px 12px;font-size:10px;">\uD83D\uDCAC Edit Ticket Message</button></div>'+
        '</div></div>';

      // Populate roles + category pickers after rendering
      var allRoles=[];
      for(var rk in rolesById)allRoles.push(rolesById[rk]);
      var curRoleIds=parseTkArray(selType?selType.support_roles:null);
      var roleChipsHtml='';
      for(var ri=0;ri<allRoles.length;ri++){
        var roleData=allRoles[ri];
        roleChipsHtml+='<button type="button" class="tk-role-chip'+(curRoleIds.indexOf(roleData.id)>-1?' on':'')+'" data-role-id="'+roleData.id+'" data-fn="tkToggleRoleChip" data-args=\'[\"@el\"]\'>'+esc(roleData.name)+'</button>';
      }
      var curCatId=selType?selType.category_id||'':'';
      // Include an explicit "None" option so the select reflects the type's actual
      // category — otherwise the browser would default to the first category and
      // saving quick-config would silently assign it to the type.
      var catOpts='<option value=""'+(curCatId===''?' selected':'')+'>None</option>';
      (d.channels||[]).forEach(function(c){if(c.type===4)catOpts+='<option value="'+c.id+'"'+(c.id===curCatId?' selected':'')+'>'+esc(c.name)+'</option>'});
      setTimeout(function(){
        var sel=document.getElementById('tk-freq-roles');if(sel)sel.innerHTML=roleChipsHtml||'<span class="tk-chip-none">No roles available</span>';
        var selC=document.getElementById('tk-freq-cats');if(selC)selC.innerHTML=catOpts||'<option value="">No categories</option>';
      },50);
    }
    panelsHtml+='</div></div>';

    // ── Recent Tickets (filter tabs + status pills + relative time) ──
    tkRecData=d.tickets||[];
    var recTabs=[['','All'],['open','Open'],['claimed','Claimed'],['closed','Closed']].map(function(f){
      return '<button class="tk-rec-tab'+(tkRecFilter===f[0]?' on':'')+'" data-fn="tkRecFilterSet" data-args=\'['+fnData(f[0])+']\'>'+f[1]+'</button>';
    }).join('');
    var recentHtml='<div class="tk-glass"><div class="tk-glass-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Recent Tickets <span class="tk-h-count">'+tkRecData.length+'</span></div>'+
      '<div class="tk-rec-tabs">'+recTabs+'</div><div style="padding:8px 12px 12px;" id="tk-rec-body"></div></div>';

    // ── Build layout ──
    var grid='<div class="tk-main-grid"><div>'+cfgHtml+advHtml+'</div><div>'+panelsHtml+'</div></div>';
    el.innerHTML=grid+'<div style="margin-top:16px;">'+recentHtml+'</div>'+
      '<!-- Floating unsaved-changes bar --><div id="tk-unsaved-bar" class="tk-unsaved-bar">'+
        '<span class="tk-unsaved-ic">\u26A0\uFE0F</span><span class="tk-unsaved-tx">You have unsaved changes!</span>'+
        '<div style="display:flex;gap:6px;">'+
          '<button class="btn btn-s" data-fn="tkResetChanges" style="padding:6px 14px;font-size:11px;">Reset</button>'+
          '<button class="btn" data-fn="tkSaveChanges" style="padding:6px 14px;font-size:11px;">Save</button></div></div>';
    tkRecRender();
    updateRefreshTimestamp('tickets');
    setTimeout(function(){document.querySelectorAll('#sec-tickets .sr').forEach(function(el2){srObs.observe(el2)})},50);
  }catch(e){
    el.innerHTML='<div class="empty"><p>Failed to load ticket data.</p><p class="empty-act">'+esc(e.message)+'</p></div>';
    updateRefreshTimestamp('tickets');
  }
}

// ── Inline Question Editor ──
export function editQuestions(serverId,panelId,typeId){
  var overlay=document.createElement('div');
  overlay.className='tk-overlay';
  overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;';
  overlay.onclick=function(e){if(e.target===overlay)close()}
  
  function close(){document.body.removeChild(overlay)}
  
  var questions=[];
  // Fetch type data to get current questions
  fetch('/api/server/'+serverId+'/tickets').then(function(r){return r.json()}).then(function(d2){
    for(var pi=0;pi<(d2.panels||[]).length;pi++){
      if(d2.panels[pi].id===panelId){
        for(var ti=0;ti<(d2.panels[pi].types||[]).length;ti++){
          if(d2.panels[pi].types[ti].id===typeId){
            try{questions=parseTkArray(d2.panels[pi].types[ti].questions)}catch{}
            break;
          }
        }
        break;
      }
    }
    var name='';
    for(var pi=0;pi<(d2.panels||[]).length;pi++){
      if(d2.panels[pi].id===panelId){
        for(var ti=0;ti<(d2.panels[pi].types||[]).length;ti++){
          if(d2.panels[pi].types[ti].id===typeId){name=d2.panels[pi].types[ti].name;break}
        }
        break;
      }
    }
    overlay.innerHTML='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:20px;width:480px;max-width:90vw;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'+
        '<h2 style="font-size:16px;font-weight:700;margin:0;">\uD83D\uDCDD Questions for '+esc(name)+'</h2>'+
        '<button class="tk-q-close-btn" style="background:none;border:none;color:var(--text-dim);font-size:20px;cursor:pointer;">\u2716</button></div>'+
      '<input type="hidden" id="tk-q-data" value=\''+JSON.stringify(questions)+'\'>'+
      '<div id="tk-q-list" style="margin-bottom:12px;"></div>'+
      '<div style="display:flex;gap:8px;">'+
        '<button id="tk-q-add" class="btn btn-s" style="flex:1;padding:8px;font-size:11px;">+ Add Question</button>'+
        '<button id="tk-q-save" class="btn" style="flex:2;padding:8px;font-size:11px;">\u2714\uFE0F Save</button></div></div>';
    overlay.querySelector('.tk-q-close-btn').onclick=function(){close()};
    overlay.querySelector('#tk-q-add').onclick=function(){
      var cur=JSON.parse(document.getElementById('tk-q-data').value||'[]');
      if(cur.length>=5){showToast('Maximum 5 questions per type',true);return}
      cur.push({label:'',placeholder:'',required:true});
      renderQuestions(cur);
    };
    overlay.querySelector('#tk-q-save').onclick=function(){
      var rows=overlay.querySelectorAll('#tk-q-list > div[data-idx]');
      var qs=[];
      rows.forEach(function(row){
        var label=row.querySelector('.tk-q-label').value.trim();
        if(!label)return;
        qs.push({label:label,placeholder:row.querySelector('.tk-q-placeholder').value.trim(),required:row.querySelector('.tk-q-req').checked});
      });
      if(!qs.length){showToast('Add at least one question with a label',true);return}
      if(qs.length<rows.length){showToast((rows.length-qs.length)+' empty question(s) skipped',true)}
      var btn=overlay.querySelector('#tk-q-save');btn.disabled=true;btn.textContent='Saving...';
      fetch('/api/server/'+serverId+'/tickets/panels/'+panelId+'/types/'+typeId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({questions:qs})})
      .then(function(r){return r.json()}).then(function(d){
        if(d.success){showToast('Questions saved!');close();loadTickets()}
        else showToast('Failed: '+(d.error||'unknown'),true);
        btn.disabled=false;btn.textContent='\u2714\uFE0F Save';
      }).catch(function(e){showToast('Failed: '+e.message,true);btn.disabled=false;btn.textContent='\u2714\uFE0F Save'});
    };
    renderQuestions(questions);
  }).catch(function(){showToast('Failed to load type data',true);close()});
  
  document.body.appendChild(overlay);
}
// Called by inline editor to re-render the question list
// ── Dispatcher targets for former inline handlers ──
// Remove question row at index i in the custom-questions editor.
export function tkRemoveQuestion(i){
  var qs2=JSON.parse(document.getElementById('tk-q-data').value||'[]');
  qs2.splice(Number(i),1);
  renderQuestions(qs2);
}

function renderQuestions(qs){document.getElementById('tk-q-data').value=JSON.stringify(qs);var list=document.getElementById('tk-q-list');if(!list)return;var qHtml=qs.map(function(q,i){
  return '<div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px;background:rgba(255,255,255,0.05);" data-idx="'+i+'">'+
    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">'+
      '<span style="font-size:10px;color:var(--text-dim);width:20px;">'+(i+1)+'.</span>'+
      '<input class="tk-q-label" value="'+esc(q.label||q.question||'')+'" placeholder="Question label..." style="flex:1;padding:5px 8px;font-size:12px;background:rgba(255,255,255,0.07);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;">'+
      '<button class="btn btn-s" data-fn="tkRemoveQuestion" data-args=\'['+fnData(i)+']\' style="padding:3px 7px;font-size:9px;color:#ed4245;">\u2716</button></div>'+
    '<div style="display:flex;gap:8px;align-items:center;">'+
      '<input class="tk-q-placeholder" value="'+esc(q.placeholder||'')+'" placeholder="Placeholder text" style="flex:1;padding:4px 8px;font-size:10px;background:rgba(255,255,255,0.06);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;">'+
      '<label style="font-size:10px;display:flex;align-items:center;gap:4px;white-space:nowrap;"><input type="checkbox" class="tk-q-req" '+(q.required!==false?'checked':'')+'> Required</label></div></div>';
}).join('')||'<div style="text-align:center;padding:16px;color:var(--text-dim);font-size:12px;">No questions yet. Add one below.</div>';
list.innerHTML=qHtml;
}

// ── Panel Preview Modal ──
// ── Live preview simulation state (declared before first use) ──
var tkPrevState={types:[],srvName:'',srvIcon:'',color:'#5865F2'};

export function previewTicketPanel(serverId,panelId){
  fetch('/api/server/'+serverId+'/tickets').then(function(r){return r.json()}).then(function(d2){
    var panel=null;
    for(var pi=0;pi<(d2.panels||[]).length;pi++){if(d2.panels[pi].id===panelId){panel=d2.panels[pi];break}}
    if(!panel){showToast('Panel not found',true);return}
    var types=panel.types||[];
    var channels=(d2.channels||[]).filter(function(c){return c.type===0||c.type===5});
    var srvName='',srvIcon='';
    for(var si=0;si<allServers.length;si++){if(allServers[si].id===serverId){srvName=allServers[si].name||'';srvIcon=allServers[si].icon||'';break}}
    var color=panel.color||'#5865F2';
    var desc=panel.description||'Click the button below to create a ticket.';

    // Shared state for the live simulation helpers
    tkPrevState={types:types,srvName:srvName||panel.name||'Support Server',srvIcon:srvIcon,color:color};

    var timeStr='Today at '+new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    var avatarHtml=srvIcon?'<img src="'+esc(srvIcon)+'" alt="">':'<span>🎫</span>';

    // ── Discord message frame + faithful embed ──
    var embedHtml='<div class="tk-prev-embed">'+
        '<div class="tk-prev-embed-bar" style="background:'+esc(color)+'"></div>'+
        '<div class="tk-prev-embed-body">'+
          '<div class="tk-prev-embed-author">'+(srvIcon?'<img src="'+esc(srvIcon)+'" alt="">':'')+'<span>'+esc(srvName||panel.name)+'</span></div>'+
          '<div class="tk-prev-embed-title">🎫 '+esc(panel.name||'Support Tickets')+'</div>'+
          (desc?'<div class="tk-prev-embed-desc">'+esc(desc)+'</div>':'')+
          (panel.image_url?'<img class="tk-prev-embed-img" src="'+esc(panel.image_url)+'" alt="">':'')+
          '<div class="tk-prev-embed-foot">'+timeStr+'</div>'+
        '</div></div>';

    // ── Live components: dropdown (multi-type) + Create button ──
    var compsHtml='';
    if(types.length>1){
      // Multiple types — the dropdown is the create action, so no button
      compsHtml+='<div class="tk-prev-comp">'+
        '<div class="tk-prev-select-wrap">'+
          '<select id="tk-prev-type" class="tk-prev-select" data-fn="tkPrevPick" data-args=\'[\"@value\"]\'>'+
            '<option value="">Choose a ticket type...</option>'+
            types.map(function(t){return '<option value="'+esc(t.id)+'">'+esc(t.emoji||'🎫')+' '+esc(t.name)+'</option>'}).join('')+
          '</select><span class="tk-prev-select-arrow">▾</span>'+
        '</div></div>';
    }else{
      // Single type (or none) — Create button only
      compsHtml+='<div class="tk-prev-comp"><button type="button" class="tk-prev-btn tk-prev-btn-create" data-fn="tkPrevCreate">🎫 Create Ticket</button></div>';
    }

    var overlay=document.createElement('div');
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;';
    overlay.onclick=function(e){if(e.target===overlay)document.body.removeChild(overlay)}

    overlay.innerHTML='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:20px;width:560px;max-width:94vw;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'+
        '<h2 style="font-size:16px;font-weight:700;margin:0;">👁 Live Preview: '+esc(panel.name||'Unnamed')+'</h2>'+
        '<button class="tk-preview-close" style="background:none;border:none;color:var(--text-dim);font-size:20px;cursor:pointer;">✖</button></div>'+
      '<div class="tk-prev-stage">'+
        '<div class="tk-prev-msg">'+
          '<div class="tk-prev-avatar-wrap">'+avatarHtml+'</div>'+
          '<div class="tk-prev-msg-body">'+
            '<div class="tk-prev-msg-top"><span class="tk-prev-username">Ticket Bot</span><span class="tk-prev-bot">BOT</span><span class="tk-prev-time">'+timeStr+'</span></div>'+
            embedHtml+
            '<div class="tk-prev-comps">'+compsHtml+'</div>'+
          '</div>'+
        '</div>'+
        '<div class="tk-prev-sim" id="tk-prev-sim">'+
          '<div class="tk-prev-sim-hint">🖱 '+(types.length>1?'Pick a type in the dropdown above to simulate the Discord flow.':'Click <b>Create Ticket</b> to simulate the Discord flow.')+'</div>'+
          '<div id="tk-prev-flow"></div>'+
        '</div>'+
      '</div>'+
      // Send controls
      '<div style="border-top:1px solid var(--border);padding-top:14px;">'+
        '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Send to channel:</label>'+
        '<div style="display:flex;gap:8px;">'+
          '<select id="tk-preview-ch" style="flex:1;padding:8px;font-size:11px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;">'+
            '<option value="">Select a channel...</option>'+
            channels.map(function(ch){return '<option value="'+esc(ch.id)+'">#'+esc(ch.name)+'</option>'}).join('')+
          '</select>'+
          '<button class="btn tk-preview-send-btn" style="padding:8px 16px;font-size:11px;">📤 Send</button></div></div></div>';
    overlay.querySelector('.tk-preview-close').onclick=function(){document.body.removeChild(overlay)};
    overlay.querySelector('.tk-preview-send-btn').onclick=function(){
      var chId=document.getElementById('tk-preview-ch').value;
      if(!chId){showToast('Select a channel first',true);return}
      var btn=this;btn.disabled=true;btn.textContent='Sending...';
      fetch('/api/server/'+serverId+'/tickets/panels/'+panelId+'/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channelId:chId})})
      .then(function(r){return r.json()}).then(function(d3){
        if(d3.success){showToast('Panel sent!');document.body.removeChild(overlay);loadTickets()}
        else showToast('Failed: '+d3.error,true);
        btn.disabled=false;btn.textContent='📤 Send';
      }).catch(function(e){showToast('Failed: '+e.message,true);btn.disabled=false;btn.textContent='📤 Send'});
    };
    document.body.appendChild(overlay);
  }).catch(function(e){showToast('Failed to preview: '+e.message,true)});
}

// ── Live preview simulation helpers ──
function tkPrevTimeStr(){return 'Today at '+new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}

function tkPrevFindType(id){for(var i=0;i<tkPrevState.types.length;i++){if(tkPrevState.types[i].id===id)return tkPrevState.types[i]}return null}

function tkPrevSimCard(innerHtml){
  return '<div class="tk-prev-msg tk-prev-sim-card">'+
    '<div class="tk-prev-avatar-wrap">'+(tkPrevState.srvIcon?'<img src="'+esc(tkPrevState.srvIcon)+'" alt="">':'<span>🎫</span>')+'</div>'+
    '<div class="tk-prev-msg-body">'+
      '<div class="tk-prev-msg-top"><span class="tk-prev-username">Ticket Bot</span><span class="tk-prev-bot">BOT</span><span class="tk-prev-only-you">ONLY YOU CAN SEE THIS</span><span class="tk-prev-time">'+tkPrevTimeStr()+'</span></div>'+
      innerHtml+
    '</div></div>';
}

function tkPrevEmbedHtml(o){
  return '<div class="tk-prev-embed"><div class="tk-prev-embed-bar" style="background:'+(o.color||tkPrevState.color)+'"></div><div class="tk-prev-embed-body">'+
    (o.author?'<div class="tk-prev-embed-author"><span>'+esc(o.author)+'</span></div>':'')+
    (o.title?'<div class="tk-prev-embed-title">'+esc(o.title)+'</div>':'')+
    (o.desc?'<div class="tk-prev-embed-desc">'+esc(o.desc)+'</div>':'')+
    (o.fields||[]).map(function(f){return '<div class="tk-prev-embed-field"><b>'+esc(f.n)+'</b><span>'+esc(f.v)+'</span></div>'}).join('')+
    '<div class="tk-prev-embed-foot">'+tkPrevTimeStr()+'</div>'+
  '</div></div>';
}

export function tkPrevPick(typeId){
  var type=tkPrevFindType(typeId);
  if(!type)return;
  var flow=document.getElementById('tk-prev-flow');
  if(!flow)return;
  var questions=parseTkArray(type.questions);
  var html='';
  // Step 1 — questions modal (if any)
  if(questions.length){
    html+=tkPrevSimCard('<div class="tk-prev-modal"><div class="tk-prev-modal-title">'+esc(type.emoji||'🎫')+' '+esc(type.name)+'</div>'+
      questions.slice(0,5).map(function(q,i){return '<div class="tk-prev-modal-q"><label>'+esc(q.label||q.question||('Question '+(i+1)))+(q.required!==false?' *':'')+'</label><input type="text" placeholder="'+esc(q.placeholder||'')+'" disabled></div>'}).join('')+
      '<div class="tk-prev-modal-actions"><button type="button" class="tk-prev-btn tk-prev-btn-secondary" disabled>Cancel</button><button type="button" class="tk-prev-btn tk-prev-btn-create" disabled>Submit</button></div></div>');
    // Pinned answers embed (matches createTicket's answers embed)
    html+=tkPrevSimCard(tkPrevEmbedHtml({title:'📋 Ticket Form Answers',desc:'Questions and answers submitted when creating this ticket:',fields:questions.slice(0,5).map(function(q){return {n:q.label||q.question||'Question',v:'(your answer)'}})}));
  }
  // Step 2 — created confirmation + welcome embed in the ticket channel
  var chName=(type.ticket_name_format||'ticket-{username}-{number}')
    .replace('{username}','you').replace('{number}','0001').replace('{name}','you')
    .replace('{type}','ticket').replace('{category}','ticket').replace(/[^a-z0-9-]/g,'');
  html+=tkPrevSimCard(
    '<div class="tk-prev-sim-success">✅ Your <b>'+esc(type.emoji||'🎫')+' '+esc(type.name)+'</b> ticket has been created! <span class="tk-prev-ch">#'+esc(chName)+'</span></div>'+
    tkPrevEmbedHtml({author:'Ticket #0001',title:'🎫 '+type.name+' Ticket',desc:type.welcome_message||'Thank you for creating a ticket. A staff member will be with you shortly.',fields:[{n:'Created By',v:'@you'},{n:'Type',v:(type.emoji||'🎫')+' '+type.name}]})+
    '<div class="tk-prev-comps"><div class="tk-prev-comp"><button type="button" class="tk-prev-btn tk-prev-btn-claim" disabled>✋ Claim Ticket</button></div><div class="tk-prev-comp"><button type="button" class="tk-prev-btn tk-prev-btn-close" disabled>🔒 Close Ticket</button></div></div>'
  );
  flow.innerHTML=html;
}

export function tkPrevCreate(){
  var flow=document.getElementById('tk-prev-flow');
  if(!flow)return;
  var types=tkPrevState.types;
  if(!types.length){flow.innerHTML=tkPrevSimCard('<div class="tk-prev-sim-error">❌ This panel has no ticket types configured. Please contact the server staff.</div>');return}
  // Only reachable from the Create button, which renders for single-type panels
  if(types[0])tkPrevPick(types[0].id);
}

// ── Ticket Dashboard CRUD Helpers (Modal-based UX) ──
export function ticketToggle(serverId,newVal){fetch('/api/server/'+serverId+'/tickets/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:newVal})}).then(function(r){return r.json()}).then(function(d){if(d.success){showToast('Ticket system '+(newVal?'enabled':'disabled')+'!');loadTickets()}else showToast('Failed',true)}).catch(function(){showToast('Failed',true)})}
export function ticketToggleLeave(serverId,newVal){fetch('/api/server/'+serverId+'/tickets/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({closeOnLeave:newVal})}).then(function(r){return r.json()}).then(function(d){if(d.success){showToast('Auto-close '+(newVal?'enabled':'disabled')+'!');loadTickets()}else showToast('Failed',true)}).catch(function(){showToast('Failed',true)})}
export function ticketSetLog(serverId){var v=document.getElementById('tkLogCh').value;fetch('/api/server/'+serverId+'/tickets/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({logChannelId:v||null})}).then(function(r){return r.json()}).then(function(d){if(d.success){showToast('Log channel updated!')}else showToast('Failed',true)}).catch(function(){showToast('Failed',true)})}

// ── Modern Modal: Create Panel ──
export function createTicketPanel(serverId){
  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;';
  overlay.onclick=function(e){if(e.target===overlay)document.body.removeChild(overlay)};
  overlay.innerHTML='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;width:440px;max-width:92vw;box-shadow:0 20px 60px rgba(0,0,0,0.4);">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">'+
      '<h2 style="font-size:18px;font-weight:700;margin:0;">✨ Create Ticket Panel</h2>'+
      '<button class="tk-modal-close" style="background:none;border:none;color:var(--text-dim);font-size:22px;cursor:pointer;">\u2716</button></div>'+
    '<div class="stg" style="margin-bottom:12px;"><label>Panel Name</label><input id="tk-pnl-name" placeholder="e.g. Support, Applications" style="width:100%;padding:8px 10px;font-size:13px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;"></div>'+
    '<div class="stg" style="margin-bottom:12px;"><label>Description</label><textarea id="tk-pnl-desc" placeholder="Click the button below to create a ticket..." rows="3" style="width:100%;padding:8px 10px;font-size:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;resize:vertical;"></textarea></div>'+
    '<div class="stg" style="margin-bottom:16px;"><label>Accent Color</label><div style="display:flex;gap:8px;align-items:center;"><input id="tk-pnl-color" type="color" value="#5865F2" style="width:40px;height:36px;border-radius:6px;border:1px solid var(--border);background:none;cursor:pointer;"><span id="tk-pnl-color-val" style="font-size:11px;color:var(--text-dim);font-family:monospace;">#5865F2</span></div></div>'+
    '<div style="display:flex;gap:8px;"><button class="tk-modal-close btn btn-s" style="flex:1;padding:10px;font-size:13px;">Cancel</button><button id="tk-pnl-save" class="btn" style="flex:2;padding:10px;font-size:13px;">Create Panel</button></div></div>';
  document.body.appendChild(overlay);
  overlay.querySelector('.tk-modal-close').onclick=function(){document.body.removeChild(overlay)};
  overlay.querySelector('#tk-pnl-color').oninput=function(){document.getElementById('tk-pnl-color-val').textContent=this.value};
  overlay.querySelector('#tk-pnl-save').onclick=function(){
    var name=document.getElementById('tk-pnl-name').value.trim();
    if(!name){showToast('Enter a panel name',true);return}
    var desc=document.getElementById('tk-pnl-desc').value.trim();
    var color=document.getElementById('tk-pnl-color').value;
    var btn=this;btn.disabled=true;btn.textContent='Creating...';
    fetch('/api/server/'+serverId+'/tickets/panels',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,description:desc,color:color})})
    .then(function(r){return r.json()}).then(function(d){if(d.success){showToast('Panel created!');document.body.removeChild(overlay);loadTickets()}else showToast('Failed: '+(d.error||'unknown'),true);btn.disabled=false;btn.textContent='Create Panel'}).catch(function(e){showToast('Failed: '+e.message,true);btn.disabled=false;btn.textContent='Create Panel'});
  };
}

// ── Modern Modal: Edit Panel ──
function editTicketPanel(serverId,panelId,panelName,panelColor,panelDesc){
  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;';
  overlay.onclick=function(e){if(e.target===overlay)document.body.removeChild(overlay)};
  overlay.innerHTML='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;width:440px;max-width:92vw;box-shadow:0 20px 60px rgba(0,0,0,0.4);">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">'+
      '<h2 style="font-size:18px;font-weight:700;margin:0;">✏️ Edit Panel</h2>'+
      '<button class="tk-modal-close" style="background:none;border:none;color:var(--text-dim);font-size:22px;cursor:pointer;">\u2716</button></div>'+
    '<div class="stg" style="margin-bottom:12px;"><label>Panel Name</label><input id="tk-pnl-name" value="'+esc(panelName||'')+'" placeholder="e.g. Support" style="width:100%;padding:8px 10px;font-size:13px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;"></div>'+
    '<div class="stg" style="margin-bottom:12px;"><label>Description</label><textarea id="tk-pnl-desc" rows="3" style="width:100%;padding:8px 10px;font-size:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;resize:vertical;">'+esc(panelDesc||'')+'</textarea></div>'+
    '<div class="stg" style="margin-bottom:16px;"><label>Accent Color</label><div style="display:flex;gap:8px;align-items:center;"><input id="tk-pnl-color" type="color" value="'+(panelColor||'#5865F2')+'" style="width:40px;height:36px;border-radius:6px;border:1px solid var(--border);background:none;cursor:pointer;"><span id="tk-pnl-color-val" style="font-size:11px;color:var(--text-dim);font-family:monospace;">'+(panelColor||'#5865F2')+'</span></div></div>'+
    '<div style="display:flex;gap:8px;"><button class="tk-modal-close btn btn-s" style="flex:1;padding:10px;font-size:13px;">Cancel</button><button id="tk-pnl-save" class="btn" style="flex:2;padding:10px;font-size:13px;">Save Changes</button></div></div>';
  document.body.appendChild(overlay);
  overlay.querySelector('.tk-modal-close').onclick=function(){document.body.removeChild(overlay)};
  overlay.querySelector('#tk-pnl-color').oninput=function(){document.getElementById('tk-pnl-color-val').textContent=this.value};
  overlay.querySelector('#tk-pnl-save').onclick=function(){
    var name=document.getElementById('tk-pnl-name').value.trim();
    if(!name){showToast('Enter a panel name',true);return}
    var desc=document.getElementById('tk-pnl-desc').value.trim();
    var color=document.getElementById('tk-pnl-color').value;
    var btn=this;btn.disabled=true;btn.textContent='Saving...';
    fetch('/api/server/'+serverId+'/tickets/panels/'+panelId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,description:desc,color:color})})
    .then(function(r){return r.json()}).then(function(d){if(d.success){showToast('Panel updated!');document.body.removeChild(overlay);loadTickets()}else showToast('Failed: '+(d.error||'unknown'),true);btn.disabled=false;btn.textContent='Save Changes'}).catch(function(e){showToast('Failed: '+e.message,true);btn.disabled=false;btn.textContent='Save Changes'});
  };
}

// ── Modern Modal: Add Type ──
export function addTicketType(serverId,panelId){
  // Fetch server data for dropdowns
  fetch('/api/server/'+serverId+'/tickets').then(function(r){return r.json()}).then(function(d2){
    var categories=(d2.channels||[]).filter(function(c){return c.type===4}).map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+'</option>'});
    var roles=(d2.roles||[]);

    var overlay=document.createElement('div');
    overlay.className='tk-overlay';
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;';
    overlay.onclick=function(e){if(e.target===overlay)document.body.removeChild(overlay)};
    overlay.innerHTML='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;width:500px;max-width:92vw;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">'+
        '<h2 style="font-size:18px;font-weight:700;margin:0;">➕ Add Ticket Type</h2>'+
        '<button class="tk-modal-close" style="background:none;border:none;color:var(--text-dim);font-size:22px;cursor:pointer;">\u2716</button></div>'+
      '<div class="stg" style="margin-bottom:12px;"><label>Type Name</label><input id="tk-typ-name" placeholder="e.g. General Support, Appeals" style="width:100%;padding:8px 10px;font-size:13px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;"></div>'+
      '<div class="stg" style="margin-bottom:12px;"><label>Emoji</label><input id="tk-typ-emoji" value="\uD83C\uDFAB" placeholder="e.g. \uD83D\uDCE9 \u26A0\uFE0F \uD83C\uDF89" style="width:100%;padding:8px 10px;font-size:16px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;"></div>'+
      (categories.length?'<div class="stg" style="margin-bottom:12px;"><label>Category</label><select id="tk-typ-cat" style="width:100%;padding:8px 10px;font-size:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;"><option value="">None</option>'+categories.join('')+'</select></div>':'')+
      (roles.length?'<div class="stg" style="margin-bottom:12px;"><label>Support Roles (who can see tickets)</label>'+tkRoleChipsHtml(roles,[],'tk-typ-roles')+'<div style="font-size:9px;color:var(--text-dim);margin-top:4px;">Click roles to toggle them on/off</div></div>':'')+
      '<div class="stg" style="margin-bottom:12px;"><label>Welcome Message</label><textarea id="tk-typ-welcome" rows="2" placeholder="Thank you for creating a ticket..." style="width:100%;padding:8px 10px;font-size:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;resize:vertical;">Thank you for creating a ticket. A staff member will be with you shortly.</textarea></div>'+
      '<div class="stg" style="margin-bottom:16px;"><label>Channel Name Format</label><input id="tk-typ-format" value="ticket-{username}-{number}" placeholder="ticket-{username}-{number}" style="width:100%;padding:8px 10px;font-size:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;"><div style="font-size:9px;color:var(--text-dim);margin-top:4px;">Variables: {username}, {number}, {name}</div></div>'+
      '<div style="display:flex;gap:8px;"><button class="tk-modal-close btn btn-s" style="flex:1;padding:10px;font-size:13px;">Cancel</button><button id="tk-typ-save" class="btn" style="flex:2;padding:10px;font-size:13px;">Add Type</button></div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('.tk-modal-close').onclick=function(){document.body.removeChild(overlay)};
    overlay.querySelector('#tk-typ-save').onclick=function(){
      var name=document.getElementById('tk-typ-name').value.trim();
      if(!name){showToast('Enter a type name',true);return}
      var emoji=document.getElementById('tk-typ-emoji').value.trim()||'\uD83C\uDFAB';
      var catSel=document.getElementById('tk-typ-cat');
      var catId=catSel?catSel.value:null;
      var supportRoles=tkGetSelectedRoles('tk-typ-roles');
      var welcome=document.getElementById('tk-typ-welcome').value.trim();
      var format=document.getElementById('tk-typ-format').value.trim()||'ticket-{username}-{number}';
      var btn=this;btn.disabled=true;btn.textContent='Adding...';
      fetch('/api/server/'+serverId+'/tickets/panels/'+panelId+'/types',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,emoji:emoji,category_id:catId,support_roles:supportRoles,welcome_message:welcome,ticket_name_format:format})})
      .then(function(r){return r.json()}).then(function(d){if(d.success){showToast('Type added!');document.body.removeChild(overlay);loadTickets()}else showToast('Failed: '+(d.error||'unknown'),true);btn.disabled=false;btn.textContent='Add Type'}).catch(function(e){showToast('Failed: '+e.message,true);btn.disabled=false;btn.textContent='Add Type'});
    };
  }).catch(function(e){showToast('Failed to load server data',true)});
}

// ── Modern Modal: Edit Type Settings ──
export function editTicketTypeSettings(serverId,panelId,typeId){
  fetch('/api/server/'+serverId+'/tickets').then(function(r){return r.json()}).then(function(d2){
    // Look up the type from fresh API data
    var currentType=null;
    if(d2.panels){
      for(var pi=0;pi<d2.panels.length;pi++){
        var pts=d2.panels[pi].types||[];
        for(var ti=0;ti<pts.length;ti++){
          if(pts[ti].id===typeId){currentType=pts[ti];break}
        }
        if(currentType)break;
      }
    }
    if(!currentType){showToast('Type not found',true);return}
    var categories=(d2.channels||[]).filter(function(c){return c.type===4}).map(function(c){return '<option value="'+c.id+'"'+(c.id===currentType.category_id?' selected':'')+'>'+esc(c.name)+'</option>'});
    // support_roles/questions may be double-encoded JSON strings from the API — parse defensively
    var curRoles=parseTkArray(currentType.support_roles);
    var roles=(d2.roles||[]);
    var questions=parseTkArray(currentType.questions);
    
    var overlay=document.createElement('div');
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;';
    overlay.onclick=function(e){if(e.target===overlay)document.body.removeChild(overlay)};
    overlay.innerHTML='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;width:500px;max-width:92vw;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">'+
        '<h2 style="font-size:18px;font-weight:700;margin:0;">⚙️ '+currentType.emoji+' '+esc(currentType.name)+' Settings</h2>'+
        '<button class="tk-modal-close" style="background:none;border:none;color:var(--text-dim);font-size:22px;cursor:pointer;">\u2716</button></div>'+
      '<div class="stg" style="margin-bottom:12px;"><label>Type Name</label><input id="tk-typ-name" value="'+esc(currentType.name||'')+'" style="width:100%;padding:8px 10px;font-size:13px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;"></div>'+
      '<div class="stg" style="margin-bottom:12px;"><label>Emoji</label><input id="tk-typ-emoji" value="'+esc(currentType.emoji||'\uD83C\uDFAB')+'" style="width:100%;padding:8px 10px;font-size:16px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;"></div>'+
      (categories.length?'<div class="stg" style="margin-bottom:12px;"><label>Category</label><select id="tk-typ-cat" style="width:100%;padding:8px 10px;font-size:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;"><option value="">None</option>'+categories.join('')+'</select></div>':'')+
      (roles.length?'<div class="stg" style="margin-bottom:12px;"><label>Support Roles</label>'+tkRoleChipsHtml(roles,curRoles,'tk-typ-roles')+'<div style="font-size:9px;color:var(--text-dim);margin-top:4px;">Click roles to toggle them on/off</div></div>':'')+
      '<div class="stg" style="margin-bottom:12px;"><label>Welcome Message</label><textarea id="tk-typ-welcome" rows="2" style="width:100%;padding:8px 10px;font-size:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;resize:vertical;">'+esc(currentType.welcome_message||'')+'</textarea></div>'+
      '<div class="stg" style="margin-bottom:16px;"><label>Channel Name Format</label><input id="tk-typ-format" value="'+esc(currentType.ticket_name_format||'ticket-{username}-{number}')+'" style="width:100%;padding:8px 10px;font-size:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;"><div style="font-size:9px;color:var(--text-dim);margin-top:4px;">Variables: {username}, {number}, {name}</div></div>'+
      '<div style="display:flex;gap:8px;margin-bottom:12px;"><button class="btn" data-fn="_seq" data-args=\'[["editQuestions",'+fnData(serverId)+','+fnData(panelId)+','+fnData(typeId)+'],["tkCloseModal","@el"]]\' style="flex:1;padding:8px;font-size:11px;">\uD83D\uDCDD Edit Questions ('+questions.length+')</button></div>'+
      '<div style="margin-bottom:12px;"><button class="btn btn-s" data-fn="_seq" data-args=\'[["deleteTicketType",'+fnData(serverId)+','+fnData(panelId)+','+fnData(typeId)+'],["tkCloseModal","@el"]]\' style="width:100%;padding:8px;font-size:11px;color:#ff8a90;background:rgba(237,66,69,0.1);border:1px solid rgba(237,66,69,0.3);">\uD83D\uDDD1\uFE0F Delete Type</button></div>'+
      '<div style="display:flex;gap:8px;"><button class="tk-modal-close btn btn-s" style="flex:1;padding:10px;font-size:13px;">Cancel</button><button id="tk-typ-save" class="btn" style="flex:2;padding:10px;font-size:13px;">Save Settings</button></div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('.tk-modal-close').onclick=function(){document.body.removeChild(overlay)};
    overlay.querySelector('#tk-typ-save').onclick=function(){
      var name=document.getElementById('tk-typ-name').value.trim();
      if(!name){showToast('Enter a type name',true);return}
      var emoji=document.getElementById('tk-typ-emoji').value.trim()||'\uD83C\uDFAB';
      var catSel=document.getElementById('tk-typ-cat');
      var catId=catSel?catSel.value:null;
      var supportRoles=tkGetSelectedRoles('tk-typ-roles');
      var welcome=document.getElementById('tk-typ-welcome').value.trim();
      var format=document.getElementById('tk-typ-format').value.trim()||'ticket-{username}-{number}';
      var btn=this;btn.disabled=true;btn.textContent='Saving...';
      fetch('/api/server/'+serverId+'/tickets/panels/'+panelId+'/types/'+typeId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,emoji:emoji,category_id:catId||null,support_roles:supportRoles,welcome_message:welcome,ticket_name_format:format})})
      .then(function(r){return r.json()}).then(function(d){if(d.success){showToast('Settings saved!');document.body.removeChild(overlay);loadTickets()}else showToast('Failed: '+(d.error||'unknown'),true);btn.disabled=false;btn.textContent='Save Settings'}).catch(function(e){showToast('Failed: '+e.message,true);btn.disabled=false;btn.textContent='Save Settings'});
    };
  }).catch(function(e){showToast('Failed to load server data',true)});
}


export function tkCloseModal(btn){var overlay=btn.closest('[style*="fixed"]');if(overlay)document.body.removeChild(overlay)}

// ── Recent Tickets filter (state lives at file scope so tabs survive reloads of the tab) ──
var tkRecFilter='',tkRecData=[];
function tkRecStatusLabel(s){return s==='open'?'Open':(s==='claimed'?'Claimed':(s==='closed'?'Closed':String(s||'unknown')))}
function tkRecRender(){
  var body=document.getElementById('tk-rec-body');if(!body)return;
  var list=tkRecData.filter(function(t){return !tkRecFilter||t.status===tkRecFilter});
  if(!list.length){
    body.innerHTML='<div class="empty" style="padding:16px;"><p>'+(tkRecData.length?'No '+esc(tkRecFilter||'')+' tickets yet.':'No tickets have been created yet.')+'</p></div>';
    return;
  }
  body.innerHTML=list.slice(0,15).map(function(tk){
    var panelType=tk.panelTypeName?' <span class="tk-rec-type">'+esc(tk.panelTypeName)+'</span>':'';
    var sub=[];
    if(tk.status==='closed'){
      if(tk.closedAt)sub.push('closed '+tkTimeAgo(tk.closedAt)+(tk.closedByTag?' by '+esc(tk.closedByTag):''));
      if(tk.closedReason)sub.push(esc(tk.closedReason));
    }
    var subHtml=sub.length?'<div class="tk-rec-sub">'+sub.join(' · ')+'</div>':'';
    return '<div class="mod-item"><div class="mod-body"><div class="mod-top"><span class="mod-type">#'+tk.ticketNumber+' '+esc(tk.creatorTag||'Unknown')+panelType+'</span></div>'+subHtml+'</div><div class="mod-count"><span class="tk-status-pill tk-st-'+tk.status+'">'+tkRecStatusLabel(tk.status)+'</span></div></div>';
  }).join('');
}
export function tkRecFilterSet(f){tkRecFilter=f;tkRecRender()}

// ── Role chip picker (replaces Ctrl+click multi-selects) ──
function parseTkArray(v){
  if(Array.isArray(v))return v;
  if(!v)return[];
  if(typeof v==='string'){
    try{var p=JSON.parse(v);if(Array.isArray(p))return p;if(typeof p==='string'){try{var q=JSON.parse(p);return Array.isArray(q)?q:[]}catch{return[]}}return[]}catch{return[]}
  }
  return[];
}
function tkRoleChipsHtml(roles,selectedIds,containerId){
  var html='<div id="'+containerId+'" class="tk-role-chips">';
  if(!roles||!roles.length){html+='<span class="tk-chip-none">No roles available</span>'}
  else{
    html+=roles.map(function(r){
      var on=selectedIds.indexOf(r.id)>-1;
      return '<button type="button" class="tk-role-chip'+(on?' on':'')+'" data-role-id="'+r.id+'" data-fn="tkToggleRoleChip" data-args=\'[\"@el\"]\'>'+esc(r.name)+'</button>';
    }).join('');
  }
  html+='</div>';
  return html;
}
export function tkToggleRoleChip(btn){btn.classList.toggle('on');if(btn.closest('#tk-freq-roles'))tkMarkUnsaved()}
function tkGetSelectedRoles(containerId){
  var out=[];
  var box=document.getElementById(containerId);
  if(box)box.querySelectorAll('.tk-role-chip.on').forEach(function(c){out.push(c.getAttribute('data-role-id'))});
  return out;
}
function tkPill(title,sub,fn,args){return '<button type="button" class="tk-pill" data-fn="'+fn+'"'+(args?' data-args=\''+args+'\'':'')+'<span class="tk-pill-t">'+esc(title)+'</span>'+(sub?'<span class="tk-pill-s">'+esc(sub)+'</span>':'')+'<span class="tk-pill-a">\u203A</span></button>'}

// ── New helpers: Rename, Clone, Set Count, Card Click, Freq Config, Unsaved ──
export function tkRenamePanel(serverId,panelId){
  // Fetch current name
  fetch('/api/server/'+serverId+'/tickets').then(function(r){return r.json()}).then(function(d2){
    var curName='';
    for(var pi=0;pi<(d2.panels||[]).length;pi++){if(d2.panels[pi].id===panelId){curName=d2.panels[pi].name||'';break}}
    var overlay=document.createElement('div');
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;';
    overlay.onclick=function(e){if(e.target===overlay)document.body.removeChild(overlay)};
    overlay.innerHTML='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;width:380px;max-width:92vw;box-shadow:0 20px 60px rgba(0,0,0,0.4);">'+
      '<h2 style="font-size:16px;font-weight:700;margin:0 0 14px 0;">\u270F\uFE0F Rename Panel</h2>'+
      '<div class="stg" style="margin-bottom:16px;"><label>New Name</label><input id="tk-rnm-name" value="'+esc(curName)+'" style="width:100%;padding:8px 10px;font-size:13px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;"></div>'+
      '<div style="display:flex;gap:8px;"><button class="btn btn-s" data-fn="tkCloseModal" data-args=\'[\"@el\"]\' style="flex:1;padding:8px 12px;font-size:12px;">Cancel</button><button class="btn" id="tk-rnm-save" style="flex:1;padding:8px 12px;font-size:12px;">Rename</button></div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#tk-rnm-save').onclick=function(){
      var name=document.getElementById('tk-rnm-name').value.trim();
      if(!name){showToast('Enter a name',true);return}
      var btn=this;btn.disabled=true;btn.textContent='Saving...';
      fetch('/api/server/'+serverId+'/tickets/panels/'+panelId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name})})
      .then(function(r){return r.json()}).then(function(d){if(d.success){showToast('Panel renamed!');document.body.removeChild(overlay);loadTickets()}else showToast('Failed: '+(d.error||'unknown'),true);btn.disabled=false;btn.textContent='Rename'}).catch(function(e){showToast('Failed: '+e.message,true);btn.disabled=false;btn.textContent='Rename'});
    };
  }).catch(function(e){showToast('Failed to load panel data',true)});
}
export function tkClonePanel(serverId,panelId){
  fetch('/api/server/'+serverId+'/tickets/panels/'+panelId+'/clone',{method:'POST'})
  .then(function(r){return r.json()}).then(function(d){if(d.success){showToast('Panel cloned!');loadTickets()}else showToast('Failed: '+(d.error||'unknown'),true)})
  .catch(function(){showToast('Failed to clone',true)});
}
export function tkDeletePanel(serverId,panelId){
  if(!confirm('Delete this panel and all its types? This cannot be undone.'))return;
  fetch('/api/server/'+serverId+'/tickets/panels/'+panelId,{method:'DELETE'})
  .then(function(r){return r.json()}).then(function(d){if(d.success){showToast('Panel deleted');loadTickets()}else showToast('Failed: '+(d.error||'unknown'),true)})
  .catch(function(e){showToast('Failed: '+e.message,true)});
}
export function deleteTicketType(serverId,panelId,typeId){
  if(!confirm('Delete this ticket type? This cannot be undone.'))return;
  fetch('/api/server/'+serverId+'/tickets/panels/'+panelId+'/types/'+typeId,{method:'DELETE'})
  .then(function(r){return r.json()}).then(function(d){if(d.success){showToast('Type deleted');loadTickets()}else showToast('Failed: '+(d.error||'unknown'),true)})
  .catch(function(e){showToast('Failed: '+e.message,true)});
}
export function tkEditPanel(serverId,panelId){
  fetch('/api/server/'+serverId+'/tickets').then(function(r){return r.json()}).then(function(d2){
    var panel=null;
    for(var pi=0;pi<(d2.panels||[]).length;pi++){if(d2.panels[pi].id===panelId){panel=d2.panels[pi];break}}
    if(!panel){showToast('Panel not found',true);return}
    editTicketPanel(serverId,panelId,panel.name||'',panel.color||'#5865F2',panel.description||'');
  }).catch(function(e){showToast('Failed to load panel data',true)});
}
export function tkSetCount(serverId,panelId){
  if(!panelId){showToast('Select a panel first',true);return}
  // Fetch current counters (per-panel + global fallback)
  fetch('/api/server/'+serverId+'/tickets').then(function(r){return r.json()}).then(function(d2){
    var panel=null,panelName='';
    for(var pi=0;pi<(d2.panels||[]).length;pi++){if(d2.panels[pi].id===panelId){panel=d2.panels[pi];break}}
    panelName=panel?panel.name||'':'';
    var curCount=panel&&panel.ticket_counter>0?panel.ticket_counter:0;
    var globalCount=d2.config?d2.config.ticketCount||0:0;
    var nextVal=curCount>0?curCount:globalCount+1;
    var overlay=document.createElement('div');
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;';
    overlay.onclick=function(e){if(e.target===overlay)document.body.removeChild(overlay)};
    overlay.innerHTML='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;width:340px;max-width:92vw;box-shadow:0 20px 60px rgba(0,0,0,0.4);">'+
      '<h2 style="font-size:16px;font-weight:700;margin:0 0 14px 0;">\uD83D\uDD22 Set Ticket Counter</h2>'+
      '<div class="stg" style="margin-bottom:16px;"><label>Next ticket number</label><input id="tk-cnt-val" type="number" min="0" value="'+nextVal+'" style="width:100%;padding:8px 10px;font-size:13px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;"></div>'+
      '<div style="font-size:10px;color:var(--text-dim);margin-bottom:12px;">Panel: <strong>'+esc(panelName)+'</strong> \u00B7 Current: <strong>'+curCount+'</strong>. Set to 0 to auto-increment.</div>'+
      '<div style="display:flex;gap:8px;"><button class="btn btn-s" data-fn="tkCloseModal" data-args=\'[\"@el\"]\' style="flex:1;padding:8px 12px;font-size:12px;">Cancel</button><button class="btn" id="tk-cnt-save" style="flex:1;padding:8px 12px;font-size:12px;">Set</button></div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#tk-cnt-save').onclick=function(){
      var val=parseInt(document.getElementById('tk-cnt-val').value);
      if(isNaN(val)||val<0){showToast('Enter a valid number >= 0',true);return}
      var btn=this;btn.disabled=true;btn.textContent='Saving...';
      fetch('/api/server/'+serverId+'/tickets/panels/'+panelId+'/count',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({count:val})})
      .then(function(r){return r.json()}).then(function(d){if(d.success){showToast('Counter set!');document.body.removeChild(overlay);loadTickets()}else showToast('Failed: '+(d.error||'unknown'),true);btn.disabled=false;btn.textContent='Set'}).catch(function(e){showToast('Failed: '+e.message,true);btn.disabled=false;btn.textContent='Set'});
    };
  }).catch(function(e){showToast('Failed to load counter data',true)});
}
function tkCardClick(cardId,serverId,panelId){
  if(cardId==='types'||cardId==='forms'){
    fetch('/api/server/'+serverId+'/tickets').then(function(r){return r.json()}).then(function(d2){
      var panel=null;
      for(var pi=0;pi<(d2.panels||[]).length;pi++){if(d2.panels[pi].id===panelId){panel=d2.panels[pi];break}}
      if(!panel||!panel.types||!panel.types.length){
        // No types yet — open the Add Type modal right away
        if(cardId==='types'){addTicketType(serverId,panelId);return}
        showToast('No types configured',true);return
      }
      if(panel.types.length===1){
        if(cardId==='types')editTicketTypeSettings(serverId,panelId,panel.types[0].id);
        else editQuestions(serverId,panelId,panel.types[0].id);
        return;
      }
      // Multiple types — point the user at the Ticket Type dropdown (Ticket Tool style)
      var dd=document.getElementById('tkTypeSel');
      if(dd){
        dd.scrollIntoView({behavior:'smooth',block:'center'});
        dd.style.outline='2px solid var(--accent)';dd.style.outlineOffset='2px';
        setTimeout(function(){dd.style.outline='';dd.style.outlineOffset=''},2000);
      }
      showToast(cardId==='types'?'Pick a ticket type from the dropdown above':'Pick a type first, then edit its questions');
      return;
    }).catch(function(){showToast('Failed to load',true)});
    return;
  }
  if(cardId==='transcript'){
    var logCh=document.getElementById('tkLogCh');
    if(logCh){logCh.scrollIntoView({behavior:'smooth',block:'center'});logCh.style.outline='2px solid var(--accent)';logCh.style.outlineOffset='2px';setTimeout(function(){logCh.style.outline=''},2000)}
    showToast('Set transcript log channel in General Ticket Options');
    return;
  }
  if(cardId==='claiming'){
    var overlay=document.createElement('div');
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;';
    overlay.onclick=function(e){if(e.target===overlay)document.body.removeChild(overlay)};
    overlay.innerHTML='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;width:420px;max-width:92vw;box-shadow:0 20px 60px rgba(0,0,0,0.4);">'+
      '<h2 style="font-size:16px;font-weight:700;margin:0 0 12px 0;">\uD83D\uDC4B Claim System</h2>'+
      '<div style="font-size:12px;color:var(--text-dim);line-height:1.6;margin-bottom:16px;">'+
        '<p style="margin:0 0 8px 0;">Staff claim tickets via the <strong>Claim</strong> button in a ticket channel.</p>'+
        '<p style="margin:0 0 8px 0;">Claimed tickets show the claiming staff member. Only the claimer or Support Team role can close/transfer.</p>'+
        '<p style="margin:0;">Set <strong>Support Team Roles</strong> below to allow claiming.</p></div>'+
      '<button class="btn btn-s" data-fn="tkCloseModal" data-args=\'[\"@el\"]\' style="padding:8px 20px;font-size:12px;">Close</button></div>';
    document.body.appendChild(overlay);
    return;
  }
}

// ── Frequently Used Configs Helpers ──
export function tkToggleFreq(){
  var body=document.getElementById('tk-freq-body');
  var caret=document.getElementById('tk-freq-caret');
  if(!body||!caret)return;
  var vis=body.style.display!=='none';
  body.style.display=vis?'none':'grid';
  caret.style.transform=vis?'rotate(-90deg)':'rotate(0deg)';
}
export function tkEditMessage(serverId,type){
  var label=type==='panel'?'Panel Message':'Ticket Message';
  fetch('/api/server/'+serverId+'/tickets').then(function(r){return r.json()}).then(function(d2){
    var sel=document.getElementById('tkSelPanel');
    var panelId=sel?sel.value:'';
    var panel=null;
    for(var pi=0;pi<(d2.panels||[]).length;pi++){if(d2.panels[pi].id===panelId){panel=d2.panels[pi];break}}
    if(!panel){showToast('No panel selected',true);return}
    var curMsg='';
    var targetTypeId=null;
    if(type==='panel'){
      curMsg=panel.description||'';
    }else{
      if(!panel.types||!panel.types.length){showToast('No ticket types on this panel',true);return}
      // Respect the type selected in the dropdown (fall back to the first type)
      var typeSel=document.getElementById('tkTypeSel');
      var picked=typeSel?typeSel.value:'';
      var target=null;
      for(var ti3=0;ti3<panel.types.length;ti3++){if(panel.types[ti3].id===picked){target=panel.types[ti3];break}}
      if(!target)target=panel.types[0];
      targetTypeId=target.id;
      curMsg=target.welcome_message||'';
    }
    var overlay=document.createElement('div');
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;';
    overlay.onclick=function(e){if(e.target===overlay)document.body.removeChild(overlay)};
    overlay.innerHTML='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;width:480px;max-width:92vw;box-shadow:0 20px 60px rgba(0,0,0,0.4);">'+
      '<h2 style="font-size:16px;font-weight:700;margin:0 0 14px 0;">\uD83D\uDCAC Edit '+label+'</h2>'+
      '<div class="stg" style="margin-bottom:16px;"><label>Message (supports Discord markdown)</label><textarea id="tk-msg-text" rows="5" style="width:100%;padding:8px 10px;font-size:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;resize:vertical;">'+esc(curMsg)+'</textarea></div>'+
      '<div style="display:flex;gap:8px;"><button class="btn btn-s" data-fn="tkCloseModal" data-args=\'[\"@el\"]\' style="flex:1;padding:8px 12px;font-size:12px;">Cancel</button><button class="btn" id="tk-msg-save" style="flex:2;padding:8px 12px;font-size:12px;">Save</button></div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#tk-msg-save').onclick=function(){
      var msg=document.getElementById('tk-msg-text').value;
      var btn=this;btn.disabled=true;btn.textContent='Saving...';
      var url,body;
      if(type==='panel'){
        url='/api/server/'+serverId+'/tickets/panels/'+panelId;
        body={description:msg};
      }else{
        url='/api/server/'+serverId+'/tickets/panels/'+panelId+'/types/'+targetTypeId;
        body={welcome_message:msg};
      }
      fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){return r.json()}).then(function(d){if(d.success){showToast(label+' saved!');document.body.removeChild(overlay);loadTickets()}else showToast('Failed: '+(d.error||'unknown'),true);btn.disabled=false;btn.textContent='Save'}).catch(function(e){showToast('Failed: '+e.message,true);btn.disabled=false;btn.textContent='Save'});
    };
  }).catch(function(e){showToast('Failed to load config',true)});
}

// ── Unsaved Changes Bar ──
var tkUnsavedState=null;
export function tkMarkUnsaved(){
  var bar=document.getElementById('tk-unsaved-bar');
  if(bar){bar.style.display='flex'}
}
export function tkResetChanges(){
  var bar=document.getElementById('tk-unsaved-bar');
  if(bar)bar.style.display='none';
  loadTickets();
  showToast('Changes reset');
}
export function tkSaveChanges(){
  var bar=document.getElementById('tk-unsaved-bar');
  var selRoles=tkGetSelectedRoles('tk-freq-roles');
  var catSel=document.getElementById('tk-freq-cats');
  var selCat=catSel?catSel.value:null;
  var sel=document.getElementById('tkSelPanel');
  var serverId=document.getElementById('tkSrvSelect')?document.getElementById('tkSrvSelect').value:'';
  var panelId=sel?sel.value:'';
  if(!serverId||!panelId){showToast('No panel selected',true);return}
  fetch('/api/server/'+serverId+'/tickets').then(function(r){return r.json()}).then(function(d2){
    var firstTypeId=null;
    var typeSel=document.getElementById('tkTypeSel');
    var pickedTypeId=typeSel?typeSel.value:'';
    for(var pi=0;pi<(d2.panels||[]).length;pi++){
      if(d2.panels[pi].id===panelId&&d2.panels[pi].types&&d2.panels[pi].types.length){
        // Prefer the type currently selected in the dropdown; fall back to the first type
        if(pickedTypeId&&d2.panels[pi].types.some(function(t){return t.id===pickedTypeId})){firstTypeId=pickedTypeId;break}
        firstTypeId=d2.panels[pi].types[0].id;break;
      }
    }
    if(!firstTypeId){showToast('No types to update',true);return}
    var payload={support_roles:selRoles};
    if(selCat!==null&&selCat!==undefined)payload.category_id=selCat||null;
    fetch('/api/server/'+serverId+'/tickets/panels/'+panelId+'/types/'+firstTypeId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    .then(function(r2){return r2.json()}).then(function(d3){
      if(d3.success){showToast('Settings saved!');if(bar)bar.style.display='none';loadTickets()}
      else showToast('Save failed: '+(d3.error||'unknown'),true);
    }).catch(function(){showToast('Save failed',true)});
  }).catch(function(){showToast('Save failed',true)});
}

