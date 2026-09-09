import { backupNow, bgAnimId, cfg, checkAuth, esc, fnData, initBgStyles, initPalettes, initThemes, loadAct, loadAn, loadBackups, loadBrand, loadCfg, loadCmdUsage, loadCommands, loadGiveaways, loadOv, loadRm, loadServers, loadSrvAudit, loadSrvChannels, loadSrvLogging, loadSrvRoles, loadSys, saveSettings, showSkeleton, showToast, srObs, stRf, startBg, toggleTheme } from './01-foundation.mjs';
import { applyCompactPref, loadSrvModTools } from './03-mod-tools.mjs';
import { loadTickets } from './04-tickets.mjs';
// ═══ COMMAND PALETTE (Ctrl+K) ═══
const PAL_SECTIONS=[['overview','Overview'],['analytics','Analytics'],['servers','Servers'],['auditlog','Audit Log'],['moderation','Moderation'],['activity','Activity'],['insights','Insights'],['invites','Invites'],['giveaways','Giveaways'],['automod','Auto-Mod'],['tickets','Tickets'],['commands','Commands'],['reminders','Reminders'],['system','System'],['errors','Errors'],['settings','Customize']];
const PAL_ACTIONS=PAL_SECTIONS.map(s=>({label:'Go to '+s[1],hint:'Section',run:()=>showSec(s[0])}))
  .concat([
    {label:'Toggle Dark / Light Mode',hint:'Action',run:toggleTheme},
    {label:'Save All Settings',hint:'Action',run:saveSettings},
    {label:'Backup Database Now',hint:'Action',run:()=>{showSec('system');loadBackups();backupNow()}},
    {label:'Load Servers',hint:'Refresh',run:loadServers},
    {label:'Load Giveaways',hint:'Refresh',run:loadGiveaways},
  ]);

// ═══ TAB SWITCHER ═══
export function showSec(n){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.notch-link').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.notch-mobile-link').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nd-item').forEach(s=>s.classList.remove('active'));
  const sec=document.getElementById('sec-'+n);sec.classList.add('active');
  sec.classList.remove('sec-enter');void sec.offsetWidth;sec.classList.add('sec-enter');
  const nav=document.querySelector('.notch-link[data-sec="'+n+'"]');if(nav)nav.classList.add('active');
  const mnav=document.querySelector('.notch-mobile-link[data-sec="'+n+'"]');if(mnav)mnav.classList.add('active');
  const ndi=document.querySelector('.nd-item[data-sec="'+n+'"]');if(ndi)ndi.classList.add('active');
  document.querySelectorAll('.ndrop.open').forEach(d=>d.classList.remove('open'));
  setTimeout(()=>{document.querySelectorAll('#sec-'+n+' .sr').forEach(el=>srObs.observe(el))},50)
}

// ═══ NAV DROPDOWN GROUPS ═══
// Toggle (or force-close) a top-bar dropdown group. data-fn driven from index.html.
export function toggleNavDrop(id,closeOnly){
  const drop=document.getElementById(id);if(!drop)return;
  const wasOpen=drop.classList.contains('open');
  document.querySelectorAll('.ndrop.open').forEach(d=>d.classList.remove('open'));
  if(!wasOpen&&!closeOnly)drop.classList.add('open');
}
document.addEventListener('click',e=>{if(!e.target.closest('.ndrop'))document.querySelectorAll('.ndrop.open').forEach(d=>d.classList.remove('open'))});

