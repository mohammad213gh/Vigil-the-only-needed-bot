// ═══ AUTO-MOD ═══
async function loadAutomod(){
  const sel=document.getElementById('amSrvSelect');
  if(!sel)return;
  // Populate server select if empty
  if(sel.options.length<=1&&allServers.length){
    sel.innerHTML='<option value="">Select a server...</option>'+allServers.map(function(s){return '<option value="'+s.id+'"'+(curSrv===s.id?' selected':'')+'>'+esc(s.name)+'</option>';}).join('');
  }

  const serverId=sel.value;
  const el=document.getElementById('automodContent');
  if(!el)return;

  if(!serverId){
    el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><p>Select a server to configure auto-mod</p><p class="empty-act">Choose a server to manage spam protection, word filters, link blocking, and more.</p></div>';
    updateRefreshTimestamp('automod');
    return;
  }

  el.innerHTML='<div class="loading" style="padding:30px;text-align:center;"><div class="spin"></div><div style="margin-top:10px;font-size:12px;color:var(--text-dim);">Loading auto-mod config...</div></div>';

  try{
    const r=await fetch('/api/server/'+serverId+'/automod');
    const d=await r.json();
    if(!d.rules)throw new Error('Invalid response');

    const rules=d.rules||{};
    const filters=d.filters||{words:[],links:[]};
    const channels=d.channels||[];
    const roles=d.roles||[];
    const cs=d.channelSettings||{includedChannels:[],excludedChannels:[],whitelistedRoles:[]};
    console.log('[AM] loadAutomod got channelSettings:',JSON.stringify(cs));
    console.log('[AM] includedChannels length:',cs.includedChannels?.length,'value:',cs.includedChannels);

    // Build rule cards
    const ruleConfigs=[
      {key:'spam',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',label:'Spam Protection',desc:'Auto-detect and block message spam based on frequency',color:'#ef4444'},
      {key:'mentions',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',label:'Mass Mention',desc:'Limit the number of user/role/channel mentions per message',color:'#f59e0b'},
      {key:'words',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>',label:'Banned Words',desc:'Automatically filter messages containing banned words or phrases',color:'#3b82f6'},
      {key:'links',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',label:'Link Blocking',desc:'Block links or maintain an allowlist of permitted domains',color:'#8b5cf6'},
      {key:'caps',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="6 9 12 15 18 9"/></svg>',label:'Excessive Caps',desc:'Flag messages with too many uppercase characters',color:'#06b6d4'},
    ];

    var rulesHtml=ruleConfigs.map(function(rc){
      var r=rules[rc.key]||{enabled:false,threshold:5,time_window:10,action:'warn',duration:null};
      var en=r.enabled?'on':'';
      return '<div class="am-rule card" style="border-left:3px solid '+(r.enabled?rc.color:'var(--border)')+';">'+
        '<div class="am-rule-h">'+
          '<div class="am-rule-icon" style="color:'+rc.color+';">'+rc.icon+'</div>'+
          '<div class="am-rule-info"><div class="am-rule-label">'+rc.label+'</div><div class="am-rule-desc">'+rc.desc+'</div></div>'+
          '<div class="am-rule-toggle"><div class="tg '+(r.enabled?'on':'')+'" data-am-rule="'+rc.key+'" onclick="toggleAMRule(\''+rc.key+'\')"></div></div>'+
        '</div>'+
        '<div class="am-rule-body" id="am-body-'+rc.key+'" style="display:'+(r.enabled?'block':'none')+';">'+
          '<div class="am-fields">'+
            '<div class="am-field"><label>Threshold</label>'+
              '<select class="am-threshold" data-rule="'+rc.key+'">'+
                (rc.key==='spam'?[1,2,3,4,5,6,7,8,9,10].map(function(n){return '<option value="'+n+'"'+(r.threshold===n?' selected':'')+'>'+n+' msgs</option>';}).join(''):'')+
                (rc.key==='mentions'?[3,5,10,15,20,25,30].map(function(n){return '<option value="'+n+'"'+(r.threshold===n?' selected':'')+'>'+n+' mentions</option>';}).join(''):'')+
                (rc.key==='caps'?[30,40,50,60,70,80,90].map(function(n){return '<option value="'+n+'"'+(r.threshold===n?' selected':'')+'>'+n+'% caps</option>';}).join(''):'')+
                ((rc.key!=='spam'&&rc.key!=='mentions'&&rc.key!=='caps')?'<option value="0" selected>1 match</option>':'')+
              '</select></div>'+
            (rc.key==='spam'?'<div class="am-field"><label>Time Window</label><select class="am-window" data-rule="'+rc.key+'">'+
              [3,5,10,15,20,30,60].map(function(n){return '<option value="'+n+'"'+(r.time_window===n?' selected':'')+'>'+n+'s</option>';}).join('')+'</select></div>':'')+
            '<div class="am-field"><label>Action</label><select class="am-action" data-rule="'+rc.key+'">'+
              ['warn','delete','timeout','kick'].map(function(a){return '<option value="'+a+'"'+(r.action===a?' selected':'')+'>'+a+'</option>';}).join('')+'</select></div>'+
            (rc.key!=='caps'&&rc.key!=='words'&&rc.key!=='links'?'':'')+
          '</div>'+
          '<button class="btn btn-s" onclick="saveAMRule(\''+rc.key+'\')" style="margin-top:8px;padding:5px 12px;font-size:11px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:11px;height:11px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Rule</button>'+
        '</div></div>';
    }).join('');

    // Build word filters panel
    var wordHtml=filters.words&&filters.words.length?filters.words.map(function(f,i){
      var ac=f.action||'delete';
      var acColor=ac==='warn'?'#f59e0b':ac==='delete'?'#ef4444':ac==='timeout'?'#8b5cf6':'#3b82f6';
      return '<div class="am-f-item"><span class="am-f-pat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:10px;height:10px;"><polyline points="20 6 9 17 4 12"/></svg>'+esc(f.pattern)+'</span><span class="am-f-act" style="color:'+acColor+'">'+ac+'</span><button class="am-f-del" onclick="deleteAMFilter(\''+serverId+'\',\'words\',\''+encodeURIComponent(f.pattern)+'\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>';
    }).join(''):'<div class="am-f-empty">No word filters configured. Add words below.</div>';

    var linkHtml=filters.links&&filters.links.length?filters.links.map(function(f,i){
      return '<div class="am-f-item"><span class="am-f-pat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:10px;height:10px;"><polyline points="20 6 9 17 4 12"/></svg>'+esc(f.pattern)+'</span><span class="am-f-act" style="color:#3b82f6;">allowlist</span><button class="am-f-del" onclick="deleteAMFilter(\''+serverId+'\',\'links\',\''+encodeURIComponent(f.pattern)+'\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>';
    }).join(''):'<div class="am-f-empty">No allowed domains configured. Add domains below.</div>';

    // Build channel settings
    function chkCh(id,list){return list.indexOf(id)!==-1;}
    function chkRole(id,list){return list.indexOf(id)!==-1;}
    var channelHtml='<div class="am-chan-list">'+channels.map(function(c){
      var ic=chkCh(c.id,cs.includedChannels);
      var ec=chkCh(c.id,cs.excludedChannels);
      var prefix=c.parentName?'['+esc(c.parentName)+'] ':'',pName=prefix+esc(c.name);
      return            '<div class="am-chan-item"><input type="checkbox" onchange="toggleAMChannel(\''+c.id+'\',this,this.checked)" '+(ic?'checked':'')+' data-inc="'+c.id+'"'+(ec?' disabled':'')+'><input type="checkbox" onchange="toggleAMChannel(\''+c.id+'\',this,this.checked)" '+(ec?'checked':'')+' data-exc="'+c.id+'"'+(ic?' disabled':'')+' style="margin-left:4px;"><span>'+pName+'</span></div>';
    }).join('')+'</div>';

    var roleHtml='<div class="am-chan-list">'+roles.map(function(r){
      var wh=chkRole(r.id,cs.whitelistedRoles);
      return '<div class="am-chan-item" onclick="toggleAMRole(\''+r.id+'\',this)"><input type="checkbox"'+(wh?' checked':'')+' data-role="'+r.id+'"'+(r.color?' style="accent-color:'+r.color+'"':'')+'><span style="color:'+(r.color||'var(--text)')+';">'+esc(r.name)+'</span></div>';
    }).join('')+'</div>';

    // Build full page
    el.innerHTML='<div class="grid grid-2" style="margin-bottom:16px;">'+rulesHtml+'</div>'+
    '<div class="grid grid-3" style="margin-top:4px;">'+
      // Filters panel
      '<div class="tw sr"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>Word Filters</div>'+
        '<div class="am-section">'+
          '<div class="am-f-list">'+wordHtml+'</div>'+
          '<div class="am-f-add"><input type="text" id="amWordInput" placeholder="Add banned word..." style="flex:1;" onkeydown="if(event.key===\'Enter\')addAMFilter(\''+serverId+'\',\'words\')"><button class="btn btn-s" onclick="addAMFilter(\''+serverId+'\',\'words\')" style="padding:7px 12px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button></div>'+
          '<div class="am-f-add" style="margin-top:4px;"><input type="text" id="amWordBulk" placeholder="word1:delete, word2:warn, word3:timeout" style="flex:1;font-size:10px;"><button class="btn btn-s" onclick="bulkAMFilter(\''+serverId+'\',\'words\')" style="padding:5px 10px;font-size:10px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:10px;height:10px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Bulk Import</button>'+
            '<input type="file" id="amTxtUpload" accept=".txt" style="display:none;" onchange="uploadTxtFilter(\''+serverId+'\',this)">'+
            '<button class="btn btn-s" onclick="document.getElementById(\'amTxtUpload\').click()" style="padding:5px 10px;font-size:10px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:10px;height:10px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> .txt File</button></div>'+
        '</div></div>'+
      // Link allowlist panel
      '<div class="tw sr"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Link Allowlist</div>'+
        '<div class="am-section">'+
          '<div class="am-f-list">'+linkHtml+'</div>'+
          '<div class="am-f-add"><input type="text" id="amLinkInput" placeholder="example.com" style="flex:1;"><button class="btn btn-s" onclick="addAMFilter(\''+serverId+'\',\'links\')" style="padding:7px 12px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button></div>'+
        '</div></div>'+
      // Channel / role settings panel
      '<div class="tw sr"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/></svg>Channel & Role Settings</div>'+
        '<div class="am-section">'+
          '<div class="am-chan-mode"><label style="font-size:11px;color:var(--text-dim);display:flex;align-items:center;gap:6px;margin-bottom:8px;">'+
            '<select id="amChanMode" onchange="toggleAMChanMode()" style="font-size:11px;padding:4px 8px;"><option value="all">All Channels</option><option value="include"'+(cs.includedChannels.length?' selected':'')+'>Only Included</option><option value="exclude"'+(cs.excludedChannels.length?' selected':'')+'>Exclude Selected</option></select>'+
            '<span>Channel mode</span></label></div>'+
          '<div id="amChanPanel"'+(cs.includedChannels.length||cs.excludedChannels.length?'':' style="display:none;"')+'>'+channelHtml+'</div>'+
          '<div class="am-chan-save"><button class="btn btn-s" onclick="saveAMChannels(\''+serverId+'\')" style="margin-top:6px;padding:5px 12px;font-size:11px;width:100%;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:11px;height:11px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Channels</button></div>'+
          '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);"><label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:6px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px;vertical-align:middle;margin-right:4px;"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>Whitelisted Roles (bypass auto-mod)</label>'+
            roleHtml+
          '<button class="btn btn-s" onclick="saveAMRoles(\''+serverId+'\')" style="margin-top:6px;padding:5px 12px;font-size:11px;width:100%;">Save Roles</button></div>'+
        '</div></div>'+
    '</div>'+
    // Import/Export buttons
    '<div style="display:flex;gap:8px;margin-top:16px;padding:12px 0;border-top:1px solid var(--border);">'+
      '<button class="btn btn-s" onclick="exportAMConfig(\''+serverId+'\')" style="padding:7px 16px;font-size:11px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export Config</button>'+
      '<button class="btn btn-s" onclick="importAMConfig(\''+serverId+'\')" style="padding:7px 16px;font-size:11px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Import Config</button>'+
    '</div>';

    updateRefreshTimestamp('automod');
    // Trigger scroll reveal for newly added elements
    setTimeout(function(){document.querySelectorAll('#sec-automod .sr').forEach(function(el){srObs.observe(el)})},50);
  }catch(e){
    el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Could not load auto-mod config</p><p class="empty-act">'+e.message+'</p></div>';
  }
}

// ═══ ERRORS ═══
var errTagFilter='';
function tkTimeAgo(ts){
  if(!ts)return '';
  var t=new Date(ts).getTime();if(isNaN(t))return '';
  var s=Math.floor((Date.now()-t)/1000);
  if(s<45)return 'just now';
  if(s<3600)return Math.floor(s/60)+'m ago';
  if(s<86400)return Math.floor(s/3600)+'h ago';
  if(s<2592000)return Math.floor(s/86400)+'d ago';
  return new Date(ts).toLocaleDateString();
}
async function loadErrors(){
  var el=document.getElementById('errFeed');if(!el)return;
  try{
    var qs=errTagFilter?'?tag='+encodeURIComponent(errTagFilter):'';
    var r=await fetch('/api/errors'+qs),d=await r.json();
    if(!d||!d.errors){el.innerHTML='<div class="empty"><p>Failed to load errors.</p></div>';return}
    var tags=d.tags||[];
    var allCount=tags.reduce(function(a,t){return a+t.count},0);
    var chips='<div class="err-chips">'+
      '<button class="err-chip'+(errTagFilter===''?' on':'')+'" data-tag="" onclick="errSetFilter(this.dataset.tag)">All <span class="err-chip-n">'+allCount+'</span></button>'+
      tags.map(function(t){return '<button class="err-chip'+(errTagFilter===t.tag?' on':'')+'" data-tag="'+esc(t.tag)+'" onclick="errSetFilter(this.dataset.tag)">'+esc(t.tag)+' <span class="err-chip-n">'+t.count+'</span></button>'}).join('')+
      '<button class="err-chip err-clear" onclick="errClearLog()" style="margin-left:auto;">\uD83D\uDDD1 Clear</button></div>';
    if(!d.errors.length){
      el.innerHTML=chips+'<div class="empty"><p>'+(errTagFilter?'No '+esc(errTagFilter)+' errors logged.':'No errors logged yet.')+'</p><p class="empty-act">Errors are captured automatically from every module — a clean feed means a healthy bot.</p></div>';
    }else{
      errAll=d.errors;if(!errShown)errShown=25;
      var shown=errAll.slice(0,errShown);
      el.innerHTML=chips+'<div class="err-feed">'+shown.map(function(e){
        var stackHtml=e.stack?'<pre class="err-stack">'+esc(e.stack)+'</pre>':'';
        var metaHtml=e.meta?'<div class="err-meta">'+esc(e.meta)+'</div>':'';
        var extraHtml=e.extra?'<span class="err-extra">'+esc(e.extra)+'</span>':'';
        return '<div class="err-item"><div class="err-top"><span class="err-badge err-b-'+esc(e.tag)+'">'+esc(e.tag)+'</span><span class="err-msg">'+esc(e.message)+'</span>'+extraHtml+'</div>'+
          '<div class="err-sub"><span class="err-time">'+tkTimeAgo(e.timestamp)+'</span>'+
          (e.stack?'<button class="err-toggle" onclick="errToggleStack(this)">Show stack</button>':'')+
          '</div>'+metaHtml+stackHtml+'</div>';
       }).join('')+'</div>'+(errAll.length>errShown?'<button class="btn btn-s" onclick="errLoadMore()" style="margin:10px auto;display:block;padding:8px 20px;font-size:11px;">Load More ('+(errAll.length-errShown)+' remaining)</button>':'');
    }
    updateRefreshTimestamp('errors');
  }catch{
    el.innerHTML='<div class="empty"><p>Couldn\'t load errors.</p><p class="empty-act">The bot may be reconnecting.</p></div>';
  }
}
var errAll=[],errShown=0;
function errLoadMore(){errShown+=50;loadErrors()}
function errSetFilter(tag){errTagFilter=tag||'';errShown=25;loadErrors()}
function errToggleStack(btn){
  var p=btn.closest('.err-item').querySelector('.err-stack');
  if(!p)return;
  var show=p.style.display!=='block';
  p.style.display=show?'block':'none';
  btn.textContent=show?'Hide stack':'Show stack';
}
function errClearLog(){
  if(!confirm('Clear all logged errors?'))return;
  fetch('/api/errors',{method:'DELETE'}).then(function(r){return r.json()}).then(function(d2){
    if(d2.success){errTagFilter='';loadErrors();showToast('Error log cleared')}
    else showToast('Failed to clear',true);
  }).catch(function(){showToast('Failed to clear',true)});
}

// ═══ AUTO-MOD HELPERS ═══
async function toggleAMRule(key){
  var body=document.getElementById('am-body-'+key);
  var tg=document.querySelector('[data-am-rule="'+key+'"]');
  var sel=document.getElementById('amSrvSelect');
  if(!tg||!sel)return;
  var now=tg.classList.contains('on');
  var enabled=!now;
  tg.classList.toggle('on');
  if(body)body.style.display=enabled?'block':'none';
  // Persist the new enabled state immediately, so toggling a rule OFF actually saves.
  // (The Save Rule button lives inside the collapsible body, which is hidden when OFF.)
  var threshold=parseInt(document.querySelector('.am-threshold[data-rule="'+key+'"]')?.value)||5;
  var timeWindow=parseInt(document.querySelector('.am-window[data-rule="'+key+'"]')?.value)||10;
  var action=document.querySelector('.am-action[data-rule="'+key+'"]')?.value||'warn';
  try{
    var r=await fetch('/api/server/'+sel.value+'/automod/rules',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ruleType:key,config:{enabled:enabled,threshold:threshold,time_window:timeWindow,action:action,duration:null}})});
    var d=await r.json();
    if(d.success){showToast(enabled?'Rule enabled':'Rule disabled')}
    else{showToast('Failed',true);tg.classList.toggle('on');if(body)body.style.display=now?'block':'none'}
  }catch{showToast('Failed to save',true);tg.classList.toggle('on');if(body)body.style.display=now?'block':'none'}
}

async function saveAMRule(key){
  var el=document.querySelector('[data-am-rule="'+key+'"]');
  if(!el)return;
  var enabled=el.classList.contains('on');
  var threshold=parseInt(document.querySelector('.am-threshold[data-rule="'+key+'"]')?.value)||5;
  var timeWindow=parseInt(document.querySelector('.am-window[data-rule="'+key+'"]')?.value)||10;
  var action=document.querySelector('.am-action[data-rule="'+key+'"]')?.value||'warn';
  var sel=document.getElementById('amSrvSelect');
  if(!sel)return;
  try{
    var r=await fetch('/api/server/'+sel.value+'/automod/rules',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ruleType:key,config:{enabled,threshold,time_window:timeWindow,action,duration:null}})});
    var d=await r.json();
    if(d.success){showToast('Rule saved!');loadAutomod()}else showToast('Failed',true);
  }catch{showToast('Failed to save',true)}
}
async function addAMFilter(serverId,type){
  var input=document.getElementById(type==='words'?'amWordInput':'amLinkInput');
  if(!input||!input.value.trim())return;
  var pattern=input.value.trim().toLowerCase();
  try{
    var r=await fetch('/api/server/'+serverId+'/automod/filters',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filterType:type,pattern:pattern,action:'delete'})});
    var d=await r.json();
    if(d.success){input.value='';showToast('Filter added!');loadAutomod()}else showToast('Failed',true);
  }catch{showToast('Failed',true)}
}
async function deleteAMFilter(serverId,type,pattern){
  var raw=decodeURIComponent(pattern);
  if(!confirm('Remove "'+raw+'" from '+type+'?'))return;
  try{
    var r=await fetch('/api/server/'+serverId+'/automod/filters',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({filterType:type,pattern:raw})});
    var d=await r.json();
    if(d.success){showToast('Filter removed!');loadAutomod()}else showToast('Failed',true);
  }catch{showToast('Failed',true)}
}
async function uploadTxtFilter(serverId,inp){
  var file=inp.files&&inp.files[0];
  if(!file)return;
  try{
    var text=await file.text();
    // Split by commas, newlines, or both
    var raw=text.split(/[,\n]+/).map(function(s){return s.trim().toLowerCase()}).filter(function(s){return s.length>0});
    if(!raw.length){showToast('No words found in file',true);return}
    // Send as comma-separated list (bulk endpoint defaults to :delete action)
    var r=await fetch('/api/server/'+serverId+'/automod/filters/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filterType:'words',patterns:raw.join(',')})});
    var d=await r.json();
    if(d.success){showToast('Added '+d.added+' words from file!');inp.value='';loadAutomod()}else showToast('Import failed',true);
  }catch(e){showToast('Error reading file: '+e.message,true);inp.value=''}
}

async function bulkAMFilter(serverId,type){
  var input=document.getElementById(type==='words'?'amWordBulk':'')||document.getElementById('amWordBulk');
  if(!input||!input.value.trim())return;
  try{
    var r=await fetch('/api/server/'+serverId+'/automod/filters/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filterType:type,patterns:input.value})});
    var d=await r.json();
    if(d.success){input.value='';showToast('Added '+d.added+' filters!');loadAutomod()}else showToast('Failed',true);
  }catch{showToast('Failed',true)}
}
function toggleAMChannel(id,cb,checked){
  if(!cb)return;
  var row=cb.parentElement;
  if(!row)return;
  var inc=row.querySelector('[data-inc="'+id+'"]');
  var exc=row.querySelector('[data-exc="'+id+'"]');
  if(!inc||!exc)return;
  // Mutually exclusive: when include is checked, uncheck exclude (and vice versa)
  if(cb===inc&&checked&&exc)exc.checked=false;
  if(cb===exc&&checked&&inc)inc.checked=false;
}
function toggleAMRole(id,row){
  var cb=row.querySelector('[data-role="'+id+'"]');
  if(!cb)return;
  cb.checked=!cb.checked;
}
function toggleAMChanMode(){
  var mode=document.getElementById('amChanMode').value;
  var panel=document.getElementById('amChanPanel');
  if(!panel)return;
  panel.style.display=(mode==='all')?'none':'block';
}
async function saveAMChannels(serverId){
  var mode=document.getElementById('amChanMode')?.value||'all';
  var inc=[],exc=[];
  if(mode==='include'){
    document.querySelectorAll('[data-inc]:checked').forEach(function(cb){inc.push(cb.dataset.inc)});
  }else if(mode==='exclude'){
    document.querySelectorAll('[data-exc]:checked').forEach(function(cb){exc.push(cb.dataset.exc)});
  }else{
    inc=[];exc=[];
  }
  console.log('[AM] Saving channels:',JSON.stringify({mode,inc,exc}));
  try{
    var r=await fetch('/api/server/'+serverId+'/automod/channels',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({includedChannels:inc,excludedChannels:exc})});
    var d=await r.json();
    console.log('[AM] Save response:',JSON.stringify(d));
    if(d.success){
      showToast('Channel settings saved!');
      loadAutomod()
    }else showToast('Failed',true);
  }catch(e){console.log('[AM] Save error:',e);showToast('Failed',true)}
}
async function saveAMRoles(serverId){
  var wh=[];
  document.querySelectorAll('[data-role]:checked').forEach(function(cb){wh.push(cb.dataset.role)});
  try{
    var r=await fetch('/api/server/'+serverId+'/automod/channels',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({whitelistedRoles:wh})});
    var d=await r.json();
    if(d.success){showToast('Role whitelist saved!');loadAutomod()}else showToast('Failed',true);
  }catch{showToast('Failed',true)}
}
async function exportAMConfig(serverId){
  try{
    var r=await fetch('/api/server/'+serverId+'/automod/export');
    var d=await r.json();
    var blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');a.href=url;a.download='automod-config-'+serverId+'-'+new Date().toISOString().slice(0,10)+'.json';a.click();
    URL.revokeObjectURL(url);showToast('Config exported!')
  }catch{showToast('Export failed',true)}
}
async function importAMConfig(serverId){
  var inp=document.createElement('input');inp.type='file';inp.accept='.json';
  inp.onchange=async function(){
    var file=inp.files[0];if(!file)return;
    try{
      var text=await file.text();
      var data=JSON.parse(text);
      if(!data.rules){showToast('Invalid file — missing rules',true);return}
      var r=await fetch('/api/server/'+serverId+'/automod/import',{method:'POST',headers:{'Content-Type':'application/json'},body:text});
      var d=await r.json();
      if(d.success){showToast('Config imported!');loadAutomod()}else showToast('Import failed',true);
    }catch(e){showToast('Import error: '+e.message,true)}
  };
  inp.click();
}