// ═══ SERVER MANAGEMENT ═══
let srvMgmtTab='overview';
export function showSrvTab(tab,serverId){
  srvMgmtTab=tab;
  document.querySelectorAll('.mgmt-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  document.querySelectorAll('.mgmt-panel').forEach(p=>p.style.display=p.dataset.panel===tab?'':'none');
  if(tab==='roles'&&serverId)loadSrvRoles(serverId);
  if(tab==='channels'&&serverId)loadSrvChannels(serverId);
  if(tab==='logging'&&serverId)loadSrvLogging(serverId);
  if(tab==='audit'&&serverId)loadSrvAudit(serverId);
  if(tab==='greetings'&&serverId)loadSrvGreetings(serverId);if(tab==='modtools'&&serverId)loadSrvModTools(serverId);
  if(tab==='settings'&&serverId)loadSrvSettings(serverId)
}
let palSel=0,palItems=[];
function buildPalette(){
  if(document.getElementById('cmdPalOv'))return;
  const ov=document.createElement('div');ov.id='cmdPalOv';ov.className='cmd-palette-ov';
  ov.innerHTML='<div class="cmd-palette"><input type="text" id="cmdPalInput" placeholder="Type a command or section… (Esc to close)" autocomplete="off"><div class="cmd-pal-list" id="cmdPalList"></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('mousedown',e=>{if(e.target===ov)closePalette()});
  document.getElementById('cmdPalInput').addEventListener('input',e=>paletteRender(e.target.value));
}
function paletteRender(q){
  q=(q||'').toLowerCase();
  palItems=PAL_ACTIONS.filter(a=>a.label.toLowerCase().includes(q));
  palSel=Math.min(palSel,Math.max(0,palItems.length-1));
  const list=document.getElementById('cmdPalList');
  list.innerHTML=palItems.map((a,i)=>{
    const on=i===palSel;
    return '<div class="cmd-pal-item'+(on?' sel':'')+'" data-i="'+i+'" data-fn="palRun" data-args=\'['+fnData(i)+']\'><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="9 18 15 12 9 6"/></svg>'+esc(a.label)+'<span class="hint">'+a.hint+'</span></div>';
  }).join('')||'<div class="empty"><p>No matches</p></div>';
}
function openPalette(){buildPalette();const ov=document.getElementById('cmdPalOv');ov.classList.add('open');const inp=document.getElementById('cmdPalInput');inp.value='';palSel=0;paletteRender('');setTimeout(()=>inp.focus(),20)}
function closePalette(){const ov=document.getElementById('cmdPalOv');if(ov)ov.classList.remove('open')}
export function palRun(i){const a=palItems[i];if(!a)return;closePalette();try{a.run()}catch{}}
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();const ov=document.getElementById('cmdPalOv');if(ov&&ov.classList.contains('open'))closePalette();else openPalette();return}
  const ov=document.getElementById('cmdPalOv');if(!ov||!ov.classList.contains('open'))return;
  if(e.key==='Escape')closePalette();
  else if(e.key==='ArrowDown'){e.preventDefault();palSel=Math.min(palSel+1,palItems.length-1);paletteRender(document.getElementById('cmdPalInput').value)}
  else if(e.key==='ArrowUp'){e.preventDefault();palSel=Math.max(palSel-1,0);paletteRender(document.getElementById('cmdPalInput').value)}
  else if(e.key==='Enter'){e.preventDefault();palRun(palSel)}
});

// ═══ GREETINGS (Welcome / Goodbye) ═══

function greetFieldsHtml(cfg,type,serverId,channels){
  const typeLabel=type==='welcome'?'Welcome':'Goodbye';
  var chOpts='<option value="">— No channel (disabled) —</option>';
  if(channels&&channels.length)channels.forEach(function(c){chOpts+='<option value="'+c.id+'"'+(c.id===cfg.channelId?' selected':'')+'>#'+esc(c.name)+'</option>'});
  var cId='gr_'+type+'_'+serverId;
  return '<div style="margin-bottom:16px;">'+
    // Enable toggle
    '<div class="tg-wr" data-fn="toggleGreeting" data-args=\'['+fnData(serverId)+','+fnData(type)+']\'><div class="tg '+(cfg.enabled?'on':'')+'" id="tg_'+type+'_'+serverId+'"></div><div class="tg-lbl"><b style="font-size:14px;">'+typeLabel+' Messages</b><small>When enabled, this message will be sent automatically when someone '+(type==='welcome'?'joins':'leaves')+' the server.</small></div></div>'+
    
    // ── EMBED PREVIEW ──
    '<div style="margin:16px 0;">'+
      '<div class="tw-h" style="font-size:12px;">📋 Live Preview</div>'+
      '<div style="padding:14px;background:rgba(255,255,255,0.01);border:1px solid var(--border);border-top:none;border-radius:0 0 var(--radius-sm) var(--radius-sm);">'+
      '<div id="pv_'+type+'_'+serverId+'" style="background:var(--bg);border-radius:8px;border:1px solid var(--border);overflow:hidden;font-size:13px;line-height:1.5;">'+
        // Colored left border
        '<div style="padding:14px 16px;border-left:4px solid '+(cfg.embedColor||'#5865F2')+';position:relative;">'+
          // Author line
          (cfg.embedAuthor?'<div id="pvA_'+type+'_'+serverId+'" style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-dim);margin-bottom:6px;">'+(cfg.embedAuthorIcon?'<img src="'+cfg.embedAuthorIcon+'" style="width:18px;height:18px;border-radius:50%;object-fit:cover;" data-fn="_hideSelf">':'')+'<span>'+cfg.embedAuthor+'</span></div>':'')+
          // Title
          '<div id="pvT_'+type+'_'+serverId+'" style="font-weight:700;color:#fff;margin-bottom:6px;font-size:15px;">'+(cfg.embedTitle||'✨ Welcome!')+'</div>'+
          // Description
          '<div id="pvD_'+type+'_'+serverId+'" style="color:var(--text-dim);font-size:13px;margin-bottom:8px;">'+(cfg.embedDescription||'Welcome {user} to **{server}**!').replace(/\*\*/g,'<b>').replace(/\*/g,'<i>')+'</div>'+
          // Thumbnail (right side)
          (cfg.embedThumbnail?'<div style="position:absolute;top:14px;right:16px;"><img src="'+cfg.embedThumbnail+'" style="width:50px;height:50px;border-radius:6px;object-fit:cover;" data-fn="_hideSelf"></div>':'')+
          // Image
          (cfg.embedImage?'<div style="margin-top:6px;"><img src="'+cfg.embedImage+'" style="max-width:100%;max-height:140px;border-radius:6px;object-fit:cover;" data-fn="_hideSelf"></div>':'')+
          // Footer
          (cfg.embedFooter?'<div id="pvF_'+type+'_'+serverId+'" style="font-size:11px;color:var(--text-muted);margin-top:8px;padding-top:8px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;">'+(cfg.embedFooterIcon?'<img src="'+cfg.embedFooterIcon+'" style="width:16px;height:16px;border-radius:50%;object-fit:cover;" data-fn="_hideSelf">':'')+'<span>'+cfg.embedFooter+'</span></div>':'')+
        '</div></div></div></div>'+
    
    // ── EMBED DIAGRAM WITH ARROWS ──
    '<div style="margin-bottom:16px;">'+
      '<div class="tw-h" style="font-size:12px;">📐 Embed Structure <span style="font-weight:400;color:var(--text-muted);font-size:11px;">— where each field appears</span></div>'+
      '<div style="padding:14px 16px;background:rgba(255,255,255,0.01);border:1px solid var(--border);border-top:none;border-radius:0 0 var(--radius-sm) var(--radius-sm);">'+
      '<div style="font-size:13px;line-height:1.8;">'+
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><span style="color:var(--accent);font-weight:700;">AUTHOR</span><span style="color:var(--text-muted);">← Author Name + Icon</span></div>'+
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><span style="color:#fff;font-weight:700;">TITLE</span><span style="color:var(--text-muted);">← Embed Title</span></div>'+
        '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:4px;"><span style="color:var(--text-dim);flex-shrink:0;">Description text...</span><span style="color:var(--text-muted);">← Description (main body)</span></div>'+
        '<div style="display:flex;gap:12px;margin-bottom:4px;">'+
          '<div style="display:flex;align-items:center;gap:6px;background:rgba(237,66,69,0.08);border-left:2px solid #ed4245;padding:3px 8px;border-radius:3px;"><span style="color:#ed4245;font-weight:600;">THUMBNAIL</span><span style="color:var(--text-muted);font-size:12px;">← Top-right square</span></div>'+
          '<div style="display:flex;align-items:center;gap:6px;background:rgba(59,165,92,0.08);border-left:2px solid #3ba55c;padding:3px 8px;border-radius:3px;"><span style="color:#3ba55c;font-weight:600;">IMAGE</span><span style="color:var(--text-muted);font-size:12px;">← Large banner below text</span></div>'+
        '</div>'+
        '<div style="display:flex;align-items:center;gap:8px;padding-top:6px;border-top:1px solid var(--border);margin-top:4px;"><span style="color:var(--text-muted);font-weight:600;">FOOTER</span><span style="color:var(--text-muted);font-size:12px;">← Bottom text + icon</span></div>'+
      '</div></div></div>'+
    
    // ── FIELDS ──
    '<div>'+
      // Delivery
      '<div class="grp"><div class="grp-h">📍 Delivery</div>'+
        '<div class="grpf"><label>📢 Channel <small>— where the message will be sent</small></label><select id="grCh_'+type+'_'+serverId+'" data-fn="updatePreview" data-args=\'['+fnData(serverId)+','+fnData(type)+']\'>'+chOpts+'</select></div>'+
        '<div class="grpf"><label>💬 Plain Text <small>— appears above the embed (supports placeholders)</small></label><input type="text" id="grMsg_'+type+'_'+serverId+'" value="'+(cfg.content||'')+'" placeholder="e.g. Welcome {user}!" data-fn="updatePreview" data-args=\'['+fnData(serverId)+','+fnData(type)+']\'></div>'+
      '</div>'+
      // Embed Header
      '<div class="grp"><div class="grp-h">📰 Embed Header</div>'+
        '<div class="grpf"><label>👤 Author Name <small>— small text at the top (leave empty to hide)</small></label><input type="text" id="grA_'+type+'_'+serverId+'" value="'+(cfg.embedAuthor||'')+'" placeholder="e.g. '+(type==='welcome'?'👋 Welcome Bot':'Server Team')+'" data-fn="updatePreview" data-args=\'['+fnData(serverId)+','+fnData(type)+']\'></div>'+
        '<div class="grpf"><label>🖼️ Author Icon <small>— small image next to author name</small></label><input type="url" id="grAI_'+type+'_'+serverId+'" value="'+(cfg.embedAuthorIcon||'')+'" placeholder="https://...icon.png" data-fn="updatePreview" data-args=\'['+fnData(serverId)+','+fnData(type)+']\'></div>'+
        '<div class="grpf"><label>📌 Title <small>— bold header text (shown in bold white)</small></label><input type="text" id="grT_'+type+'_'+serverId+'" value="'+(cfg.embedTitle||'')+'" placeholder="e.g. 👋 '+(type==='welcome'?'Welcome!':'Goodbye!')+'" data-fn="updatePreview" data-args=\'['+fnData(serverId)+','+fnData(type)+']\'></div>'+
      '</div>'+
      // Embed Body
      '<div class="grp"><div class="grp-h">📝 Embed Body</div>'+
        '<div class="grpf"><label>📄 Description <small>— main message content (supports **bold**, *italic*, and placeholders)</small></label><textarea id="grD_'+type+'_'+serverId+'" rows="3" placeholder="e.g. Welcome {user} to **{server}**! We now have {membercount} members!" data-fn="updatePreview" data-args=\'['+fnData(serverId)+','+fnData(type)+']\'>'+(cfg.embedDescription||'')+'</textarea></div>'+
        '<div class="grpf"><label>🎨 Color <small>— thin colored bar on the left side of the embed</small></label><div class="color-row"><input type="color" id="grCo_'+type+'_'+serverId+'" value="'+(cfg.embedColor||'#5865F2')+'" data-fn="grCoPick" data-args=\'[\"@el\"]\' data-type="'+type+'" data-srv="'+serverId+'"><input type="text" id="grCoT_'+type+'_'+serverId+'" value="'+(cfg.embedColor||'#5865F2')+'" data-fn="grCoSet" data-args=\'[\"@el\"]\' data-type="'+type+'" data-srv="'+serverId+'" placeholder="#5865F2"></div></div>'+
        '<div class="grpf"><label>🖼️ Thumbnail <small>— square image in the top-right corner</small></label><input type="url" id="grTh_'+type+'_'+serverId+'" value="'+(cfg.embedThumbnail||'')+'" placeholder="https://...image.png" data-fn="updatePreview" data-args=\'['+fnData(serverId)+','+fnData(type)+']\'></div>'+
        '<div class="grpf"><label>🖼️ Image <small>— large banner image below the description</small></label><input type="url" id="grIm_'+type+'_'+serverId+'" value="'+(cfg.embedImage||'')+'" placeholder="https://...banner.gif" data-fn="updatePreview" data-args=\'['+fnData(serverId)+','+fnData(type)+']\'></div>'+
      '</div>'+
      // Embed Footer
      '<div class="grp"><div class="grp-h">🔻 Embed Footer</div>'+
        '<div class="grpf"><label>📝 Footer Text <small>— small text at the very bottom (leave empty to hide)</small></label><input type="text" id="grF_'+type+'_'+serverId+'" value="'+(cfg.embedFooter||'')+'" placeholder="e.g. Member #{membercount}" data-fn="updatePreview" data-args=\'['+fnData(serverId)+','+fnData(type)+']\'></div>'+
        '<div class="grpf"><label>🖼️ Footer Icon <small>— small image next to footer text</small></label><input type="url" id="grFI_'+type+'_'+serverId+'" value="'+(cfg.embedFooterIcon||'')+'" placeholder="https://...icon.png" data-fn="updatePreview" data-args=\'['+fnData(serverId)+','+fnData(type)+']\'></div>'+
      '</div>'+
    '</div>'+
    // Buttons
    '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">'+
      '<button class="btn" data-fn="saveGreetingConfig" data-args=\'['+fnData(serverId)+','+fnData(type)+']\' style="padding:10px 22px;font-size:13px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> 💾 Save '+typeLabel+' Settings</button>'+
      '<button class="btn btn-s" data-fn="resetGreetingConfig" data-args=\'['+fnData(serverId)+','+fnData(type)+']\' style="padding:10px 18px;font-size:13px;background:rgba(237,66,69,0.12);color:#ed4245;border-color:rgba(237,66,69,0.2);">↺ Reset '+typeLabel+'</button>'+
    '</div></div>';
}

async function loadSrvGreetings(id){const el=document.getElementById('mgmtGreetings');showSkeleton(el,'greetings',2);
  if(!el)return;
  el.innerHTML='<div class="loading"><div class="spin"></div></div>';
  try{
    const [gr,ch]=await Promise.all([
      fetch('/api/server/'+id+'/greetings').then(function(r){return r.json()}),
      fetch('/api/server/'+id+'/channels').then(function(r){return r.json()}).catch(function(){return []})
    ]);
    var w=gr.welcome||{},g=gr.goodbye||{};
    var txtChs=ch.filter(function(c){return c.typeId===0||c.typeId===5});
    el.innerHTML='<div style="display:flex;flex-direction:column;gap:24px;">'+
      '<div class="tw" style="border-color:rgba(59,165,92,0.15);"><div class="tw-h" style="border-bottom-color:rgba(59,165,92,0.1);color:#3ba55c;font-size:14px;">👋 Welcome</div>'+greetFieldsHtml(w,'welcome',id,txtChs)+'</div>'+
      '<div class="tw" style="border-color:rgba(237,66,69,0.15);"><div class="tw-h" style="border-bottom-color:rgba(237,66,69,0.1);color:#ed4245;font-size:14px;">👋 Goodbye</div>'+greetFieldsHtml(g,'goodbye',id,txtChs)+'</div>'+
      '<div class="tw"><div class="tw-h" style="font-size:13px;">📝 Available Placeholders</div>'+
      '<div style="padding:14px;">'+
        '<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 14px;font-size:12px;color:var(--text-dim);">'+
              '<div style="grid-column:1/-1;font-weight:700;color:var(--accent);margin-top:6px;padding-bottom:3px;border-bottom:1px solid var(--border);font-size:11px;letter-spacing:0.5px;text-transform:uppercase;">👤 User</div>'+
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
              // Server
              '<div style="grid-column:1/-1;font-weight:700;color:var(--accent);margin-top:6px;padding-bottom:3px;border-bottom:1px solid var(--border);font-size:11px;letter-spacing:0.5px;text-transform:uppercase;">🏠 Server</div>'+
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
              // Date/Time
              '<div style="grid-column:1/-1;font-weight:700;color:var(--accent);margin-top:6px;padding-bottom:3px;border-bottom:1px solid var(--border);font-size:11px;letter-spacing:0.5px;text-transform:uppercase;">📅 Date / Time</div>'+
              '<code style="font-size:12px;">{date}</code><span>Today\'s date (e.g. 7/21/2026)</span>'+
              '<code style="font-size:12px;">{time}</code><span>Current time (e.g. 3:45 PM)</span>'+
              '<code style="font-size:12px;">{year}</code><span>Current year (e.g. 2026)</span>'+
              // Type-specific
              '<div style="grid-column:1/-1;font-weight:700;color:#3ba55c;margin-top:6px;padding-bottom:3px;border-bottom:1px solid var(--border);font-size:11px;letter-spacing:0.5px;text-transform:uppercase;">👋 Welcome-only</div>'+
              '<code style="font-size:12px;">{joined}</code><span>When they joined (relative time)</span>'+
              '<code style="font-size:12px;">{created_relative}</code><span>Account creation (relative)</span>'+
              '<div style="grid-column:1/-1;font-weight:700;color:#ed4245;margin-top:6px;padding-bottom:3px;border-bottom:1px solid var(--border);font-size:11px;letter-spacing:0.5px;text-transform:uppercase;">👋 Goodbye-only</div>'+
              '<code style="font-size:12px;">{joined}</code><span>When they originally joined</span>'+
              '<code style="font-size:12px;">{duration}</code><span>How long they were in the server</span>'+
              '<code style="font-size:12px;">{left}</code><span>When they left (relative time)</span>'+
            '</div></div></div>';
  }catch{el.innerHTML='<div class="empty"><p>Failed to load greetings config. Make sure the bot has Manage Server permission.</p></div>'}
}

// ═══ GREETINGS: Preview updater ═══

export function updatePreview(serverId,type){
  var el=document.getElementById('pv_'+type+'_'+serverId);
  if(!el)return;
  var title=document.getElementById('grT_'+type+'_'+serverId)?.value||'';
  var desc=document.getElementById('grD_'+type+'_'+serverId)?.value||'';
  var color=document.getElementById('grCoT_'+type+'_'+serverId)?.value||'#5865F2';
  var footer=document.getElementById('grF_'+type+'_'+serverId)?.value||'';
  var footerIcon=document.getElementById('grFI_'+type+'_'+serverId)?.value||'';
  var thumb=document.getElementById('grTh_'+type+'_'+serverId)?.value||'';
  var image=document.getElementById('grIm_'+type+'_'+serverId)?.value||'';
  var author=document.getElementById('grA_'+type+'_'+serverId)?.value||'';
  var authorIcon=document.getElementById('grAI_'+type+'_'+serverId)?.value||'';
  
  var html='<div style="padding:12px 14px;border-left:4px solid '+color+';position:relative;">';
  if(author)html+='<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-dim);margin-bottom:4px;">'+(authorIcon?'<img src="'+authorIcon+'" style="width:16px;height:16px;border-radius:50%;object-fit:cover;" data-fn="_hideSelf">':'')+'<span>'+escapeHtml(author)+'</span></div>';
  html+='<div style="font-weight:700;color:#fff;margin-bottom:4px;">'+(title||'✨ Welcome!')+'</div>';
  html+='<div style="color:var(--text-dim);font-size:11px;margin-bottom:6px;">'+(desc||'Welcome {user} to **{server}**!').replace(/\*\*/g,'<b>').replace(/\*/g,'<i>')+'</div>';
  if(thumb)html+='<div style="position:absolute;top:12px;right:14px;"><img src="'+thumb+'" style="width:40px;height:40px;border-radius:4px;object-fit:cover;" data-fn="_hideSelf"></div>';
  if(image)html+='<div style="margin-top:4px;"><img src="'+image+'" style="max-width:100%;max-height:100px;border-radius:4px;object-fit:cover;" data-fn="_hideSelf"></div>';
  if(footer)html+='<div style="font-size:10px;color:var(--text-muted);margin-top:6px;padding-top:6px;border-top:1px solid var(--border);display:flex;align-items:center;gap:6px;">'+(footerIcon?'<img src="'+footerIcon+'" style="width:14px;height:14px;border-radius:50%;object-fit:cover;" data-fn="_hideSelf">':'')+'<span>'+escapeHtml(footer)+'</span></div>';
  html+='</div>';
  el.innerHTML=html;
}

function escapeHtml(str){
  var div=document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

export async function toggleGreeting(serverId,type){
  const tg=document.getElementById('tg_'+type+'_'+serverId);
  if(!tg)return;
  const enabled=!tg.classList.contains('on');
  try{
    const r=await fetch('/api/server/'+serverId+'/greetings/'+type,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled})});
    const d=await r.json();
    if(d.success)tg.classList.toggle('on',enabled);
  }catch{}
}

export async function saveGreetingConfig(serverId,type){
  const config={
    enabled:document.getElementById('tg_'+type+'_'+serverId)?.classList.contains('on')||false,
    channelId:document.getElementById('grCh_'+type+'_'+serverId)?.value||null,
    content:document.getElementById('grMsg_'+type+'_'+serverId)?.value||null,
    embedTitle:document.getElementById('grT_'+type+'_'+serverId)?.value||null,
    embedDescription:document.getElementById('grD_'+type+'_'+serverId)?.value||null,
    embedColor:document.getElementById('grCoT_'+type+'_'+serverId)?.value||null,
    embedFooter:document.getElementById('grF_'+type+'_'+serverId)?.value||null,
    embedFooterIcon:document.getElementById('grFI_'+type+'_'+serverId)?.value||null,
    embedThumbnail:document.getElementById('grTh_'+type+'_'+serverId)?.value||null,
    embedImage:document.getElementById('grIm_'+type+'_'+serverId)?.value||null,
    embedAuthor:document.getElementById('grA_'+type+'_'+serverId)?.value||null,
    embedAuthorIcon:document.getElementById('grAI_'+type+'_'+serverId)?.value||null,
  };
  try{
    const r=await fetch('/api/server/'+serverId+'/greetings/'+type,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(config)});
    const d=await r.json();
    if(d.success)showToast(type.charAt(0).toUpperCase()+type.slice(1)+' config saved!');
    else showToast('Failed to save',true);
  }catch{showToast('Failed to save',true)}
}

export async function resetGreetingConfig(serverId,type){
  if(!confirm('Reset '+type+' settings to defaults?'))return;
  const defaults=type==='welcome'
    ?{enabled:false,channelId:null,content:null,embedTitle:'👋 Welcome!',embedDescription:'Welcome {user} to **{server}**!',embedColor:'#5865F2',embedFooter:'Member #{membercount}',embedFooterIcon:null,embedThumbnail:null,embedImage:null,embedAuthor:null,embedAuthorIcon:null}
    :{enabled:false,channelId:null,content:null,embedTitle:'👋 Goodbye!',embedDescription:'{user} has left **{server}**.',embedColor:'#E74C3C',embedFooter:'Member #{membercount}',embedFooterIcon:null,embedThumbnail:null,embedImage:null,embedAuthor:null,embedAuthorIcon:null};
  try{
    const r=await fetch('/api/server/'+serverId+'/greetings/'+type,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(defaults)});
    const d=await r.json();
    if(d.success){showToast(type+' reset!');loadSrvGreetings(serverId)}
    else showToast('Failed',true);
  }catch{showToast('Failed',true)}
}

// ═══ Log Channel Config ═══
export async function saveAllLogSettings(serverId){const categories=[];const cats=["messages","reactions","members","roles","server","voice","threads","emojis","bans","invites","stickers","automod","scheduled","stage","webhooks","integrations"];for(const cat of cats){const sel=document.getElementById("logCh-"+cat);if(sel)categories.push({category:cat,channelId:sel.value||null});}try{const r=await fetch("/api/server/"+serverId+"/log/config/batch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({categories})});const d=await r.json();if(d.success){showToast("All log settings saved!");loadSrvLogging(serverId)}else showToast("Save failed",true)}catch{showToast("Save failed",true)}}
export async function addTrackedChannel(serverId){const chId=document.getElementById('trackedChSelect').value;if(!chId)return showToast('Select a channel',true);try{await fetch('/api/server/'+serverId+'/log/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackedChannel:chId,trackedChannels:'add'})});showToast('Added!');loadSrvLogging(serverId)}catch{showToast('Failed',true)}}
export async function removeTrackedChannel(serverId,chId){try{await fetch('/api/server/'+serverId+'/log/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackedChannel:chId,trackedChannels:'remove'})});showToast('Removed!');loadSrvLogging(serverId)}catch{showToast('Failed',true)}}
export async function clearTrackedChannels(serverId){try{await fetch('/api/server/'+serverId+'/log/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackedChannels:'clear'})});showToast('Cleared!');loadSrvLogging(serverId)}catch{showToast('Failed',true)}}

// ═══ Message Search ═══
var msgSearchTimeout=null;
export function onMsgSearchInput(id){if(msgSearchTimeout)clearTimeout(msgSearchTimeout);msgSearchTimeout=setTimeout(function(){loadSrvMessages(id)},300)}
export function msgSearchFilterChange(id){loadSrvMessages(id)}
async function loadSrvMessages(id){var el=document.getElementById('mgmtMessages');var q=document.getElementById('msgSearchInput')?.value||'';var action=document.getElementById('msgSearchFilter')?.value||'all';showSkeleton(el,'msgs',1);try{var url='/api/server/'+id+'/messages?limit=50';if(action!=='all')url+='&action='+action;if(q)url+='&q='+encodeURIComponent(q);var r=await fetch(url),msgs=await r.json();var html='<div style="display:flex;gap:6px;margin-bottom:10px;padding:10px;"><input type="text" id="msgSearchInput" placeholder="Search message content..." value="'+q.replace(/"/g,'&quot;')+'" data-fn="onMsgSearchInput" data-args=\'['+fnData(id)+']\' style="flex:1;padding:8px 12px;background:rgba(255,255,255,0.02);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:12px;outline:none;font-family:inherit;"><select id="msgSearchFilter" data-fn="msgSearchFilterChange" data-args=\'['+fnData(id)+']\' style="padding:8px 10px;background:rgba(255,255,255,0.02);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:11px;font-family:inherit;"><option value="all">All</option><option value="deleted"'+(action==='deleted'?' selected':'')+'>Deleted</option><option value="edited"'+(action==='edited'?' selected':'')+'>Edited</option></select></div>';if(!msgs||!msgs.length){html+='<div class="empty"><p>No messages found.</p></div>';el.innerHTML=html;return}html+=msgs.map(function(m){var time=new Date(m.loggedAt);var timeStr=time.toLocaleDateString()+' '+time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});var actionBadge=m.action==='deleted'?'<span class="tag red">🗑️ Deleted</span>':'<span class="tag yellow">✏️ Edited</span>';var content=m.content?m.content.slice(0,300):'(no content)';if(q&&content.toLowerCase().includes(q.toLowerCase())){var idx=content.toLowerCase().indexOf(q.toLowerCase());var before=content.slice(0,idx);var match=content.slice(idx,idx+q.length);var after=content.slice(idx+q.length);content=esc(before)+'<mark style="background:rgba(88,101,242,0.25);color:#fff;padding:0 2px;border-radius:2px;">'+esc(match)+'</mark>'+esc(after)}else{content=esc(content)}return'<div class="rmd" style="flex-wrap:wrap;"><div style="flex:1;min-width:0;"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><strong style="font-size:12px;">'+esc(m.authorTag)+'</strong> '+actionBadge+' <span style="font-size:10px;color:var(--text-dim);">#'+esc(m.channelName)+'</span></div><div style="font-size:11px;color:var(--text);word-break:break-all;">'+content+'</div><div style="font-size:9px;color:var(--text-muted);margin-top:4px;">'+timeStr+'</div></div></div>'}).join('');el.innerHTML=html}catch{document.getElementById('mgmtMessages').innerHTML='<div class="empty"><p>Failed to load.</p></div>'}}

// ═══ SERVER SETTINGS TAB ═══
// ──── Formerly-inline handlers moved out for CSP compliance ────
// Sync the greeting-embed color pair. Two id layouts exist: grCo_<type>_<srv>
// (color picker) and grCoT_<type>_<srv> (hex text input). The picker mirrors
// into the text field; the text field validates then mirrors back.
export function grCoPick(el){
  var t=document.getElementById('grCoT_'+el.dataset.type+'_'+el.dataset.srv);
  if(t)t.value=el.value;
  updatePreview(el.dataset.srv,el.dataset.type);
}
export function grCoSet(el){
  var c=el.value;
  if(/^#[0-9a-f]{6}$/i.test(c)){
    var p=document.getElementById('grCo_'+el.dataset.type+'_'+el.dataset.srv);
    if(p)p.value=c;
    updatePreview(el.dataset.srv,el.dataset.type);
  }
}
async function loadSrvSettings(id){const el=document.getElementById('mgmtSettings');if(!el)return;showSkeleton(el,'logging',1);try{const r=await fetch('/api/server/'+id),d=await r.json();el.innerHTML='<div class="stg"><label>Command Prefix</label><div class="stg-inl"><input type="text" id="srvPrefixInput" value="'+esc(d.prefix||';')+'" maxlength="5" style="flex:0 0 120px;"><button class="btn btn-s" data-fn="saveSrvSettings" data-args=\'['+fnData(id)+']\' style="padding:9px 14px;font-size:11px;">Save</button></div><div class="stg-hint">Prefix for text commands (default: ;). Max 5 characters, no spaces.</div></div><div class="stg"><label>Embed Color</label><div class="stg-inl"><input type="color" id="srvEmbedColor" value="'+(d.embedColor||'#5865F2')+'" data-fn="srvEmbedSync" data-args=\'[\"@el\"]\' style="flex:0 0 60px;height:36px;padding:2px;"><span style="font-size:12px;color:var(--text-dim);font-family:monospace;">'+esc(d.embedColor||'Bot default')+'</span><label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-dim);margin-left:auto;"><input type="checkbox" id="srvEmbedClear"> Use bot default</label></div><div class="stg-hint">Accent color for this server\u2019s embeds (welcome messages, giveaways, and other embeds that read guild config).</div></div>'}catch{el.innerHTML='<div class="empty"><p>Could not load server settings.</p></div>'}}
export async function saveSrvSettings(id){const prefixEl=document.getElementById('srvPrefixInput'),colorEl=document.getElementById('srvEmbedColor'),clearEl=document.getElementById('srvEmbedClear');if(!prefixEl)return;const prefix=prefixEl.value.trim();const embedColor=clearEl&&clearEl.checked?'':colorEl.value;try{const r=await fetch('/api/server/'+id+'/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefix,embedColor})}),d=await r.json();if(d.success)showToast('Server settings saved!');else showToast(d.error||'Failed to save',true)}catch{showToast('Failed to save settings',true)}}

// ═══ SSE Events ═══
let sseSource=null;
function initSSE(){
  if(sseSource)try{sseSource.close()}catch{}
  if(typeof EventSource==='undefined')return;
  try{
    sseSource=new EventSource('/api/events');
    sseSource.onmessage=function(e){
      try{
        var ev=JSON.parse(e.data);
        if(ev.type==='msg_deleted'||ev.type==='msg_edited'){
          showToast(ev.type==='msg_deleted'?'✉️ Message deleted by '+ev.data.authorTag:'✏️ Message edited by '+ev.data.authorTag);
        }
        if(ev.type==='member_join'||ev.type==='member_leave'){
          loadOv();loadAn();
        }
      }catch{}
    };
    sseSource.onerror=function(){
      setTimeout(initSSE,5000);
    };
  }catch{}
}

window.addEventListener('beforeunload',()=>{if(bgAnimId)cancelAnimationFrame(bgAnimId)});

checkAuth().then(async ok=>{if(!ok)return;initThemes();initPalettes();initBgStyles();applyCompactPref();await loadCfg();startBg(cfg.backgroundStyle||'dots');await loadOv();await loadAn();await loadServers();await loadAct();await loadCommands();await loadRm();await loadSys();await loadTickets();loadCmdUsage();loadBrand();stRf();initSSE()});
