
// ═══ BACKGROUND ENGINES ═══
const bgCanvas=document.getElementById('bgCanvas'),bgCtx=bgCanvas.getContext('2d');
let bgEngine=null,bgStyle='dots',bgAnimId=null;
const BG_STYLES=[
  {id:'dots',name:'Dots',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>'},
  {id:'shapes',name:'Shapes',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="7" height="7" rx="1"/><circle cx="17" cy="7.5" r="3.5"/><polygon points="12,22 8,14 16,14"/></svg>'},
  {id:'glitch',name:'Glitch',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="4 7 4 4 20 4 20 7"/><polyline points="4 20 4 17 20 17 20 20"/><line x1="10" y1="4" x2="6" y2="17"/><line x1="16" y1="4" x2="18" y2="17"/></svg>'},
  {id:'liquid',name:'Liquid',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2C7.5 6 4 9 4 13c0 4.4 3.6 8 8 8s8-3.6 8-8c0-4-3.5-7-8-11z"/></svg>'},
  {id:'grid',name:'Grid',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>'},
];
const bgMouse={x:window.innerWidth/2,y:window.innerHeight/2};
document.addEventListener('mousemove',e=>{bgMouse.x=e.clientX;bgMouse.y=e.clientY});
document.addEventListener('mouseleave',()=>{bgMouse.x=-9999;bgMouse.y=-9999});
function rsBg(){const d=Math.min(window.devicePixelRatio||1,2);bgCanvas.width=window.innerWidth*d;bgCanvas.height=window.innerHeight*d;bgCanvas.style.width=window.innerWidth+'px';bgCanvas.style.height=window.innerHeight+'px';bgCtx.setTransform(d,0,0,d,0,0)}
let engState={};

function engDots(){const w=window.innerWidth,h=window.innerHeight,sp=28;engState.dots=[];for(let r=0;r<Math.floor(h/sp);r++)for(let c=0;c<Math.floor(w/sp);c++){const x=(w%sp)/2+c*sp+sp/2,y=(h%sp)/2+r*sp+sp/2;engState.dots.push({x,y,ox:x,oy:y})}const a=()=>getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim()||'88,101,242';return function(){bgCtx.clearRect(0,0,w,h);const ac=a();for(const d of engState.dots){const dx=bgMouse.x-d.ox,dy=bgMouse.y-d.oy,di=Math.sqrt(dx*dx+dy*dy),mD=120;let ox=0,oy=0;if(di<mD){const f=(1-di/mD)*18;const a2=Math.atan2(dy,dx);ox=-Math.cos(a2)*f;oy=-Math.sin(a2)*f}d.x+=(d.ox+ox-d.x)*0.1;d.y+=(d.oy+oy-d.y)*0.1;bgCtx.beginPath();bgCtx.arc(d.x,d.y,1,0,Math.PI*2);bgCtx.fillStyle=`rgba(${ac},${0.12+0.2*(1-Math.min(di/300,1))})`;bgCtx.fill();if(di<mD){bgCtx.beginPath();bgCtx.arc(d.x,d.y,1.6,0,Math.PI*2);bgCtx.fillStyle=`rgba(${ac},${(1-di/mD)*0.4})`;bgCtx.fill()}}}}
function engShapes(){const w=window.innerWidth,h=window.innerHeight,sp=48,sz=10;engState.shapes=[];for(let r=0;r<Math.ceil(h/sp)+2;r++)for(let c=0;c<Math.ceil(w/sp)+2;c++){engState.shapes.push({x:c*sp,y:r*sp,ox:c*sp,oy:r*sp,v:0.5+Math.random()*0.5,ph:Math.random()*Math.PI*2})}const a=()=>getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim()||'88,101,242';let t=0;return function(){t+=0.008;bgCtx.clearRect(0,0,w,h);const ac=a();for(const s of engState.shapes){const dx=bgMouse.x-s.ox,dy=bgMouse.y-s.oy,di=Math.sqrt(dx*dx+dy*dy),mD=160;let ox=0,oy=0,sc=1;if(di<mD){const f=1-di/mD;const a2=Math.atan2(dy,dx);ox=-Math.cos(a2)*f*24;oy=-Math.sin(a2)*f*24;sc=1+f*0.4}s.x+=(s.ox+ox-s.x)*0.06;s.y+=(s.oy+oy-s.y)*0.06;const ry=s.y+Math.sin(t*s.v+s.ph)*1.5;bgCtx.save();bgCtx.translate(s.x,ry);bgCtx.scale(sc,sc);bgCtx.globalAlpha=0.18+0.1*Math.sin(t*0.5+s.ph);bgCtx.strokeStyle=`rgba(${ac},0.3)`;bgCtx.lineWidth=0.8;bgCtx.beginPath();bgCtx.arc(0,0,sz/2,0,Math.PI*2);bgCtx.stroke();bgCtx.restore()}}}
function engGlitch(){const w=window.innerWidth,h=window.innerHeight,cols=Math.ceil(w/16),rows=Math.ceil(h/20),cs='ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789';engState.glitch=[];for(let i=0;i<cols*rows;i++)engState.glitch.push({char:cs[Math.floor(Math.random()*cs.length)],color:'rgba(88,101,242,0.05)',target:cs[Math.floor(Math.random()*cs.length)],prog:1});return function(){const a=()=>getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim()||'88,101,242';bgCtx.clearRect(0,0,w,h);const ac=a();for(let i=0;i<engState.glitch.length;i++){const l=engState.glitch[i];if(l.prog<1){l.prog+=0.05;if(l.prog>=1){l.char=l.target;l.color=`rgba(${ac},0.08)`}else l.color=`rgba(${ac},${0.03+l.prog*0.05})`}}const up=Math.max(1,Math.floor(engState.glitch.length*0.03));for(let i=0;i<up;i++){const idx=Math.floor(Math.random()*engState.glitch.length);engState.glitch[idx].target=cs[Math.floor(Math.random()*cs.length)];engState.glitch[idx].prog=0;engState.glitch[idx].color=`rgba(${ac},0.3)`}bgCtx.font='13px monospace';bgCtx.textBaseline='top';for(let i=0;i<engState.glitch.length;i++){const x=(i%cols)*16,y=Math.floor(i/cols)*20;bgCtx.fillStyle=engState.glitch[i].color;bgCtx.fillText(engState.glitch[i].char,x,y)}}}
function engLiquid(){const w=window.innerWidth,h=window.innerHeight;engState.lqTime=0;return function(){engState.lqTime+=0.01;bgCtx.clearRect(0,0,w,h);const a=()=>getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim()||'88,101,242',step=18;for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){const dx=bgMouse.x-x,dy=bgMouse.y-y,di=Math.sqrt(dx*dx+dy*dy),dist=Math.sin(x*0.008+engState.lqTime)*4+Math.cos(y*0.008+engState.lqTime*1.3)*4,pull=di<180?(1-di/180)*12:0,offX=dist+Math.cos(dy*0.01+engState.lqTime*0.7)*pull,offY=Math.sin(dy*0.008+engState.lqTime*1.1)*4+Math.sin(dx*0.01+engState.lqTime*0.5)*pull,sz=1.5+Math.sin(x*0.01+y*0.01+engState.lqTime)*0.5;bgCtx.beginPath();bgCtx.arc(x+offX,y+offY,sz,0,Math.PI*2);bgCtx.fillStyle=`rgba(${a()},0.07)`;bgCtx.fill()}}}
function engGrid(){const w=window.innerWidth,h=window.innerHeight;return function(){bgCtx.clearRect(0,0,w,h);const a=()=>getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim()||'88,101,242',cx=window.innerWidth/2,cy=window.innerHeight/2,mx=(bgMouse.x-cx)/cx,my=(bgMouse.y-cy)/cy,step=40;for(let x=0;x<w;x+=step){const off=mx*24*(1-Math.abs(x-cx)/cx);bgCtx.beginPath();bgCtx.moveTo(x+off,0);bgCtx.lineTo(x+off,h);bgCtx.strokeStyle=`rgba(${a()},0.03)`;bgCtx.lineWidth=0.5;bgCtx.stroke()}for(let y=0;y<h;y+=step){const off=my*24*(1-Math.abs(y-cy)/cy);bgCtx.beginPath();bgCtx.moveTo(0,y+off);bgCtx.lineTo(w,y+off);bgCtx.strokeStyle=`rgba(${a()},0.03)`;bgCtx.lineWidth=0.5;bgCtx.stroke()}const grd=bgCtx.createRadialGradient(bgMouse.x,bgMouse.y,0,bgMouse.x,bgMouse.y,200);grd.addColorStop(0,`rgba(${a()},0.05)`);grd.addColorStop(1,'transparent');bgCtx.fillStyle=grd;bgCtx.fillRect(0,0,w,h)}}
const ENGINES={dots:engDots,shapes:engShapes,glitch:engGlitch,liquid:engLiquid,grid:engGrid};
function startBg(style){if(bgAnimId){cancelAnimationFrame(bgAnimId);bgAnimId=null}bgStyle=style||'dots';const fn=ENGINES[bgStyle];if(!fn){bgCtx.clearRect(0,0,bgCanvas.width,bgCanvas.height);return}rsBg();bgEngine=fn();!function l(){bgEngine();bgAnimId=requestAnimationFrame(l)}()}
function switchBg(style){bgStyle=style;startBg(style)}

// ═══ AMBIENT + CARD GLOW ═══
document.addEventListener('mousemove',e=>{
  document.documentElement.style.setProperty('--mx',e.clientX/window.innerWidth);
  document.documentElement.style.setProperty('--my',e.clientY/window.innerHeight);
  if(cfg.cardGlow!==false)document.querySelectorAll('.card').forEach(c=>{
    const r=c.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,d=Math.sqrt(dx*dx+dy*dy),i=Math.max(0,1-d/250),a2=Math.atan2(dy,dx)*(180/Math.PI)+90;
    c.style.setProperty('--glow-int',i.toFixed(3));c.style.setProperty('--glow-ang',a2.toFixed(1)+'deg')
  })
});

// ═══ SCROLL REVEAL ═══
const srObs=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');srObs.unobserve(e.target)}})},{threshold:0.1});

// ═══ ANIMATED COUNTER ═══
function animCount(el,target,dur=600+Math.random()*200){
  const start=parseInt(el.textContent.replace(/,/g,'').replace(/[^0-9-]/g,''))||0,t0=performance.now();
  !function step(t){const p=Math.min((t-t0)/dur,1),e=1-Math.pow(1-p,3),v=Math.round(start+(target-start)*e);el.textContent=v.toLocaleString();if(p<1)requestAnimationFrame(step)}(performance.now())
}

// ═══ EXPORT ═══
async function exportStats(){try{const r=await fetch('/api/stats/export'),d=await r.json();const blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='growth-data-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);showToast('Data exported!')}catch{showToast('Export failed',true)}}

// ═══ LAST REFRESHED ═══
function updateRefreshTimestamp(sectionId){
  const el=document.getElementById('rfsh-'+sectionId);
  if(!el)return;
  const now=new Date();
  const t=now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  el.textContent='\u23F3 Updated '+t;
}

// ═══ COMMAND USAGE CHART ═══
async function loadCmdUsage(){
  const el=document.getElementById('cmdUsageChart');
  if(!el)return;
  try{
    const r=await fetch('/api/stats/commands'),d=await r.json();
    if(!d.top||!d.top.length){el.innerHTML='<div class="empty"><p>No command data yet.</p><p class="empty-act">Usage data will appear as people use commands.</p></div>';return}
    const top=d.top.slice(0,10);
    const maxCount=top[0].count;
    const ac=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#5865F2';
    const h=top.length*36+20;
    var bars=top.map(function(c,i){
      var pct=Math.max(3,(c.count/maxCount)*100);
      return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;height:28px;">'+
        '<span style="width:90px;font-size:10px;color:var(--text-dim);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0;font-family:monospace;">'+c.command+'</span>'+
        '<div style="flex:1;height:18px;background:rgba(255,255,255,0.03);border-radius:4px;overflow:hidden;position:relative;">'+
        '<div style="height:100%;width:'+pct+'%;background:'+ac+';border-radius:4px;opacity:0.7;transition:width 0.6s ease;"></div>'+
        '<span style="position:absolute;right:6px;top:1px;font-size:9px;color:#fff;font-family:monospace;font-weight:600;">'+c.count.toLocaleString()+'</span>'+
        '</div></div>';
    }).join('');
    el.innerHTML='<div style="padding:2px 0;">'+bars+'<div style="margin-top:8px;font-size:10px;color:var(--text-muted);display:flex;justify-content:space-between;"><span>'+((d.total||0)).toLocaleString()+' total uses</span><span>'+((d.users||0)).toLocaleString()+' unique users</span></div></div>';
  }catch{el.innerHTML='<div class="empty"><p>Could not load command data.</p></div>'}
}

// ═══ CONFIG EXPORT ═══
async function exportConfig(){
  try{
    const r=await fetch('/api/dash/config'),d=await r.json();
    const blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='dashboard-config-'+new Date().toISOString().slice(0,10)+'.json';a.click();
    URL.revokeObjectURL(url);showToast('Config exported!')
  }catch{showToast('Export failed',true)}
}
async function exportBotConfig(){
  try{
    const r=await fetch('/api/status'),status=await r.json();
    const r2=await fetch('/api/servers'),servers=await r2.json();
    const r3=await fetch('/api/stats/aggregate'),stats=await r3.json();
    const data={exportedAt:new Date().toISOString(),status,serverCount:servers.length,servers:servers.map(function(s){return{id:s.id,name:s.name,memberCount:s.memberCount}}),stats:{totalJoins:stats.totalJoins,totalLeaves:stats.totalLeaves,netGrowth:stats.netGrowth}};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='bot-config-'+new Date().toISOString().slice(0,10)+'.json';a.click();
    URL.revokeObjectURL(url);showToast('Bot config exported!')
  }catch{showToast('Export failed',true)}
}

// ═══ APP STATE ═══
let curSrv=null,cfg={},rInt=5,rTimer=null,allServers=[],darkMode=true;
const THEMES=[
  {name:'Purple',color:'#5865F2'},{name:'Blue',color:'#3b82f6'},{name:'Green',color:'#10b981'},
  {name:'Cyan',color:'#06b6d4'},{name:'Pink',color:'#ec4899'},{name:'Orange',color:'#f97316'},
  {name:'Red',color:'#ef4444'},{name:'White',color:'#e8e8ee'},{name:'Amber',color:'#f59e0b'},
  {name:'Lime',color:'#84cc16'},{name:'Teal',color:'#14b8a6'},{name:'Rose',color:'#f43f5e'},
];
function showToast(msg,isErr){const t=document.getElementById('toast');t.textContent=msg;t.className='toast'+(isErr?' err':'')+' show';setTimeout(()=>t.classList.remove('show'),2500)}
async function checkAuth(){try{const r=await fetch('/api/status');if(r.status===401){window.location.href='/login';return false}return r.ok}catch{return false}}
async function logout(){await fetch('/api/logout',{method:'POST'});window.location.href='/login'}
function showSec(n){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.notch-link').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.notch-mobile-link').forEach(s=>s.classList.remove('active'));
  const sec=document.getElementById('sec-'+n);sec.classList.add('active');
  sec.classList.remove('sec-enter');void sec.offsetWidth;sec.classList.add('sec-enter');
  const nav=document.querySelector('.notch-link[data-sec="'+n+'"]');if(nav)nav.classList.add('active');
  const mnav=document.querySelector('.notch-mobile-link[data-sec="'+n+'"]');if(mnav)mnav.classList.add('active');
  setTimeout(()=>{document.querySelectorAll('#sec-'+n+' .sr').forEach(el=>srObs.observe(el))},50)
}

// ═══ CONFIG ═══
async function loadCfg(){try{const r=await fetch('/api/dash/config');cfg=await r.json();applyCfg(cfg)}catch{}}
function applyCfg(c){
  if(c.accentColor){const h=c.accentColor.replace('#',''),r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);document.documentElement.style.setProperty('--accent',c.accentColor);document.documentElement.style.setProperty('--accent-rgb',r+','+g+','+b);document.getElementById('dashColor').value=c.accentColor;document.getElementById('colorVal').textContent=c.accentColor}
  if(c.title){document.getElementById('dashTitle').value=c.title;document.getElementById('dashTitlePg').textContent=c.title}
  if(c.refreshInterval){document.getElementById('dashRefresh').value=c.refreshInterval;rInt=c.refreshInterval;if(rTimer){clearInterval(rTimer);stRf()}}
  if(c.showWidgets)document.querySelectorAll('.tg').forEach(t=>{const w=t.dataset.w;if(w&&c.showWidgets[w]===false)t.classList.remove('on')});
  if(c.cardStyle){document.getElementById('dashCardStyle').value=c.cardStyle;document.querySelectorAll('.card').forEach(ca=>{ca.classList.toggle('card-solid',c.cardStyle==='solid');ca.classList.toggle('card-border',c.cardStyle==='border')})}
  if(c.layoutDensity){document.getElementById('dashDensity').value=c.layoutDensity;document.documentElement.style.setProperty('--layout-dense',c.layoutDensity==='compact'?'0.7':c.layoutDensity==='comfortable'?'1.2':'1')}
  if(c.backgroundImage&&c.backgroundType==='url'){document.getElementById('dashBgUrl').value=c.backgroundImage;const bg=document.getElementById('bgOverlay');bg.style.backgroundImage='url('+c.backgroundImage+')';bg.className='bg-overlay active'+(c.backgroundBlur&&c.backgroundBlur!=='0'?' blur-'+c.backgroundBlur:'')}
  if(c.backgroundBlur)document.getElementById('dashBgBlur').value=c.backgroundBlur;
  if(c.backgroundType){document.getElementById('bgType').value=c.backgroundType;const t=c.backgroundType;document.getElementById('bgUrlWrap').style.display=t==='url'?'':'none';document.getElementById('bgUploadWrap').style.display=t==='upload'?'':'none'}
  if(c.backgroundStyle){bgStyle=c.backgroundStyle;document.querySelectorAll('.bg-style-opt').forEach(e=>e.classList.toggle('active',e.dataset.bg===c.backgroundStyle));if(!document.getElementById('sec-settings').classList.contains('active'))switchBg(c.backgroundStyle)}
  if(c.darkMode===false){darkMode=false;applyTheme(false)}else{darkMode=true;applyTheme(true)}
  // Restore dashboard look
  if(c.dashboardLook)setLook(c.dashboardLook);
  // New settings
  if(c.botAvatarUrl){document.getElementById('dashAvatarUrl').value=c.botAvatarUrl}
  if(c.animationPreset){document.getElementById('dashAnimPreset').value=c.animationPreset;const speeds={subtle:0.7,smooth:1,energetic:1.3};const dur=speeds[c.animationPreset]||1;document.documentElement.style.setProperty('--anim-speed',dur)}
  if(c.animationSpeed){document.getElementById('dashAnimSpeed').value=c.animationSpeed;document.documentElement.style.setProperty('--anim-speed',c.animationSpeed)}
  if(c.cardGlow===false)document.querySelectorAll('.card').forEach(ca=>{ca.style.setProperty('--glow-int','0')});
  if(c.ambientLight===false)document.getElementById('ambient').style.display='none';else document.getElementById('ambient').style.display=''
}
function previewColor(h){const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);document.documentElement.style.setProperty('--accent',h);document.documentElement.style.setProperty('--accent-rgb',r+','+g+','+b);document.getElementById('dashColor').value=h;document.getElementById('colorVal').textContent=h}
function previewTitle(v){document.getElementById('dashTitlePg').textContent=v||'Overview'}
function applyTheme(isDark){document.body.classList.toggle('light-mode',!isDark);darkMode=isDark;const lb=document.getElementById('themeLabel'),ti=document.getElementById('themeIcon'),tg=document.getElementById('themeToggle'),nti=document.getElementById('ntThemeIcon'),ntl=document.getElementById('ntMobileThemeLabel');if(lb)lb.textContent=isDark?'Light Mode':'Dark Mode';if(ti)ti.innerHTML=isDark?'<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>':'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';if(tg)tg.classList.toggle('on',isDark);if(nti)nti.innerHTML=isDark?'<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>':'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';if(ntl)ntl.textContent=isDark?'Light Mode':'Dark Mode'}
function toggleTheme(){applyTheme(!darkMode)}
function toggleMobileMenu(){const menu=document.getElementById('notchMobileMenu'),btn=document.getElementById('notchMobileBtn');if(!menu||!btn)return;menu.classList.toggle('open');btn.querySelector('.notch-hamburger').style.display=menu.classList.contains('open')?'none':'';btn.querySelector('.notch-close').style.display=menu.classList.contains('open')?'':'none'}
function applyPreset(idx){const t=THEMES[idx];previewColor(t.color);document.getElementById('themeGrid').querySelectorAll('.thm-pick').forEach((e,i)=>e.classList.toggle('active',i===idx))}
function toggleBgType(){const t=document.getElementById('bgType').value;document.getElementById('bgUrlWrap').style.display=t==='url'?'':'none';document.getElementById('bgUploadWrap').style.display=t==='upload'?'':'none'}
function previewBgBlur(v){const bg=document.getElementById('bgOverlay');bg.className='bg-overlay active'+(v&&v!=='0'?' blur-'+v:'')}
function previewBg(){const url=document.getElementById('dashBgUrl').value,blur=document.getElementById('dashBgBlur').value;if(url&&url.startsWith('http')){document.getElementById('bgPreview').style.backgroundImage='url('+url+')';document.getElementById('bgPreview').className='bg-pv loaded';const bg=document.getElementById('bgOverlay');bg.style.backgroundImage='url('+url+')';bg.className='bg-overlay active'+(blur&&blur!=='0'?' blur-'+blur:'')}else{document.getElementById('bgPreview').style.backgroundImage='';document.getElementById('bgPreview').className='bg-pv';document.getElementById('bgPreview').textContent='No background set.'}}
async function uploadBgFile(inp){const file=inp.files[0];if(!file)return;const fd=new FormData();fd.append('background',file);try{const r=await fetch('/api/upload',{method:'POST',body:fd}),d=await r.json();if(d.success){document.getElementById('dashBgUrl').value=d.url;document.getElementById('bgPreview').style.backgroundImage='url('+d.url+')';document.getElementById('bgPreview').className='bg-pv loaded';const bg=document.getElementById('bgOverlay');bg.style.backgroundImage='url('+d.url+')';bg.className='bg-overlay active'+(document.getElementById('dashBgBlur').value!=='0'?' blur-'+document.getElementById('dashBgBlur').value:'');document.getElementById('bgType').value='upload';showToast('Uploaded!')}else showToast('Upload failed',true)}catch{showToast('Upload failed',true)}}
function togW(el){el.querySelector('.tg').classList.toggle('on')}
function getShowWidgets(){const w={};document.querySelectorAll('.tg').forEach(t=>{if(t.dataset.w)w[t.dataset.w]=t.classList.contains('on')});return w}
async function saveSettings(){
  const bgSel=document.querySelector('.bg-style-opt.active');
  const cfg2={
    accentColor:document.getElementById('dashColor').value,title:document.getElementById('dashTitle').value||'Dashboard',
    backgroundImage:document.getElementById('dashBgUrl').value||null,backgroundType:document.getElementById('bgType').value,
    backgroundBlur:document.getElementById('dashBgBlur').value,backgroundStyle:bgSel?bgSel.dataset.bg:'dots',
    cardStyle:document.getElementById('dashCardStyle').value,layoutDensity:document.getElementById('dashDensity').value,
    refreshInterval:parseInt(document.getElementById('dashRefresh').value),showWidgets:getShowWidgets(),darkMode:darkMode,
    animationPreset:document.getElementById('dashAnimPreset').value,animationSpeed:parseFloat(document.getElementById('dashAnimSpeed').value),
    cardGlow:document.getElementById('glowToggle').classList.contains('on'),ambientLight:document.getElementById('ambientToggle').classList.contains('on'),
    botAvatarUrl:document.getElementById('dashAvatarUrl').value||null,
    dashboardLook:cfg.dashboardLook||'neo',
  };
  try{const r=await fetch('/api/dash/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cfg2)}),d=await r.json();if(d.success){applyCfg(d.config);showToast('Settings saved!')}}catch{showToast('Failed to save',true)}
}
function initThemes(){const g=document.getElementById('themeGrid');THEMES.forEach((t,i)=>{const d=document.createElement('div');d.className='thm-pick'+(!i?' active':'');d.style.background=t.color;d.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';d.onclick=()=>applyPreset(i);g.appendChild(d)})}
function initBgStyles(){const g=document.getElementById('bgStyleGrid');BG_STYLES.forEach((s,i)=>{const d=document.createElement('button');d.className='bg-style-opt'+(i===0?' active':'');d.dataset.bg=s.id;d.innerHTML=s.icon+'<span>'+s.name+'</span>';d.onclick=function(){g.querySelectorAll('.bg-style-opt').forEach(e=>e.classList.remove('active'));this.classList.add('active');switchBg(s.id)};g.appendChild(d)})}

// ═══ SKELETON HELPER ═══
const SKELETONS={
  servers:'<div class="sk" style="display:flex;gap:14px;align-items:center;padding:14px 18px;"><div class="sk-line" style="width:36px;height:36px;border-radius:10px;flex-shrink:0;"></div><div style="flex:1;"><div class="sk-line w60 h16"></div><div class="sk-line w40" style="margin-top:6px;"></div></div><div class="sk-line" style="width:44px;height:20px;border-radius:6px;"></div></div><div class="sk" style="display:flex;gap:14px;align-items:center;padding:14px 18px;"><div class="sk-line" style="width:36px;height:36px;border-radius:10px;flex-shrink:0;"></div><div style="flex:1;"><div class="sk-line w50 h16"></div><div class="sk-line w30" style="margin-top:6px;"></div></div><div class="sk-line" style="width:44px;height:20px;border-radius:6px;"></div></div><div class="sk" style="display:flex;gap:14px;align-items:center;padding:14px 18px;"><div class="sk-line" style="width:36px;height:36px;border-radius:10px;flex-shrink:0;"></div><div style="flex:1;"><div class="sk-line w70 h16"></div><div class="sk-line w40" style="margin-top:6px;"></div></div><div class="sk-line" style="width:44px;height:20px;border-radius:6px;"></div></div>',
  'srv-detail':'<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;"><div class="sk-line" style="width:48px;height:48px;border-radius:12px;"></div><div style="flex:1;"><div class="sk-line w50 h20"></div><div class="sk-line w30" style="margin-top:4px;"></div></div></div><div class="grid grid-4"><div class="sk"><div class="sk-line w40"></div><div class="sk-line w60 h24" style="margin-top:6px;"></div></div><div class="sk"><div class="sk-line w40"></div><div class="sk-line w50 h24" style="margin-top:6px;"></div></div><div class="sk"><div class="sk-line w40"></div><div class="sk-line w30 h24" style="margin-top:6px;"></div></div><div class="sk"><div class="sk-line w40"></div><div class="sk-line w40 h24" style="margin-top:6px;"></div></div></div><div class="sk"><div class="sk-line w40 h16"></div><div class="sk-line w80" style="margin-top:10px;height:80px;border-radius:8px;"></div></div><div class="sk" style="margin-top:16px;"><div class="sk-line" style="width:200px;height:30px;border-radius:8px;"></div></div>',
  roles:'<div class="sk" style="display:flex;align-items:center;gap:10px;padding:8px 12px;"><div class="sk-line" style="width:10px;height:10px;border-radius:50%;"></div><div style="flex:1;"><div class="sk-line w40 h14"></div><div class="sk-line w25" style="margin-top:3px;"></div></div><div class="sk-line" style="width:60px;height:14px;"></div></div><div class="sk" style="display:flex;align-items:center;gap:10px;padding:8px 12px;"><div class="sk-line" style="width:10px;height:10px;border-radius:50%;"></div><div style="flex:1;"><div class="sk-line w50 h14"></div><div class="sk-line w20" style="margin-top:3px;"></div></div><div class="sk-line" style="width:60px;height:14px;"></div></div><div class="sk" style="display:flex;align-items:center;gap:10px;padding:8px 12px;"><div class="sk-line" style="width:10px;height:10px;border-radius:50%;"></div><div style="flex:1;"><div class="sk-line w35 h14"></div><div class="sk-line w30" style="margin-top:3px;"></div></div><div class="sk-line" style="width:60px;height:14px;"></div></div>',
  act:'<div class="sk" style="display:flex;align-items:center;gap:10px;padding:8px 12px;"><div class="sk-line" style="width:28px;height:28px;border-radius:6px;"></div><div style="flex:1;"><div class="sk-line w70 h14"></div></div><div class="sk-line" style="width:40px;height:10px;"></div></div><div class="sk" style="display:flex;align-items:center;gap:10px;padding:8px 12px;"><div class="sk-line" style="width:28px;height:28px;border-radius:6px;"></div><div style="flex:1;"><div class="sk-line w50 h14"></div></div><div class="sk-line" style="width:40px;height:10px;"></div></div><div class="sk" style="display:flex;align-items:center;gap:10px;padding:8px 12px;"><div class="sk-line" style="width:28px;height:28px;border-radius:6px;"></div><div style="flex:1;"><div class="sk-line w60 h14"></div></div><div class="sk-line" style="width:40px;height:10px;"></div></div>',
  rmd:'<div class="sk" style="display:flex;align-items:center;gap:10px;padding:10px 14px;"><div class="sk-line" style="width:40px;height:14px;"></div><div class="sk-line w70 h14" style="flex:1;"></div></div><div class="sk" style="display:flex;align-items:center;gap:10px;padding:10px 14px;"><div class="sk-line" style="width:40px;height:14px;"></div><div class="sk-line w50 h14" style="flex:1;"></div></div><div class="sk" style="display:flex;align-items:center;gap:10px;padding:10px 14px;"><div class="sk-line" style="width:40px;height:14px;"></div><div class="sk-line w60 h14" style="flex:1;"></div></div>',
  msgs:'<div style="display:flex;gap:6px;margin-bottom:10px;padding:10px;"><div class="sk-line" style="flex:1;height:34px;border-radius:8px;"></div><div class="sk-line" style="width:80px;height:34px;border-radius:8px;"></div></div><div class="sk" style="display:flex;padding:10px 14px;flex-wrap:wrap;"><div style="flex:1;"><div class="sk-line w40 h14"></div><div class="sk-line w80" style="margin-top:4px;"></div><div class="sk-line w30" style="margin-top:4px;"></div></div></div><div class="sk" style="display:flex;padding:10px 14px;flex-wrap:wrap;"><div style="flex:1;"><div class="sk-line w50 h14"></div><div class="sk-line w70" style="margin-top:4px;"></div><div class="sk-line w25" style="margin-top:4px;"></div></div></div>',
  channels:'<div class="sk" style="display:flex;align-items:center;gap:10px;padding:8px 12px;"><div class="sk-line" style="width:40px;height:18px;border-radius:4px;"></div><div style="flex:1;"><div class="sk-line w50 h14"></div></div><div class="sk-line" style="width:50px;height:12px;"></div></div><div class="sk" style="display:flex;align-items:center;gap:10px;padding:8px 12px;"><div class="sk-line" style="width:40px;height:18px;border-radius:4px;"></div><div style="flex:1;"><div class="sk-line w60 h14"></div></div><div class="sk-line" style="width:50px;height:12px;"></div></div>',
  audit:'<div class="sk" style="display:flex;align-items:center;gap:10px;padding:8px 12px;"><div class="sk-line" style="width:24px;height:24px;border-radius:6px;"></div><div style="flex:1;"><div class="sk-line w60 h14"></div></div><div class="sk-line" style="width:40px;height:10px;"></div></div><div class="sk" style="display:flex;align-items:center;gap:10px;padding:8px 12px;"><div class="sk-line" style="width:24px;height:24px;border-radius:6px;"></div><div style="flex:1;"><div class="sk-line w50 h14"></div></div><div class="sk-line" style="width:40px;height:10px;"></div></div>',
  logging:'<div class="tw"><div class="tw-h" style="background:transparent;"><div class="sk-line w30 h14"></div></div><div style="padding:10px;"><div class="sk" style="display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:4px;"><div class="sk-line" style="width:20px;height:20px;"></div><div class="sk-line" style="width:60px;height:20px;"></div><div class="sk-line" style="flex:1;height:28px;"></div></div><div class="sk" style="display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:4px;"><div class="sk-line" style="width:20px;height:20px;"></div><div class="sk-line" style="width:60px;height:20px;"></div><div class="sk-line" style="flex:1;height:28px;"></div></div><div class="sk" style="display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:4px;"><div class="sk-line" style="width:20px;height:20px;"></div><div class="sk-line" style="width:60px;height:20px;"></div><div class="sk-line" style="flex:1;height:28px;"></div></div></div></div>',
  greetings:'<div class="sk" style="padding:12px;"><div class="sk-line w40 h14"></div><div class="sk-line w80" style="margin-top:8px;height:36px;border-radius:8px;"></div></div>',
  commands:'<div class="sk" style="padding:12px 16px;"><div class="sk-line w30 h16"></div></div><div class="sk" style="padding:0;margin-bottom:12px;"><div style="padding:12px 16px;display:flex;gap:6px;"><div class="sk-line" style="width:80px;height:14px;"></div><div class="sk-line" style="width:40px;height:14px;margin-left:auto;"></div><div class="sk-line" style="width:50px;height:14px;"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px 12px 12px;"><div class="sk"><div class="sk-line w40 h14"></div><div class="sk-line w80" style="margin-top:4px;"></div></div><div class="sk"><div class="sk-line w50 h14"></div><div class="sk-line w70" style="margin-top:4px;"></div></div><div class="sk"><div class="sk-line w45 h14"></div><div class="sk-line w60" style="margin-top:4px;"></div></div><div class="sk"><div class="sk-line w55 h14"></div><div class="sk-line w75" style="margin-top:4px;"></div></div></div></div>',
};
function showSkeleton(el,type,count){count=count||3;if(!SKELETONS[type]){el.innerHTML='<div class="sk"><div class="sk-line w80 h16"></div><div class="sk-line w60" style="margin-top:8px;"></div><div class="sk-line w40" style="margin-top:6px;"></div></div>';return}var html='';for(var i=0;i<count;i++)html+=SKELETONS[type];el.innerHTML=html}

// ═══ TIME SINCE HELPER ═══
function timeSince(ts){if(!ts||typeof ts!=='number')return'';const d=Date.now()-ts;if(d<60000)return Math.floor(d/1000)+'s ago';if(d<3600000)return Math.floor(d/60000)+'m ago';if(d<86400000)return Math.floor(d/3600000)+'h ago';return Math.floor(d/86400000)+'d ago'}

// ═══ DATA LOADERS ═══
async function loadAudit(){
  const el=document.getElementById('auditFeed');
  if(!el)return;
  const sf=document.getElementById('auditServerFilter');
  const tf=document.getElementById('auditTypeFilter');
  if(!sf)return;

  // Populate server dropdown if needed
  if(sf.options.length<=1&&allServers.length){
    sf.innerHTML='<option value="">Select a server...</option>'+allServers.map(s=>'<option value="'+s.id+'">'+(s.name||s.id)+'</option>').join('');
    if(curSrv)sf.value=curSrv;
  }

  const serverId=sf.value;
  const type=tf?tf.value:'all';

  if(!serverId){
    el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><p>Select a server to view its audit log</p><p class="empty-act">Choose a server from the dropdown above to see moderation events, message edits, member joins, and more.</p></div>';
    updateRefreshTimestamp('auditlog');
    return;
  }

  showSkeleton(el,'audit',5);

  try{
    const r=await fetch('/api/server/'+serverId+'/auditlog?type='+type+'&limit=60');
    const entries=await r.json();

    if(!entries.length){
      el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><p>No audit log entries found</p><p class="empty-act">Audit events appear as moderation actions, message edits, member joins, and Discord events are recorded.</p></div>';
      updateRefreshTimestamp('auditlog');
      return;
    }

    var validEntries=entries.filter(function(e){return e.type&&e.type!=='Undefined'&&e.type!=='undefined';});
    if(!validEntries.length){
      el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><p>No audit entries available</p><p class="empty-act">Discord audit log entries without recognizable action types were skipped. Try running moderation commands or enabling message tracking to populate the feed.</p></div>';
      updateRefreshTimestamp('auditlog');
      return;
    }
    el.innerHTML=validEntries.map(function(e){
      var tm=e.timestamp?timeSince(e.timestamp):'';
      var sc={discord:'rgba(var(--accent-rgb),0.12)',moderation:'rgba(241,196,15,0.12)',messages:'rgba(59,165,92,0.12)',members:'rgba(59,165,92,0.12)'};
      var st={discord:'var(--accent)',moderation:'#f1c40f',messages:'#3ba55c',members:'#3ba55c'};
      var bg=sc[e.source]||'rgba(255,255,255,0.02)';
      var tc=st[e.source]||'var(--text-dim)';
      var ch=(e.changes||[]).map(function(c){
        if(!c.key&&!c.new)return '';
        return '<span class="audit-change"><span class="audit-change-k">'+esc(c.key||'')+'</span><span class="audit-change-v">'+esc(c.new||'')+'</span></span>';
      }).filter(function(s){return s}).join('');
      var ico=e.icon||'\uD83D\uDD35';
      var etype=e.type||'Event';
      var src=e.source||'system';
      // Show executor only if it has a real name (not 'Unknown' placeholder)
      var execTag=e.executorTag&&e.executorTag!=='Unknown'&&e.executorTag!=='unknown'?e.executorTag:null;
      return '<div class="audit-item" style="--a-bg:'+bg+'">'+
        '<div class="audit-ico" style="color:'+tc+'">'+ico+'</div>'+
        '<div class="audit-body">'+
          '<div class="audit-h">'+
            '<span class="audit-type">'+esc(etype)+'</span>'+
            '<span class="audit-ts">'+tm+'</span>'+
            '<span class="audit-source" style="color:'+tc+'">'+esc(src)+'</span>'+
          '</div>'+
          '<div class="audit-meta">'+
            (execTag?'<span class="audit-exec">'+(e.executorAvatar?'<img src="'+e.executorAvatar+'" alt="">':'')+esc(execTag)+'</span>':'')+
            (e.targetTag?'<span class="audit-arrow">&rarr;</span><span class="audit-target">'+esc(e.targetTag)+'</span>':'')+
            (e.reason?'<span class="audit-reason">'+esc(e.reason)+'</span>':'')+
          '</div>'+
          (ch?'<div class="audit-changes">'+ch+'</div>':'')+
        '</div>'+
      '</div>';
    }).join('');
    updateRefreshTimestamp('auditlog');
  }catch{
    el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Could not load audit log</p><p class="empty-act">The bot may be starting up or the selected server is unavailable.</p></div>';
  }
}

// ═══ DATA LOADERS ═══
async function loadOv(){
  try{
    const[sr,rr,ar]=await Promise.all([fetch('/api/status'),fetch('/api/reminders'),fetch('/api/stats/aggregate')]);
    const s=await sr.json(),rm=await rr.json(),ag=await ar.json();
    if(s.online){
      const sv=s.servers||0,rmC=rm.length,ng=ag.netGrowth||0;
      animCount(document.getElementById('ovServers'),sv);animCount(document.getElementById('ovReminders'),rmC);
      const ovG=document.getElementById('ovGrowth');ovG.textContent=(ng>=0?'+':'')+ng;ovG.style.color=ng>=0?'#3ba55c':'#ed4245';
      document.getElementById('ovCards').innerHTML=
        '<div class="card sr"><svg class="ico-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg><div class="lbl">Connection</div><div class="val">'+(s.status||'Ready')+'</div><div class="sub">'+s.ping+'ms ping</div></div>'+
        '<div class="card sr"><svg class="ico-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><div class="lbl">Uptime</div><div class="val">'+s.uptime+'</div><div class="sub">Since last restart</div></div>'+
        '<div class="card sr"><svg class="ico-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/></svg><div class="lbl">Servers</div><div class="val">'+sv+'</div><div class="sub">'+s.users+' total users</div></div>'+
        '<div class="card sr"><svg class="ico-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><div class="lbl">Memory</div><div class="val">'+s.memory+' MB</div><div class="sub">Node '+s.nodeVersion+'</div></div>';
      if(ag.timeline&&ag.timeline.length>1){const tl=ag.timeline.slice(-14),mx=Math.max(...tl.map(d=>Math.abs(d.net)),1);const mw=tl.length*14+16,mh=50,cx=8,cw2=tl.length*14,ch2=38;const lc=tl[tl.length-1];const trendColor=lc&&lc.net>=0?'#3ba55c':'#ed4245';const mpts=tl.map((d,i)=>{const x=cx+(i/(tl.length-1||1))*cw2,y=cx+ch2/2-(d.net/mx)*(ch2/2-4);return x+','+y;}).join(' ');const marea=tl.map((d,i)=>{const x=cx+(i/(tl.length-1||1))*cw2,y=cx+ch2/2-(d.net/mx)*(ch2/2-2);return x+','+y;}).join(' ')+' '+cx+','+(cx+ch2)+' '+(cx+cw2)+','+(cx+ch2);const mDots=tl.map((d,i)=>{const x=cx+(i/(tl.length-1||1))*cw2,y=cx+ch2/2-(d.net/mx)*(ch2/2-2),c=d.net>=0?'#3ba55c':'#ed4245';return '<circle cx="'+x+'" cy="'+y+'" r="2" fill="'+c+'" stroke="var(--bg)" stroke-width="1.5"><title>'+d.date.slice(5)+': '+(d.net>=0?'+':'')+d.net+'</title></circle>';}).join('');document.getElementById('ovMiniChart').innerHTML='<svg viewBox="0 0 '+mw+' '+mh+'" style="width:100%;height:100%;"><defs><linearGradient id="mFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+trendColor+'" stop-opacity="0.15"/><stop offset="100%" stop-color="'+trendColor+'" stop-opacity="0.01"/></linearGradient></defs><polygon points="'+marea+'" fill="url(#mFill)"/><polyline points="'+mpts+'" fill="none" stroke="'+trendColor+'" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>'+mDots+'</svg>'}
      setTimeout(()=>{document.querySelectorAll('#sec-overview .sr').forEach(el=>srObs.observe(el))},50);
    }
    updateRefreshTimestamp('overview');
  }catch{const ovCards=document.getElementById('ovCards');if(ovCards)ovCards.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Overview data unavailable</p><p class="empty-act">The bot may be reconnecting. Data will refresh automatically.</p></div>'}
}
async function loadAn(){try{const r=await fetch('/api/stats/aggregate'),d=await r.json();if(d.timeline){animCount(document.getElementById('anJoins'),d.totalJoins);animCount(document.getElementById('anLeaves'),d.totalLeaves);const net=d.netGrowth||0;document.getElementById('anNet').textContent=(net>=0?'+':'')+net;document.getElementById('anNet').style.color=net>=0?'#3ba55c':'#ed4245';const tl=d.timeline,ac=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#5865F2';// Build SVG line chart
var maxJoin=Math.max.apply(null,tl.map(function(s){return s.joins||0}));var maxLeave=Math.max.apply(null,tl.map(function(s){return s.leaves||0}));var overallMax=Math.max(maxJoin,maxLeave,1);var anW=Math.max(100,tl.length*8+40),anH=130,p=12,ch2=90,cw2=anW-p*2;var joinPts=tl.map(function(s,i){var x=p+(i/(tl.length-1||1))*cw2,y=anH-20-(s.joins||0)/overallMax*(ch2-8);return x+','+y;}).join(' ');var leavePts=tl.map(function(s,i){var x=p+(i/(tl.length-1||1))*cw2,y=anH-20-(s.leaves||0)/overallMax*(ch2-8);return x+','+y;}).join(' ');var joinArea=tl.map(function(s,i){var x=p+(i/(tl.length-1||1))*cw2,y=anH-20-(s.joins||0)/overallMax*(ch2-8);return x+','+y;}).join(' ')+' '+p+','+(anH-20)+' '+(p+cw2)+','+(anH-20);var leaveArea=tl.map(function(s,i){var x=p+(i/(tl.length-1||1))*cw2,y=anH-20-(s.leaves||0)/overallMax*(ch2-8);return x+','+y;}).join(' ')+' '+p+','+(anH-20)+' '+(p+cw2)+','+(anH-20);var anDots=tl.map(function(s,i){var x=p+(i/(tl.length-1||1))*cw2,jy=anH-20-(s.joins||0)/overallMax*(ch2-8),ly=anH-20-(s.leaves||0)/overallMax*(ch2-8);return '<circle cx="'+x+'" cy="'+jy+'" r="2" fill="#3ba55c" stroke="var(--bg)" stroke-width="1.5"><title>'+s.date+': +'+(s.joins||0)+'</title></circle>'+'<circle cx="'+x+'" cy="'+ly+'" r="2" fill="#ed4245" stroke="var(--bg)" stroke-width="1.5"><title>'+s.date+': -'+(s.leaves||0)+'</title></circle>';}).join('');var anLabels=tl.map(function(s,i){if(i%Math.max(1,Math.floor(tl.length/6))===0||i===tl.length-1){var x=p+(i/(tl.length-1||1))*cw2;return'<text x="'+x+'" y="'+(anH-4)+'" text-anchor="middle" fill="var(--text-muted)" font-size="7" font-family="Inter,sans-serif">'+s.date.slice(5)+'</text>'}return''}).join('');document.getElementById('growthChart').innerHTML='<svg viewBox="0 0 '+anW+' '+anH+'" style="width:100%;height:120px;display:block;"><defs><linearGradient id="jgF2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3ba55c" stop-opacity="0.2"/><stop offset="100%" stop-color="#3ba55c" stop-opacity="0.01"/></linearGradient><linearGradient id="lgF2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ed4245" stop-opacity="0.12"/><stop offset="100%" stop-color="#ed4245" stop-opacity="0.01"/></linearGradient></defs><polygon points="'+joinArea+'" fill="url(#jgF2)"/><polygon points="'+leaveArea+'" fill="url(#lgF2)"/><polyline points="'+joinPts+'" fill="none" stroke="#3ba55c" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><polyline points="'+leavePts+'" fill="none" stroke="#ed4245" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="3 2"/><text x="8" y="14" fill="#3ba55c" font-size="7" font-family="Inter,sans-serif" opacity="0.7">Joins</text><text x="8" y="23" fill="#ed4245" font-size="7" font-family="Inter,sans-serif" opacity="0.7">Leaves</text>'+anDots+anLabels+'</svg>'}
    updateRefreshTimestamp('analytics');
  }catch{}}
async function loadServers(){const list=document.getElementById('srvList');showSkeleton(list,'servers',4);try{const r=await fetch('/api/servers');allServers=await r.json();if(!allServers.length)return list.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/></svg><p>No servers found</p><p class="empty-act">Invite the bot to a server in Discord to see it here. Use the OAuth2 URL in your Discord Developer Portal.</p></div>';renderServers(allServers);updateRefreshTimestamp('servers')}catch{list.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Couldn\'t load servers</p><p class="empty-act">The bot may be starting up or Discord API is unreachable.</p></div>'}}
function renderServers(srvs){const sort=document.getElementById('srvSort').value;if(sort==='name')srvs.sort((a,b)=>a.name.localeCompare(b.name));else if(sort==='boosts')srvs.sort((a,b)=>b.boostCount-a.boostCount);else srvs.sort((a,b)=>b.memberCount-a.memberCount);const tierNames=['','Tier 1','Tier 2','Tier 3'];document.getElementById('srvList').innerHTML=srvs.map(s=>'<div class="srv-card" onclick="showSrv(\''+s.id+'\')"><img src="'+(s.icon||'https://cdn.discordapp.com/embed/avatars/0.png')+'" alt=""><div class="si"><h3>'+s.name+'</h3><p>'+s.memberCount.toLocaleString()+' members</p></div><span class="bdg"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'+(tierNames[s.boostTier]||'')+'</span></div>').join('')}
function filterServers(){const q=document.getElementById('srvSearch').value.toLowerCase();if(!q)return renderServers(allServers);renderServers(allServers.filter(s=>s.name.toLowerCase().includes(q)))}
async function showSrv(id){curSrv=id;document.getElementById('srvList').style.display='none';const dt=document.getElementById('srvDetail');dt.style.display='block';showSkeleton(dt,'srv-detail',1);try{const r=await fetch('/api/server/'+id),d=await r.json();const net=d.stats.totalJoins-d.stats.totalLeaves,snap=d.stats.snapshots||[],recent=snap.slice(-7).reduce((a,s)=>a+s.joins-s.leaves,0);            dt.innerHTML='<button class="bck" onclick="backSrv()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>Back</button><div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;"><img src="'+(d.icon||'https://cdn.discordapp.com/embed/avatars/0.png')+'" style="width:48px;height:48px;border-radius:12px;"><div><h2 style="font-size:20px;font-weight:800;color:#fff;">'+d.name+'</h2><p style="color:var(--text-dim);font-size:12px;">'+d.memberCount.toLocaleString()+' members</p></div></div><div class="grid grid-4"><div class="card"><div class="lbl">Members</div><div class="val">'+d.memberCount.toLocaleString()+'</div></div><div class="card"><div class="lbl">Channels</div><div class="val">'+(d.channels.text+d.channels.voice)+'</div><div class="sub">'+d.channels.text+'T/'+d.channels.voice+'V</div></div><div class="card"><div class="lbl">Roles</div><div class="val">'+d.roles+'</div></div><div class="card"><div class="lbl">Growth</div><div class="val" style="color:'+(net>=0?'#3ba55c':'#ed4245')+'">'+(net>=0?'+':'')+net+'</div><div class="sub">7d: '+(recent>=0?'+':'')+recent+'</div></div></div>'+(snap.length?'<div class="tw"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>Growth (30d)</div><div style="padding:14px;"><div style="display:flex;gap:2px;align-items:end;height:80px;">'+(function(){var snapData=snap.slice(-30);var maxV=Math.max.apply(null,snapData.map(function(x){return Math.max(x.joins,x.leaves,1)}));var svgW=Math.min(snapData.length*10+20,window.innerWidth-80||340),svgH=80;var joinPts=snapData.map(function(s,i){var x=10+i*10,y=75-(s.joins/maxV)*65;return x+','+y;}).join(' ');var leavePts=snapData.map(function(s,i){var x=10+i*10,y=75-(s.leaves/maxV)*65;return x+','+y;}).join(' ');var joinArea=snapData.map(function(s,i){var x=10+i*10,y=75-(s.joins/maxV)*65;return x+','+y;}).join(' ')+' '+10+',75 '+(10+snapData.length*10-10)+',75';var leaveArea=snapData.map(function(s,i){var x=10+i*10,y=75-(s.leaves/maxV)*65;return x+','+y;}).join(' ')+' '+10+',75 '+(10+snapData.length*10-10)+',75';var dots=snapData.map(function(s,i){var x=10+i*10,jy=75-(s.joins/maxV)*65,ly=75-(s.leaves/maxV)*65;return '<circle cx="'+x+'" cy="'+jy+'" r="2" fill="#3ba55c" stroke="var(--bg)" stroke-width="1.5"><title>'+s.date+': +'+s.joins+'</title></circle><circle cx="'+x+'" cy="'+ly+'" r="2" fill="#ed4245" stroke="var(--bg)" stroke-width="1.5"><title>'+s.date+': -'+s.leaves+'</title></circle>';}).join('');var labels=snapData.map(function(s,i){if(i%Math.max(1,Math.floor(snapData.length/5))===0||i===snapData.length-1){var x=10+i*10;return '<text x="'+x+'" y="82" text-anchor="middle" fill="var(--text-muted)" font-size="6" font-family="Inter,sans-serif">'+s.date.slice(5)+'</text>';}return '';}).join('');return '<svg viewBox="0 0 '+svgW+' '+svgH+'" style="width:100%;height:80px;max-height:80px;"><defs><linearGradient id="jgF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3ba55c" stop-opacity="0.2"/><stop offset="100%" stop-color="#3ba55c" stop-opacity="0.01"/></linearGradient><linearGradient id="lgF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ed4245" stop-opacity="0.15"/><stop offset="100%" stop-color="#ed4245" stop-opacity="0.01"/></linearGradient></defs><polygon points="'+joinArea+'" fill="url(#jgF)"/><polygon points="'+leaveArea+'" fill="url(#lgF)"/><polyline points="'+joinPts+'" fill="none" stroke="#3ba55c" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><polyline points="'+leavePts+'" fill="none" stroke="#ed4245" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="3 2"/><line x1="0" y1="75" x2="'+svgW+'" y2="75" stroke="var(--border)" stroke-width="0.5" opacity="0.3"/>'+dots+labels+'<text x="4" y="9" fill="#3ba55c" font-size="6" font-family="Inter,sans-serif" opacity="0.6">Joins</text><text x="4" y="16" fill="#ed4245" font-size="6" font-family="Inter,sans-serif" opacity="0.6">Leaves</text></svg>';})()+'</div></div></div>':'')+
      // ── Management Tabs ──
      '<div style="margin-top:20px;"><div class="tab-row" style="display:flex;gap:2px;margin-bottom:16px;background:rgba(255,255,255,0.02);border-radius:10px;padding:3px;max-width:420px;">'+
      '<button class="mgmt-tab active" data-tab="overview" onclick="showSrvTab(\'overview\')" >Overview</button>'+
      '<button class="mgmt-tab" data-tab="roles" onclick="showSrvTab(\'roles\',\''+id+'\')" >Roles</button>'+
      '<button class="mgmt-tab" data-tab="channels" onclick="showSrvTab(\'channels\',\''+id+'\')" >Channels</button>'+
      '<button class="mgmt-tab" data-tab="logging" onclick="showSrvTab(\'logging\',\''+id+'\')" >Logging</button>'+
      '<button class="mgmt-tab" data-tab="audit" onclick="showSrvTab(\'audit\',\''+id+'\')" >Audit Log</button>'+
      '<button class="mgmt-tab" data-tab="greetings" onclick="showSrvTab(\'greetings\',\''+id+'\')" >Greetings</button>'+
      '<button class="mgmt-tab" data-tab="modtools" onclick="showSrvTab(\'modtools\',\'\'+id+\'\')" >Mod Tools</button>'+
      '</div></div>'+
      '<div class="mgmt-panel" data-panel="overview"><div class="grid grid-2">'+(d.logging&&d.logging.perCategory?'<div class="tw"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>Logging</div><table class="tbl"><tr><th>Category</th><th>Channel</th><th>Status</th></tr>'+Object.entries(d.logging.perCategory).map(([cat,info])=>'<tr><td style="text-transform:capitalize;">'+cat+'</td><td>'+(info.channel?'<code>#'+info.channel+'</code>':'<span style="color:var(--text-muted);">Default</span>')+'</td><td><span class="tag '+(info.enabled?'green':'red')+'\">'+(info.enabled?'On':'Off')+'</span></td></tr>').join('')+'</table></div>':'')+'</div></div>'+
      '<div class="mgmt-panel" data-panel="roles" style="display:none;"><div id="mgmtRoles"><div class="loading"><div class="spin"></div></div></div></div>'+
      '<div class="mgmt-panel" data-panel="channels" style="display:none;"><div id="mgmtChannels"><div class="loading"><div class="spin"></div></div></div></div>'+
      '<div class="mgmt-panel" data-panel="logging" style="display:none;"><div id="mgmtLogging"><div class="loading"><div class="spin"></div></div></div></div>'+
      '<div class="mgmt-panel" data-panel="audit" style="display:none;"><div id="mgmtAudit"><div class="loading"><div class="spin"></div></div></div></div>'+
      '<div class="mgmt-panel" data-panel="greetings" style="display:none;"><div id="mgmtGreetings"><div class="loading"><div class="spin"></div></div></div></div>'+
      '<div class="mgmt-panel" data-panel="modtools" style="display:none;"><div id="mgmtModTools"><div class="loading"><div class="spin"></div></div></div></div>'}catch{dt.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Couldn\'t load server details</p><p class="empty-act">The server may have been deleted or the bot lost access.</p></div>'}}
function backSrv(){curSrv=null;document.getElementById('srvList').style.display='';document.getElementById('srvDetail').style.display='none'}

// ═══ SERVER MANAGEMENT ═══
let srvMgmtTab='overview';
function showSrvTab(tab,serverId){
  srvMgmtTab=tab;
  document.querySelectorAll('.mgmt-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  document.querySelectorAll('.mgmt-panel').forEach(p=>p.style.display=p.dataset.panel===tab?'':'none');
  if(tab==='roles'&&serverId)loadSrvRoles(serverId);
  if(tab==='channels'&&serverId)loadSrvChannels(serverId);
  if(tab==='logging'&&serverId)loadSrvLogging(serverId);
  if(tab==='audit'&&serverId)loadSrvAudit(serverId);
  if(tab==='greetings'&&serverId)loadSrvGreetings(serverId);if(tab==='modtools'&&serverId)loadSrvModTools(serverId)
}
async function loadSrvRoles(id){const el=document.getElementById('mgmtRoles');showSkeleton(el,'roles',4);try{const r=await fetch('/api/server/'+id+'/roles'),roles=await r.json();el.innerHTML=roles.slice(0,40).map(r=>'<div class="srv-card" style="cursor:default;padding:8px 12px;"><div style="width:10px;height:10px;border-radius:50%;background:'+(r.color||'rgba(255,255,255,0.1)')+';flex-shrink:0;"></div><div class="si"><h3>'+r.name+'</h3><p style="font-size:10px;">'+(r.managed?'Managed by integration':'ID: '+r.id)+'</p></div><span style="font-size:10px;color:var(--text-dim);">'+r.memberCount+' members</span></div>').join('')}catch{el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Couldn\'t load roles</p><p class="empty-act">The bot may need the \'Manage Roles\' permission.</p></div>'}
}
async function loadSrvChannels(id){const el=document.getElementById('mgmtChannels');showSkeleton(el,'channels',3);try{const r=await fetch('/api/server/'+id+'/channels'),channels=await r.json();const typeColors={Text:'rgba(59,165,92,0.12)',Voice:'rgba(88,101,242,0.12)',Announcement:'rgba(241,196,15,0.12)',Forum:'rgba(241,196,15,0.12)',Unknown:'rgba(255,255,255,0.04)'};el.innerHTML=channels.slice(0,50).map(c=>'<div class="srv-card" style="cursor:default;padding:8px 12px;"><span class="tag '+(c.nsfw?'red':'green')+'" style="margin-right:8px;">#'+c.name+'</span><div class="si"><h3 style="font-size:12px;">'+c.type+(c.topic?' — '+c.topic:'')+'</h3></div>'+(c.memberCount!==null?'<span style="font-size:10px;color:var(--text-dim);">'+c.memberCount+' users</span>':'')+(c.bitrate?'<span style="font-size:10px;color:var(--text-dim);">'+(c.bitrate/1000)+'kbps</span>':'')+'</div>').join('')}catch{el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Couldn\'t load channels</p><p class="empty-act">The bot may need the \'View Channels\' permission.</p></div>'}
}
async function toggleLogCat(serverId,category,enabled){
  try{await fetch('/api/server/'+serverId+'/log/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category,enabled})});showToast('Logging updated!');loadSrvLogging(serverId)}catch{showToast('Failed',true)}
}
async function loadSrvLogging(id){const el=document.getElementById('mgmtLogging');showSkeleton(el,'logging',1);try{const[r,d]=await Promise.all([fetch('/api/server/'+id+'/channels'),fetch('/api/server/'+id)]),channels=await r.json(),server=await d.json();if(!server.logging||!server.logging.perCategory)return el.innerHTML='<div class="empty"><p>No logging config available.</p></div>';const catHtml=Object.entries(server.logging.perCategory).map(([cat,info])=>{const emojis={messages:'\uD83D\uDCE8',reactions:'\uD83D\uDC4D',members:'\uD83D\uDC65',roles:'\uD83C\uDFF7',server:'\uD83D\uDDA5',voice:'\uD83C\uDFA4',threads:'\uD83E\uDD9C',emojis:'\uD83D\uDE0E',bans:'\uD83D\uDEAB',invites:'\uD83D\uDD17',stickers:'\uD83D\uDC02',automod:'\uD83E\uDD16',scheduled:'\uD83D\uDCC5',stage:'\uD83C\uDF9F',webhooks:'\uD83D\uDD17',integrations:'\uD83D\uDD17'};const chOpts='<option value="">Default (auto)</option>'+channels.filter(c=>c.typeId===0||c.typeId===5||c.typeId===15).map(c=>'<option value="'+c.id+'"'+(c.id===info.channel?' selected':'')+'>#'+c.name+'</option>').join('');return'<div class="tg-wr" style="cursor:default;display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:4px;"><span style="font-size:12px;flex-shrink:0;">'+(emojis[cat]||'\uD83D\uDCCB')+'</span><div class="tg '+(info.enabled?'on':'')+'" onclick="toggleLogCat(\''+id+'\',\''+cat+'\','+(!info.enabled)+')" style="cursor:pointer;flex-shrink:0;"></div><div class="tg-lbl" style="text-transform:capitalize;flex:0 0 100px;font-size:12px;color:var(--text);">'+cat+'</div><select id="logCh-'+cat+'" style="flex:1;min-width:0;padding:5px 8px;font-size:11px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;cursor:pointer;">'+chOpts+'</select></div>'}).join('');const tracked=server.logging.trackedChannels||[];const trackedHtml=tracked.length?'<div style="margin-bottom:8px;display:flex;flex-direction:column;gap:4px;">'+tracked.map(function(cid){var ch=channels.find(function(c){return c.id===cid});return'<div style="display:flex;align-items:center;gap:8px;padding:5px 10px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:6px;"><code style="flex:1;font-size:11px;">'+(ch?'#'+ch.name:cid)+'</code><button class="btn btn-s" onclick="removeTrackedChannel(\''+id+'\',\''+cid+'\')" style="padding:3px 8px;font-size:9px;">\u2716</button></div>'}).join('')+'</div>':'<div style="color:var(--text-muted);font-size:11px;margin-bottom:8px;">All channels are logged (no filter).</div>';el.innerHTML='<div class="tw"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>Categories</div><div style="padding:10px;">'+catHtml+'<button class="btn" onclick="saveAllLogSettings(\''+id+'\')" style="width:100%;margin-top:10px;padding:12px;font-size:14px;font-weight:700;background:linear-gradient(135deg,#3ba55c,#2d8c47);border:none;border-radius:10px;color:#fff;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save All Changes</button></div></div><div class="tw" style="margin-top:10px;"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>Channel Filter <span style="font-weight:400;color:var(--text-dim);font-size:10px;margin-left:4px;">('+(tracked.length||'All')+' tracked)</span></div><div style="padding:10px;"><div class="stg-hint" style="margin-bottom:8px;">When channels are in the list, ONLY those channels get logged. Empty = all channels.</div>'+trackedHtml+'<div style="display:flex;gap:6px;"><select id="trackedChSelect" style="flex:1;min-width:0;padding:5px 8px;font-size:11px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;cursor:pointer;"><option value="">Select a channel...</option>'+channels.filter(function(c){return c.typeId===0||c.typeId===2||c.typeId===5||c.typeId===15}).map(function(c){return'<option value="'+c.id+'">#'+c.name+' ('+c.type+')</option>'}).join('')+'</select><button class="btn btn-s" onclick="addTrackedChannel(\''+id+'\')" style="padding:5px 10px;font-size:10px;">+ Add</button><button class="btn btn-s" onclick="clearTrackedChannels(\''+id+'\')" style="padding:5px 10px;font-size:10px;">Clear</button></div></div></div>'}catch(e){document.getElementById('mgmtLogging').innerHTML='<div class="empty"><p>Failed to load.</p></div>'}}

async function loadSrvAudit(id){const el=document.getElementById('mgmtAudit');showSkeleton(el,'audit',4);try{const[rd,rs]=await Promise.all([fetch('/api/server/'+id+'/audit'),fetch('/api/server/'+id)]),audit=await rd.json(),server=await rs.json();if(!audit||!audit.length)return el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><p>No recent audit log entries.</p><p style="font-size:10px;color:var(--text-muted);margin-top:6px;">The bot may lack the \'View Audit Log\' permission.</p></div>';el.innerHTML=audit.map(function(e){var time=Math.floor((Date.now()-e.createdTimestamp)/1000),timeStr=time<60?time+'s ago':time<3600?Math.floor(time/60)+'m ago':time<86400?Math.floor(time/3600)+'h ago':Math.floor(time/86400)+'d ago';var actNames={1:'Server Updated',10:'Channel Created',11:'Channel Updated',12:'Channel Deleted',13:'Channel Permission Update',14:'Channel Overwrite Delete',20:'Member Kicked',21:'Member Prune',22:'Member Banned',23:'Member Unbanned',24:'Member Updated',25:'Member Role Updated',26:'Member Move',27:'Member Disconnect',28:'Bot Added',30:'Role Created',31:'Role Updated',32:'Role Deleted',40:'Invite Created',41:'Invite Deleted',42:'Invite Updated',50:'Webhook Created',51:'Webhook Updated',52:'Webhook Deleted',60:'Emoji Created',61:'Emoji Updated',62:'Emoji Deleted',70:'Message Deleted',71:'Message Bulk Delete',72:'Message Pin',73:'Message Unpin',80:'Integration Created',81:'Integration Updated',82:'Integration Deleted',90:'Sticker Created',91:'Sticker Updated',92:'Sticker Deleted',100:'Stage Started',101:'Stage Ended',102:'Stage Updated',110:'Thread Created',111:'Thread Updated',112:'Thread Deleted',120:'Scheduled Event Created',121:'Scheduled Event Updated',122:'Scheduled Event Deleted',130:'Auto Mod Block',140:'Auto Mod Rule Created',141:'Auto Mod Rule Updated',142:'Auto Mod Rule Deleted',143:'Auto Mod Flag Message',144:'Auto Mod Timeout'};var actionName=actNames[e.action]||e.actionType||'Action';return'<div class="act-item"><img src="'+(e.executorAvatar||'https://cdn.discordapp.com/embed/avatars/0.png')+'" style="width:24px;height:24px;border-radius:6px;flex-shrink:0;"><div class="a-tx"><strong>'+(e.executorTag||'Unknown')+'</strong> &#8209; '+actionName+(e.reason?'<br><span style="font-size:10px;color:var(--text-dim);">Reason: '+e.reason+'</span>':'')+'</div><div class="a-tm">'+timeStr+'</div></div>'}).join('')}catch{el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Couldn\'t load audit log</p><p class="empty-act">The bot needs the \'View Audit Log\' permission. Check server settings.</p></div>'}}

async function loadAct(){const el=document.getElementById('actFeed');showSkeleton(el,'act',3);try{const r=await fetch('/api/activity'),a=await r.json();if(!a.length||a.length<2)return el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><p>Activity will appear as people join.</p></div>';const items=a.slice(-20).filter(x=>x.type).reverse();el.innerHTML=items.map(x=>{const c=x.type==='join'?'#3ba55c':'#ed4245',b=x.type==='join'?'rgba(59,165,92,0.12)':'rgba(237,66,69,0.12)';return'<div class="act-item"><div class="a-ico" style="background:'+b+'"><svg viewBox="0 0 24 24" fill="none" stroke="'+c+'" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/></svg></div><div class="a-tx">Member '+(x.type==='join'?'joined':'left')+' <strong>'+x.guildName+'</strong></div><div class="a-tm">now</div></div>'}).join('');updateRefreshTimestamp('activity')}catch{el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Couldn\'t load activity</p><p class="empty-act">The bot may be starting up. Activity will appear once members join servers.</p></div>'}
  }
async function loadRm(){const el=document.getElementById('rmdList');showSkeleton(el,'rmd',4);try{const r=await fetch('/api/reminders'),rm=await r.json();if(!rm.length)return el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/></svg><p>No pending reminders</p><p class="empty-act">Use <code>/remindme 30s &lt;text&gt;</code> in Discord to set your first reminder.</p></div>';el.innerHTML=rm.map(r=>{const t=r.remindAt-Date.now(),m=Math.floor(t/60000),s=Math.floor((t%60000)/1000);return'<div class="rmd"><span class="rmd-tm">'+(t>0?(m>0?m+'m ':'')+s+'s':'Due')+'</span><span class="rmd-tx">'+r.text+'</span></div>'}).join('');updateRefreshTimestamp('reminders')}catch{el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Couldn\'t load reminders</p><p class="empty-act">The bot may be reconnecting. Try refreshing the page.</p></div>'}
  }

// ═══ COMMANDS ═══
let allCommands=[];
async function loadCommands(){const el=document.getElementById('cmdList');const filter=document.getElementById('cmdCatFilter');if(!el)return;showSkeleton(el,'commands',5);try{const r=await fetch('/api/commands');allCommands=await r.json();if(!allCommands.length)return el.innerHTML='<div class="empty"><p>No commands found.</p></div>';filter.innerHTML='<option value="all">All Categories</option>'+allCommands.map(c=>'<option value="'+c.category+'">'+c.category+'</option>').join('');renderCommands(allCommands)}catch{el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Couldn\'t load commands</p><p class="empty-act">The bot may be starting up. Try again in a moment.</p></div>'}}
function esc(s){if(s==null&&s!==0)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function renderCommands(data){const el=document.getElementById('cmdList');const totals=data.reduce((a,c)=>a+c.commands.length,0);console.log('[Commands] loaded',data.length,'categories,',totals,'commands');el.innerHTML='<div style="margin-bottom:14px;font-size:11px;color:var(--text-dim);">'+totals+' commands across '+data.length+' categories</div>'+data.map(cat=>'<div class="cmd-cat" onclick="this.classList.toggle(\'collapsed\')"><div class="cmd-cat-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="6 9 12 15 18 9"/></svg><span>'+esc(cat.category)+'</span><span class="cmd-count">'+cat.commands.length+'</span><span class="cmd-bdg '+(cat.owner?'owner':'public')+'">'+(cat.owner?'Owner Only':'Public')+'</span></div><div class="cmd-items">'+cat.commands.map(cmd=>'<div class="cmd-item"><code class="cmd-name">/'+esc(cmd.name)+'</code><div class="cmd-desc">'+esc(cmd.description)+'</div><div class="cmd-usage"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>'+esc(cmd.usage)+'</div></div>').join('')+'</div></div>').join('')}
function filterCommands(){const q=document.getElementById('cmdSearch').value.toLowerCase();const cat=document.getElementById('cmdCatFilter').value;if(!q&&cat==='all')return renderCommands(allCommands);const filtered=allCommands.map(c=>{if(cat!=='all'&&c.category!==cat)return null;const cmds=q?c.commands.filter(cmd=>cmd.name.includes(q)||cmd.description.toLowerCase().includes(q)):c.commands;if(!cmds||!cmds.length)return null;return{...c,commands:cmds};}).filter(Boolean);if(!filtered.length)return document.getElementById('cmdList').innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>No commands match "'+q+'"</p><p class="empty-act">Try a different search term or category.</p></div>';renderCommands(filtered)}

// ═══ SYSTEM ═══
async function loadSys(){try{const r=await fetch('/api/system'),s=await r.json();document.getElementById('sysHost').innerHTML='<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;"><span style="color:var(--text-dim);">Platform</span><span>'+s.platform+'</span></div><div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;"><span style="color:var(--text-dim);">Node</span><span>'+s.nodeVersion+'</span></div><div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;"><span style="color:var(--text-dim);">CPU</span><span>'+s.cpuCores+' cores</span></div><div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;"><span style="color:var(--text-dim);">Uptime</span><span>'+s.uptime+'</span></div>';// Cap RAM display (containers report host memory, use process values)
let memLabel='System',memUsedDisplay=s.memoryUsed,memTotalDisplay=s.memoryTotal,memUsageDisplay=s.memoryUsage;
if(parseFloat(s.memoryTotal)>64){memLabel='Container (process)';memUsedDisplay=s.rss;memTotalDisplay='RSS';memUsageDisplay=Math.min(100,(parseFloat(s.heapUsed)/Math.max(1,parseFloat(s.heapTotal)))*100)}else{memLabel='System';memUsedDisplay=s.memoryUsed;memTotalDisplay=s.memoryTotal+' GB'}
document.getElementById('sysMem').innerHTML='<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;"><span style="color:var(--text-dim);">'+memLabel+'</span><span>'+memUsedDisplay+'/'+memTotalDisplay+(memTotalDisplay==='RSS'?' MB':' GB')+'</span></div><div class="prog"><div class="pf" style="width:'+memUsageDisplay+'%"></div></div></div>'+
      '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;"><span style="color:var(--text-dim);">RSS</span><span>'+s.rss+' MB</span></div><div class="prog"><div class="pf" style="width:'+Math.min(100,(s.rss/1024)*100)+'%;background:rgba(var(--accent-rgb),0.5);"></div></div></div><div><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;"><span style="color:var(--text-dim);">Heap</span><span>'+s.heapUsed+'/'+s.heapTotal+' MB</span></div><div class="prog"><div class="pf" style="width:'+Math.min(100,(parseFloat(s.heapUsed)/parseFloat(s.heapTotal))*100)+'%;background:rgba(59,165,92,0.5);"></div></div></div>'}catch{}}
// ═══ BOT CUSTOMIZATION ═══
async function updateBotPresence(){const type=document.getElementById('botPresenceType').value,text=document.getElementById('botPresenceText').value;if(!text)return showToast('Enter a presence text',true);try{const r=await fetch('/api/bot/presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,text})}),d=await r.json();d.success?showToast('Presence updated!'):showToast(d.error||'Failed',true)}catch{showToast('Failed to update',true)}}
async function updateBotName(){const name=document.getElementById('botNameInput').value;if(!name)return showToast('Enter a name',true);if(name.length>32)return showToast('Max 32 characters',true);try{const r=await fetch('/api/bot/name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})}),d=await r.json();if(d.success){showToast('Username changed!');document.getElementById('botNameInput').value=''}else showToast(d.error||'Failed',true)}catch{showToast('Failed to rename',true)}}
async function updateBotAvatar(){const url=document.getElementById('botAvatarInput').value;if(!url)return showToast('Enter an image URL',true);try{const r=await fetch('/api/bot/avatar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})}),d=await r.json();if(d.success){showToast('Avatar changed!');document.getElementById('botAvatarInput').value=''}else showToast(d.error||'Failed',true)}catch{showToast('Failed to set avatar',true)}}

// ═══ BUGS BADGE THEME ═══
(function(){const b=document.getElementById('bugBadge');if(b){const o=new MutationObserver(()=>{b.style.color=document.body.classList.contains('light-mode')?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.06)'});o.observe(document.body,{attributes:true,attributeFilter:['class']})}})();

// ═══ BRANDING ═══
async function loadBrand(){try{const r=await fetch('/api/status');if(r.ok){const d=await r.json();if(d.brandName)document.getElementById('brandFt').textContent='Powered by '+d.brandName}}catch{}}

function stRf(){if(rTimer)clearInterval(rTimer);rTimer=setInterval(()=>{loadOv();loadAn();loadRm();loadCmdUsage();var se=document.getElementById('sec-errors');if(se&&se.classList.contains('active'))loadErrors()},rInt*1000)}
window.addEventListener('resize',()=>{rsBg();startBg(bgStyle)});
// ═══ GREETINGS (Welcome / Goodbye) ═══

function greetFieldsHtml(cfg,type,serverId,channels){
  const typeLabel=type==='welcome'?'Welcome':'Goodbye';
  var chOpts='<option value="">— No channel (disabled) —</option>';
  if(channels&&channels.length)channels.forEach(function(c){chOpts+='<option value="'+c.id+'"'+(c.id===cfg.channelId?' selected':'')+'>#'+c.name+'</option>'});
  var cId='gr_'+type+'_'+serverId;
  return '<div style="margin-bottom:16px;">'+
    // Enable toggle
    '<div class="tg-wr" onclick="toggleGreeting(\''+serverId+'\',\''+type+'\')"><div class="tg '+(cfg.enabled?'on':'')+'" id="tg_'+type+'_'+serverId+'"></div><div class="tg-lbl"><b style="font-size:14px;">'+typeLabel+' Messages</b><small>When enabled, this message will be sent automatically when someone '+(type==='welcome'?'joins':'leaves')+' the server.</small></div></div>'+
    
    // ── EMBED PREVIEW ──
    '<div style="margin:16px 0;">'+
      '<div class="tw-h" style="font-size:12px;">📋 Live Preview</div>'+
      '<div style="padding:14px;background:rgba(255,255,255,0.01);border:1px solid var(--border);border-top:none;border-radius:0 0 var(--radius-sm) var(--radius-sm);">'+
      '<div id="pv_'+type+'_'+serverId+'" style="background:var(--bg);border-radius:8px;border:1px solid var(--border);overflow:hidden;font-size:13px;line-height:1.5;">'+
        // Colored left border
        '<div style="padding:14px 16px;border-left:4px solid '+(cfg.embedColor||'#5865F2')+';position:relative;">'+
          // Author line
          (cfg.embedAuthor?'<div id="pvA_'+type+'_'+serverId+'" style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-dim);margin-bottom:6px;">'+(cfg.embedAuthorIcon?'<img src="'+cfg.embedAuthorIcon+'" style="width:18px;height:18px;border-radius:50%;object-fit:cover;" onerror="this.style.display=\'none\'">':'')+'<span>'+cfg.embedAuthor+'</span></div>':'')+
          // Title
          '<div id="pvT_'+type+'_'+serverId+'" style="font-weight:700;color:#fff;margin-bottom:6px;font-size:15px;">'+(cfg.embedTitle||'✨ Welcome!')+'</div>'+
          // Description
          '<div id="pvD_'+type+'_'+serverId+'" style="color:var(--text-dim);font-size:13px;margin-bottom:8px;">'+(cfg.embedDescription||'Welcome {user} to **{server}**!').replace(/\*\*/g,'<b>').replace(/\*/g,'<i>')+'</div>'+
          // Thumbnail (right side)
          (cfg.embedThumbnail?'<div style="position:absolute;top:14px;right:16px;"><img src="'+cfg.embedThumbnail+'" style="width:50px;height:50px;border-radius:6px;object-fit:cover;" onerror="this.style.display=\'none\'"></div>':'')+
          // Image
          (cfg.embedImage?'<div style="margin-top:6px;"><img src="'+cfg.embedImage+'" style="max-width:100%;max-height:140px;border-radius:6px;object-fit:cover;" onerror="this.style.display=\'none\'"></div>':'')+
          // Footer
          (cfg.embedFooter?'<div id="pvF_'+type+'_'+serverId+'" style="font-size:11px;color:var(--text-muted);margin-top:8px;padding-top:8px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;">'+(cfg.embedFooterIcon?'<img src="'+cfg.embedFooterIcon+'" style="width:16px;height:16px;border-radius:50%;object-fit:cover;" onerror="this.style.display=\'none\'">':'')+'<span>'+cfg.embedFooter+'</span></div>':'')+
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
        '<div class="grpf"><label>📢 Channel <small>— where the message will be sent</small></label><select id="grCh_'+type+'_'+serverId+'" onchange="updatePreview(\''+serverId+'\',\''+type+'\')">'+chOpts+'</select></div>'+
        '<div class="grpf"><label>💬 Plain Text <small>— appears above the embed (supports placeholders)</small></label><input type="text" id="grMsg_'+type+'_'+serverId+'" value="'+(cfg.content||'')+'" placeholder="e.g. Welcome {user}!" oninput="updatePreview(\''+serverId+'\',\''+type+'\')"></div>'+
      '</div>'+
      // Embed Header
      '<div class="grp"><div class="grp-h">📰 Embed Header</div>'+
        '<div class="grpf"><label>👤 Author Name <small>— small text at the top (leave empty to hide)</small></label><input type="text" id="grA_'+type+'_'+serverId+'" value="'+(cfg.embedAuthor||'')+'" placeholder="e.g. '+(type==='welcome'?'👋 Welcome Bot':'Server Team')+'" oninput="updatePreview(\''+serverId+'\',\''+type+'\')"></div>'+
        '<div class="grpf"><label>🖼️ Author Icon <small>— small image next to author name</small></label><input type="url" id="grAI_'+type+'_'+serverId+'" value="'+(cfg.embedAuthorIcon||'')+'" placeholder="https://...icon.png" oninput="updatePreview(\''+serverId+'\',\''+type+'\')"></div>'+
        '<div class="grpf"><label>📌 Title <small>— bold header text (shown in bold white)</small></label><input type="text" id="grT_'+type+'_'+serverId+'" value="'+(cfg.embedTitle||'')+'" placeholder="e.g. 👋 '+(type==='welcome'?'Welcome!':'Goodbye!')+'" oninput="updatePreview(\''+serverId+'\',\''+type+'\')"></div>'+
      '</div>'+
      // Embed Body
      '<div class="grp"><div class="grp-h">📝 Embed Body</div>'+
        '<div class="grpf"><label>📄 Description <small>— main message content (supports **bold**, *italic*, and placeholders)</small></label><textarea id="grD_'+type+'_'+serverId+'" rows="3" placeholder="e.g. Welcome {user} to **{server}**! We now have {membercount} members!" oninput="updatePreview(\''+serverId+'\',\''+type+'\')">'+(cfg.embedDescription||'')+'</textarea></div>'+
        '<div class="grpf"><label>🎨 Color <small>— thin colored bar on the left side of the embed</small></label><div class="color-row"><input type="color" id="grCo_'+type+'_'+serverId+'" value="'+(cfg.embedColor||'#5865F2')+'" oninput="document.getElementById(\'grCoT_'+type+'_'+serverId+'\').value=this.value;updatePreview(\''+serverId+'\',\''+type+'\')"><input type="text" id="grCoT_'+type+'_'+serverId+'" value="'+(cfg.embedColor||'#5865F2')+'" oninput="var c=this.value;/^#[0-9a-f]{6}$/i.test(c)&&(document.getElementById(\'grCo_'+type+'_'+serverId+'\').value=c,updatePreview(\''+serverId+'\',\''+type+'\'))" placeholder="#5865F2"></div></div>'+
        '<div class="grpf"><label>🖼️ Thumbnail <small>— square image in the top-right corner</small></label><input type="url" id="grTh_'+type+'_'+serverId+'" value="'+(cfg.embedThumbnail||'')+'" placeholder="https://...image.png" oninput="updatePreview(\''+serverId+'\',\''+type+'\')"></div>'+
        '<div class="grpf"><label>🖼️ Image <small>— large banner image below the description</small></label><input type="url" id="grIm_'+type+'_'+serverId+'" value="'+(cfg.embedImage||'')+'" placeholder="https://...banner.gif" oninput="updatePreview(\''+serverId+'\',\''+type+'\')"></div>'+
      '</div>'+
      // Embed Footer
      '<div class="grp"><div class="grp-h">🔻 Embed Footer</div>'+
        '<div class="grpf"><label>📝 Footer Text <small>— small text at the very bottom (leave empty to hide)</small></label><input type="text" id="grF_'+type+'_'+serverId+'" value="'+(cfg.embedFooter||'')+'" placeholder="e.g. Member #{membercount}" oninput="updatePreview(\''+serverId+'\',\''+type+'\')"></div>'+
        '<div class="grpf"><label>🖼️ Footer Icon <small>— small image next to footer text</small></label><input type="url" id="grFI_'+type+'_'+serverId+'" value="'+(cfg.embedFooterIcon||'')+'" placeholder="https://...icon.png" oninput="updatePreview(\''+serverId+'\',\''+type+'\')"></div>'+
      '</div>'+
    '</div>'+
    // Buttons
    '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">'+
      '<button class="btn" onclick="saveGreetingConfig(\''+serverId+'\',\''+type+'\')" style="padding:10px 22px;font-size:13px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> 💾 Save '+typeLabel+' Settings</button>'+
      '<button class="btn btn-s" onclick="resetGreetingConfig(\''+serverId+'\',\''+type+'\')" style="padding:10px 18px;font-size:13px;background:rgba(237,66,69,0.12);color:#ed4245;border-color:rgba(237,66,69,0.2);">↺ Reset '+typeLabel+'</button>'+
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

function updatePreview(serverId,type){
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
  if(author)html+='<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-dim);margin-bottom:4px;">'+(authorIcon?'<img src="'+authorIcon+'" style="width:16px;height:16px;border-radius:50%;object-fit:cover;" onerror="this.style.display=\'none\'">':'')+'<span>'+escapeHtml(author)+'</span></div>';
  html+='<div style="font-weight:700;color:#fff;margin-bottom:4px;">'+(title||'✨ Welcome!')+'</div>';
  html+='<div style="color:var(--text-dim);font-size:11px;margin-bottom:6px;">'+(desc||'Welcome {user} to **{server}**!').replace(/\*\*/g,'<b>').replace(/\*/g,'<i>')+'</div>';
  if(thumb)html+='<div style="position:absolute;top:12px;right:14px;"><img src="'+thumb+'" style="width:40px;height:40px;border-radius:4px;object-fit:cover;" onerror="this.style.display=\'none\'"></div>';
  if(image)html+='<div style="margin-top:4px;"><img src="'+image+'" style="max-width:100%;max-height:100px;border-radius:4px;object-fit:cover;" onerror="this.style.display=\'none\'"></div>';
  if(footer)html+='<div style="font-size:10px;color:var(--text-muted);margin-top:6px;padding-top:6px;border-top:1px solid var(--border);display:flex;align-items:center;gap:6px;">'+(footerIcon?'<img src="'+footerIcon+'" style="width:14px;height:14px;border-radius:50%;object-fit:cover;" onerror="this.style.display=\'none\'">':'')+'<span>'+escapeHtml(footer)+'</span></div>';
  html+='</div>';
  el.innerHTML=html;
}

function escapeHtml(str){
  var div=document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

async function toggleGreeting(serverId,type){
  const tg=document.getElementById('tg_'+type+'_'+serverId);
  if(!tg)return;
  const enabled=!tg.classList.contains('on');
  try{
    const r=await fetch('/api/server/'+serverId+'/greetings/'+type,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled})});
    const d=await r.json();
    if(d.success)tg.classList.toggle('on',enabled);
  }catch{}
}

async function saveGreetingConfig(serverId,type){
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

async function resetGreetingConfig(serverId,type){
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
async function saveAllLogSettings(serverId){const categories=[];const cats=["messages","reactions","members","roles","server","voice","threads","emojis","bans","invites","stickers","automod","scheduled","stage","webhooks","integrations"];for(const cat of cats){const sel=document.getElementById("logCh-"+cat);if(sel)categories.push({category:cat,channelId:sel.value||null});}try{const r=await fetch("/api/server/"+serverId+"/log/config/batch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({categories})});const d=await r.json();if(d.success){showToast("All log settings saved!");loadSrvLogging(serverId)}else showToast("Save failed",true)}catch{showToast("Save failed",true)}}
async function addTrackedChannel(serverId){const chId=document.getElementById('trackedChSelect').value;if(!chId)return showToast('Select a channel',true);try{await fetch('/api/server/'+serverId+'/log/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackedChannel:chId,trackedChannels:'add'})});showToast('Added!');loadSrvLogging(serverId)}catch{showToast('Failed',true)}}
async function removeTrackedChannel(serverId,chId){try{await fetch('/api/server/'+serverId+'/log/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackedChannel:chId,trackedChannels:'remove'})});showToast('Removed!');loadSrvLogging(serverId)}catch{showToast('Failed',true)}}
async function clearTrackedChannels(serverId){try{await fetch('/api/server/'+serverId+'/log/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackedChannels:'clear'})});showToast('Cleared!');loadSrvLogging(serverId)}catch{showToast('Failed',true)}}


// ═══ Message Search ═══
var msgSearchTimeout=null;
function onMsgSearchInput(id){if(msgSearchTimeout)clearTimeout(msgSearchTimeout);msgSearchTimeout=setTimeout(function(){loadSrvMessages(id)},300)}
function msgSearchFilterChange(id){loadSrvMessages(id)}
async function loadSrvMessages(id){var el=document.getElementById('mgmtMessages');var q=document.getElementById('msgSearchInput')?.value||'';var action=document.getElementById('msgSearchFilter')?.value||'all';showSkeleton(el,'msgs',1);try{var url='/api/server/'+id+'/messages?limit=50';if(action!=='all')url+='&action='+action;if(q)url+='&q='+encodeURIComponent(q);var r=await fetch(url),msgs=await r.json();var html='<div style="display:flex;gap:6px;margin-bottom:10px;padding:10px;"><input type="text" id="msgSearchInput" placeholder="Search message content..." value="'+q.replace(/"/g,'&quot;')+'" oninput="onMsgSearchInput(\''+id+'\')" style="flex:1;padding:8px 12px;background:rgba(255,255,255,0.02);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:12px;outline:none;font-family:inherit;"><select id="msgSearchFilter" onchange="msgSearchFilterChange(\''+id+'\')" style="padding:8px 10px;background:rgba(255,255,255,0.02);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:11px;font-family:inherit;"><option value="all">All</option><option value="deleted"'+(action==='deleted'?' selected':'')+'>Deleted</option><option value="edited"'+(action==='edited'?' selected':'')+'>Edited</option></select></div>';if(!msgs||!msgs.length){html+='<div class="empty"><p>No messages found.</p></div>';el.innerHTML=html;return}html+=msgs.map(function(m){var time=new Date(m.loggedAt);var timeStr=time.toLocaleDateString()+' '+time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});var actionBadge=m.action==='deleted'?'<span class="tag red">🗑️ Deleted</span>':'<span class="tag yellow">✏️ Edited</span>';var content=m.content?m.content.slice(0,300):'(no content)';if(q&&content.toLowerCase().includes(q.toLowerCase())){var idx=content.toLowerCase().indexOf(q.toLowerCase());var before=content.slice(0,idx);var match=content.slice(idx,idx+q.length);var after=content.slice(idx+q.length);content=before+'<mark style="background:rgba(88,101,242,0.25);color:#fff;padding:0 2px;border-radius:2px;">'+match+'</mark>'+after}return'<div class="rmd" style="flex-wrap:wrap;"><div style="flex:1;min-width:0;"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><strong style="font-size:12px;">'+m.authorTag+'</strong> '+actionBadge+' <span style="font-size:10px;color:var(--text-dim);">#'+m.channelName+'</span></div><div style="font-size:11px;color:var(--text);word-break:break-all;">'+content+'</div><div style="font-size:9px;color:var(--text-muted);margin-top:4px;">'+timeStr+'</div></div></div>'}).join('');el.innerHTML=html}catch{document.getElementById('mgmtMessages').innerHTML='<div class="empty"><p>Failed to load.</p></div>'}}

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

checkAuth().then(async ok=>{if(!ok)return;initThemes();initBgStyles();applyCompactPref();await loadCfg();startBg(cfg.backgroundStyle||'dots');await loadOv();await loadAn();await loadServers();await loadAct();await loadCommands();await loadRm();await loadSys();await loadTickets();loadCmdUsage();loadBrand();stRf();initSSE()});


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
          return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;"><span style="color:var(--text-muted);width:20px;">'+(i+1)+'.</span><span style="flex:1;color:var(--text);">'+(m.inviter||"Unknown")+'</span><span style="color:var(--accent);font-weight:600;">'+m.count+' joins</span></div>';
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
          +'<div style="flex:1;"><div style="font-size:12px;color:var(--text);line-height:1.4;">'+n.note+'</div>'
          +'<div style="display:flex;gap:8px;margin-top:4px;font-size:10px;color:var(--text-muted);">'
          +'<span>By: '+n.authorTag+'</span><span>'+new Date(n.createdAt).toLocaleDateString()+'</span></div></div></div>';
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
    if(d.success)document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(59,165,92,0.08);border:1px solid rgba(59,165,92,0.15);border-radius:var(--radius-sm);color:#3ba55c;font-size:13px;font-weight:500;">✅ Warned user '+d.user+'</div>';
    else document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(237,66,69,0.08);border:1px solid rgba(237,66,69,0.15);border-radius:var(--radius-sm);color:#ed4245;font-size:13px;font-weight:500;">❌ '+d.error+'</div>';
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
    if(d.success)document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(59,165,92,0.08);border:1px solid rgba(59,165,92,0.15);border-radius:var(--radius-sm);color:#3ba55c;font-size:13px;font-weight:500;">✅ Kicked user '+d.user+'</div>';
    else document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(237,66,69,0.08);border:1px solid rgba(237,66,69,0.15);border-radius:var(--radius-sm);color:#ed4245;font-size:13px;font-weight:500;">❌ '+d.error+'</div>';
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
    if(d.success)document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(59,165,92,0.08);border:1px solid rgba(59,165,92,0.15);border-radius:var(--radius-sm);color:#3ba55c;font-size:13px;font-weight:500;">✅ Banned user '+d.user+'</div>';
    else document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(237,66,69,0.08);border:1px solid rgba(237,66,69,0.15);border-radius:var(--radius-sm);color:#ed4245;font-size:13px;font-weight:500;">❌ '+d.error+'</div>';
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
    if(d.success)document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(59,165,92,0.08);border:1px solid rgba(59,165,92,0.15);border-radius:var(--radius-sm);color:#3ba55c;font-size:13px;font-weight:500;">✅ Timed out user '+d.user+' for '+duration+' min</div>';
    else document.getElementById('modActionResult').innerHTML='<div style="padding:12px 16px;background:rgba(237,66,69,0.08);border:1px solid rgba(237,66,69,0.15);border-radius:var(--radius-sm);color:#ed4245;font-size:13px;font-weight:500;">❌ '+d.error+'</div>';
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

// ═══ TICKETS ═══
// Drag-drop state

async function loadTickets(){
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
          '<div class="tg-wr" onclick="ticketToggle(\''+serverId+'\','+(!d.config.enabled)+')"><div class="tg '+(d.config.enabled?'on':'')+'"></div><div class="tg-lbl">'+(d.config.enabled?'Enabled':'Disabled')+'</div></div></div>'+
        '<div class="stg" style="margin-bottom:10px;"><label>Transcript Log Channel</label><select id="tkLogCh" class="tk-select" onchange="ticketSetLog(\''+serverId+'\')"><option value="">None</option>'+logChOpts+'</select></div>'+
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
          '<div class="tg-wr" onclick="ticketToggleLeave(\''+serverId+'\','+(!d.config.closeOnLeave)+')"><div class="tg '+(d.config.closeOnLeave?'on':'')+'"></div><div class="tg-lbl">'+(d.config.closeOnLeave?'On':'Off')+'</div></div></div>'+
        '<div class="tk-pill-group">'+
          tkPill('Add Ticket Type','Create a new type on the selected panel',(noPanel?'showToast(\'Select a panel first\',true)':'addTicketType(\''+serverId+'\',\''+panelId+'\')'))+
          tkPill('Transcript & Logging','Where transcripts are posted','tkCardClick(\'transcript\',\''+serverId+'\',\''+panelId+'\')')+
          tkPill('Claim System','How staff claim tickets','tkCardClick(\'claiming\',\''+serverId+'\',\''+panelId+'\')')+
        '</div>'+
      '</div></div>';

    // ── Panel Settings ──
    var panelSelOpts=panels.map(function(p,i){return '<option value="'+p.id+'"'+(selPanel&&p.id===selPanel.id?' selected':'')+'>'+(i+1)+' | '+esc(p.name)+'</option>'}).join('');
    var panelsHtml='<div class="tk-glass">'+
      '<div class="tk-glass-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>Panel Settings <span class="tk-h-count">'+panels.length+'</span></div>'+
      '<div class="tk-glass-b">'+
        '<div class="tk-sel-row">'+
          '<select id="tkSelPanel" class="tk-select" onchange="loadTickets()"><option value="">Select a panel...</option>'+panelSelOpts+'</select>'+
          '<button class="btn" onclick="createTicketPanel(\''+serverId+'\')" style="padding:9px 14px;font-size:12px;flex-shrink:0;" title="Create new panel">+</button></div>';
    
    if(!selPanel){
      panelsHtml+='<div class="tk-empty"><p>No panel selected.</p><p class="empty-act">Select a panel above, or click + to create a new one.</p></div>';
    }else{
      // Action row — Clone, Rename, Send, Set Count, Update, Delete
      panelsHtml+='<div class="tk-act-row">'+
        '<button type="button" class="tk-act-btn tk-act-blue" onclick="previewTicketPanel(\''+serverId+'\',\''+selPanel.id+'\')">\uD83D\uDC40 Preview</button>'+
        '<button type="button" class="tk-act-btn tk-act-green" onclick="previewTicketPanel(\''+serverId+'\',\''+selPanel.id+'\')">\uD83D\uDCE8 Send</button>'+
        '<button type="button" class="tk-act-btn tk-act-blue" onclick="tkClonePanel(\''+serverId+'\',\''+selPanel.id+'\')">\uD83D\uDD04 Clone</button>'+
        '<button type="button" class="tk-act-btn tk-act-blue" onclick="tkRenamePanel(\''+serverId+'\',\''+selPanel.id+'\')">\u270F\uFE0F Rename</button>'+
        '<button type="button" class="tk-act-btn tk-act-blue" onclick="tkSetCount(\''+serverId+'\',\''+selPanel.id+'\')">\uD83D\uDD22 Set Count</button>'+
        '<button type="button" class="tk-act-btn tk-act-blue" onclick="tkEditPanel(\''+serverId+'\',\''+selPanel.id+'\')">\u2B06\uFE0F Update</button>'+
        '<button type="button" class="tk-act-btn tk-act-red" onclick="tkDeletePanel(\''+serverId+'\',\''+selPanel.id+'\')">\u2716 Delete</button></div>';

      // Ticket Type dropdown — Ticket Tool style: the panel is the "main ticket" and
      // each type is a sub-ticket (e.g. Support / Application / Reporting). Pick the
      // type you want to configure from the dropdown below.
      panelsHtml+='<div class="tk-type-sel-row">'+
        '<span class="tk-type-sel-label">Ticket Type</span>'+
        '<select id="tkTypeSel" class="tk-select" onchange="loadTickets()">'+
          (pTypes.length?pTypes.map(function(t){return '<option value="'+t.id+'"'+(selType&&t.id===selType.id?' selected':'')+'>'+esc(t.emoji||'\uD83C\uDFAB')+' '+esc(t.name)+'</option>'}).join(''):'<option value="">No types yet</option>')+
        '</select>'+
        '<button class="btn" onclick="addTicketType(\''+serverId+'\',\''+selPanel.id+'\')" style="padding:9px 12px;font-size:11px;flex-shrink:0;" title="Add a new ticket type">+</button></div>';
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
            '<button type="button" class="tk-act-btn tk-act-blue" onclick="editTicketTypeSettings(\''+serverId+'\',\''+selPanel.id+'\',\''+selType.id+'\')">\u2699\uFE0F Edit</button>'+
            '<button type="button" class="tk-act-btn tk-act-blue" onclick="editQuestions(\''+serverId+'\',\''+selPanel.id+'\',\''+selType.id+'\')">\uD83D\uDCDD Questions</button>'+
            '<button type="button" class="tk-act-btn tk-act-red" onclick="deleteTicketType(\''+serverId+'\',\''+selPanel.id+'\',\''+selType.id+'\')">\uD83D\uDDD1\uFE0F Delete</button>'+
          '</div></div>';
      }

      // Pill navigation
      panelsHtml+='<div class="tk-pill-group">'+
        tkPill('Ticket Types',(pTypes.length?pTypes.length+' type'+(pTypes.length>1?'s':''):'No types yet'),'tkCardClick(\'types\',\''+serverId+'\',\''+selPanel.id+'\')')+
        tkPill('Custom Questions','Up to 5 per type','tkCardClick(\'forms\',\''+serverId+'\',\''+selPanel.id+'\')')+
        tkPill('Panel Message','Embed title & description','tkEditMessage(\''+serverId+'\',\'panel\')')+
        tkPill('Ticket Message','Welcome message for new tickets','tkEditMessage(\''+serverId+'\',\'ticket\')')+
      '</div>';

      // Frequently Used Configs
      panelsHtml+='<div id="tk-freq-wr" class="tk-freq-wr">'+
        '<div class="tk-freq-h" onclick="tkToggleFreq()"><span id="tk-freq-caret" class="tk-freq-caret">\u25BC</span>Frequently Used Configs</div>'+
        '<div id="tk-freq-body" class="tk-freq-grid">'+
          // Left: Support Team Roles + Panel Message
          '<div><div class="stg" style="margin-bottom:10px;"><label>Support Team Roles <span title="Roles that can view and manage tickets" style="cursor:help;color:var(--text-dim);font-size:11px;">\u24D8</span></label>'+
            '<div id="tk-freq-roles" class="tk-role-chips"></div><div class="tk-hint">Click roles to toggle them on/off</div></div>'+
            '<button class="btn btn-s" onclick="tkEditMessage(\''+serverId+'\',\'panel\')" style="padding:6px 12px;font-size:10px;">\uD83D\uDCAC Edit Panel Message</button></div>'+
          // Right: Category + Ticket Message
          '<div><div class="stg" style="margin-bottom:10px;"><label>Category Created/Opened <span title="Categories where tickets can be created" style="cursor:help;color:var(--text-dim);font-size:11px;">\u24D8</span></label>'+
            '<select id="tk-freq-cats" class="tk-select" onchange="tkMarkUnsaved()"></select><div class="tk-hint">Category for the selected type (per-type settings override)</div></div>'+
            '<button class="btn btn-s" onclick="tkEditMessage(\''+serverId+'\',\'ticket\')" style="padding:6px 12px;font-size:10px;">\uD83D\uDCAC Edit Ticket Message</button></div>'+
        '</div></div>';

      // Populate roles + category pickers after rendering
      var allRoles=[];
      for(var rk in rolesById)allRoles.push(rolesById[rk]);
      var curRoleIds=parseTkArray(selType?selType.support_roles:null);
      var roleChipsHtml='';
      for(var ri=0;ri<allRoles.length;ri++){
        var roleData=allRoles[ri];
        roleChipsHtml+='<button type="button" class="tk-role-chip'+(curRoleIds.indexOf(roleData.id)>-1?' on':'')+'" data-role-id="'+roleData.id+'" onclick="tkToggleRoleChip(this)">'+esc(roleData.name)+'</button>';
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
      return '<button class="tk-rec-tab'+(tkRecFilter===f[0]?' on':'')+'" onclick="tkRecFilterSet(\''+f[0]+'\')">'+f[1]+'</button>';
    }).join('');
    var recentHtml='<div class="tk-glass"><div class="tk-glass-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Recent Tickets <span class="tk-h-count">'+tkRecData.length+'</span></div>'+
      '<div class="tk-rec-tabs">'+recTabs+'</div><div style="padding:8px 12px 12px;" id="tk-rec-body"></div></div>';

    // ── Build layout ──
    var grid='<div class="tk-main-grid"><div>'+cfgHtml+advHtml+'</div><div>'+panelsHtml+'</div></div>';
    el.innerHTML=grid+'<div style="margin-top:16px;">'+recentHtml+'</div>'+
      '<!-- Floating unsaved-changes bar --><div id="tk-unsaved-bar" class="tk-unsaved-bar">'+
        '<span class="tk-unsaved-ic">\u26A0\uFE0F</span><span class="tk-unsaved-tx">You have unsaved changes!</span>'+
        '<div style="display:flex;gap:6px;">'+
          '<button class="btn btn-s" onclick="tkResetChanges()" style="padding:6px 14px;font-size:11px;">Reset</button>'+
          '<button class="btn" onclick="tkSaveChanges()" style="padding:6px 14px;font-size:11px;">Save</button></div></div>';
    tkRecRender();
    updateRefreshTimestamp('tickets');
    setTimeout(function(){document.querySelectorAll('#sec-tickets .sr').forEach(function(el2){srObs.observe(el2)})},50);
  }catch(e){
    el.innerHTML='<div class="empty"><p>Failed to load ticket data.</p><p class="empty-act">'+esc(e.message)+'</p></div>';
    updateRefreshTimestamp('tickets');
  }
}

// ── Inline Question Editor ──
function editQuestions(serverId,panelId,typeId){
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
function renderQuestions(qs){document.getElementById('tk-q-data').value=JSON.stringify(qs);var list=document.getElementById('tk-q-list');if(!list)return;var qHtml=qs.map(function(q,i){
  return '<div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px;background:rgba(255,255,255,0.05);" data-idx="'+i+'">'+
    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">'+
      '<span style="font-size:10px;color:var(--text-dim);width:20px;">'+(i+1)+'.</span>'+
      '<input class="tk-q-label" value="'+esc(q.label||q.question||'')+'" placeholder="Question label..." style="flex:1;padding:5px 8px;font-size:12px;background:rgba(255,255,255,0.07);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;">'+
      '<button class="btn btn-s" onclick="(function(){var qs2=JSON.parse(document.getElementById(\'tk-q-data\').value||\'[]\');qs2.splice('+i+',1);renderQuestions(qs2)})()" style="padding:3px 7px;font-size:9px;color:#ed4245;">\u2716</button></div>'+
    '<div style="display:flex;gap:8px;align-items:center;">'+
      '<input class="tk-q-placeholder" value="'+esc(q.placeholder||'')+'" placeholder="Placeholder text" style="flex:1;padding:4px 8px;font-size:10px;background:rgba(255,255,255,0.06);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;">'+
      '<label style="font-size:10px;display:flex;align-items:center;gap:4px;white-space:nowrap;"><input type="checkbox" class="tk-q-req" '+(q.required!==false?'checked':'')+'> Required</label></div></div>';
}).join('')||'<div style="text-align:center;padding:16px;color:var(--text-dim);font-size:12px;">No questions yet. Add one below.</div>';
list.innerHTML=qHtml;
}

// ── Panel Preview Modal ──
// ── Live preview simulation state (declared before first use) ──
var tkPrevState={types:[],srvName:'',srvIcon:'',color:'#5865F2'};

function previewTicketPanel(serverId,panelId){
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
          '<select id="tk-prev-type" class="tk-prev-select" onchange="tkPrevPick(this.value)">'+
            '<option value="">Choose a ticket type...</option>'+
            types.map(function(t){return '<option value="'+esc(t.id)+'">'+esc(t.emoji||'🎫')+' '+esc(t.name)+'</option>'}).join('')+
          '</select><span class="tk-prev-select-arrow">▾</span>'+
        '</div></div>';
    }else{
      // Single type (or none) — Create button only
      compsHtml+='<div class="tk-prev-comp"><button type="button" class="tk-prev-btn tk-prev-btn-create" onclick="tkPrevCreate()">🎫 Create Ticket</button></div>';
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

function tkPrevPick(typeId){
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

function tkPrevCreate(){
  var flow=document.getElementById('tk-prev-flow');
  if(!flow)return;
  var types=tkPrevState.types;
  if(!types.length){flow.innerHTML=tkPrevSimCard('<div class="tk-prev-sim-error">❌ This panel has no ticket types configured. Please contact the server staff.</div>');return}
  // Only reachable from the Create button, which renders for single-type panels
  if(types[0])tkPrevPick(types[0].id);
}

// ── Ticket Dashboard CRUD Helpers (Modal-based UX) ──
function ticketToggle(serverId,newVal){fetch('/api/server/'+serverId+'/tickets/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:newVal})}).then(function(r){return r.json()}).then(function(d){if(d.success){showToast('Ticket system '+(newVal?'enabled':'disabled')+'!');loadTickets()}else showToast('Failed',true)}).catch(function(){showToast('Failed',true)})}
function ticketToggleLeave(serverId,newVal){fetch('/api/server/'+serverId+'/tickets/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({closeOnLeave:newVal})}).then(function(r){return r.json()}).then(function(d){if(d.success){showToast('Auto-close '+(newVal?'enabled':'disabled')+'!');loadTickets()}else showToast('Failed',true)}).catch(function(){showToast('Failed',true)})}
function ticketSetLog(serverId){var v=document.getElementById('tkLogCh').value;fetch('/api/server/'+serverId+'/tickets/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({logChannelId:v||null})}).then(function(r){return r.json()}).then(function(d){if(d.success){showToast('Log channel updated!')}else showToast('Failed',true)}).catch(function(){showToast('Failed',true)})}

// ── Modern Modal: Create Panel ──
function createTicketPanel(serverId){
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
function addTicketType(serverId,panelId){
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
function editTicketTypeSettings(serverId,panelId,typeId){
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
      '<div style="display:flex;gap:8px;margin-bottom:12px;"><button class="btn" onclick="editQuestions(\''+serverId+'\',\''+panelId+'\',\''+typeId+'\');tkCloseModal(this)" style="flex:1;padding:8px;font-size:11px;">\uD83D\uDCDD Edit Questions ('+questions.length+')</button></div>'+
      '<div style="margin-bottom:12px;"><button class="btn btn-s" onclick="deleteTicketType(\''+serverId+'\',\''+panelId+'\',\''+typeId+'\');tkCloseModal(this)" style="width:100%;padding:8px;font-size:11px;color:#ff8a90;background:rgba(237,66,69,0.1);border:1px solid rgba(237,66,69,0.3);">\uD83D\uDDD1\uFE0F Delete Type</button></div>'+
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


function tkCloseModal(btn){var overlay=btn.closest('[style*="fixed"]');if(overlay)document.body.removeChild(overlay)}

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
function tkRecFilterSet(f){tkRecFilter=f;tkRecRender()}

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
      return '<button type="button" class="tk-role-chip'+(on?' on':'')+'" data-role-id="'+r.id+'" onclick="tkToggleRoleChip(this)">'+esc(r.name)+'</button>';
    }).join('');
  }
  html+='</div>';
  return html;
}
function tkToggleRoleChip(btn){btn.classList.toggle('on');if(btn.closest('#tk-freq-roles'))tkMarkUnsaved()}
function tkGetSelectedRoles(containerId){
  var out=[];
  var box=document.getElementById(containerId);
  if(box)box.querySelectorAll('.tk-role-chip.on').forEach(function(c){out.push(c.getAttribute('data-role-id'))});
  return out;
}
function tkPill(title,sub,fn){return '<button type="button" class="tk-pill" onclick="'+fn+'"><span class="tk-pill-t">'+esc(title)+'</span>'+(sub?'<span class="tk-pill-s">'+esc(sub)+'</span>':'')+'<span class="tk-pill-a">\u203A</span></button>'}

// ── New helpers: Rename, Clone, Set Count, Card Click, Freq Config, Unsaved ──
function tkRenamePanel(serverId,panelId){
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
      '<div style="display:flex;gap:8px;"><button class="btn btn-s" onclick="tkCloseModal(this)" style="flex:1;padding:8px 12px;font-size:12px;">Cancel</button><button class="btn" id="tk-rnm-save" style="flex:1;padding:8px 12px;font-size:12px;">Rename</button></div></div>';
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
function tkClonePanel(serverId,panelId){
  fetch('/api/server/'+serverId+'/tickets/panels/'+panelId+'/clone',{method:'POST'})
  .then(function(r){return r.json()}).then(function(d){if(d.success){showToast('Panel cloned!');loadTickets()}else showToast('Failed: '+(d.error||'unknown'),true)})
  .catch(function(){showToast('Failed to clone',true)});
}
function tkDeletePanel(serverId,panelId){
  if(!confirm('Delete this panel and all its types? This cannot be undone.'))return;
  fetch('/api/server/'+serverId+'/tickets/panels/'+panelId,{method:'DELETE'})
  .then(function(r){return r.json()}).then(function(d){if(d.success){showToast('Panel deleted');loadTickets()}else showToast('Failed: '+(d.error||'unknown'),true)})
  .catch(function(e){showToast('Failed: '+e.message,true)});
}
function deleteTicketType(serverId,panelId,typeId){
  if(!confirm('Delete this ticket type? This cannot be undone.'))return;
  fetch('/api/server/'+serverId+'/tickets/panels/'+panelId+'/types/'+typeId,{method:'DELETE'})
  .then(function(r){return r.json()}).then(function(d){if(d.success){showToast('Type deleted');loadTickets()}else showToast('Failed: '+(d.error||'unknown'),true)})
  .catch(function(e){showToast('Failed: '+e.message,true)});
}
function tkEditPanel(serverId,panelId){
  fetch('/api/server/'+serverId+'/tickets').then(function(r){return r.json()}).then(function(d2){
    var panel=null;
    for(var pi=0;pi<(d2.panels||[]).length;pi++){if(d2.panels[pi].id===panelId){panel=d2.panels[pi];break}}
    if(!panel){showToast('Panel not found',true);return}
    editTicketPanel(serverId,panelId,panel.name||'',panel.color||'#5865F2',panel.description||'');
  }).catch(function(e){showToast('Failed to load panel data',true)});
}
function tkSetCount(serverId,panelId){
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
      '<div style="display:flex;gap:8px;"><button class="btn btn-s" onclick="tkCloseModal(this)" style="flex:1;padding:8px 12px;font-size:12px;">Cancel</button><button class="btn" id="tk-cnt-save" style="flex:1;padding:8px 12px;font-size:12px;">Set</button></div></div>';
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
      '<button class="btn btn-s" onclick="tkCloseModal(this)" style="padding:8px 20px;font-size:12px;">Close</button></div>';
    document.body.appendChild(overlay);
    return;
  }
}

// ── Frequently Used Configs Helpers ──
function tkToggleFreq(){
  var body=document.getElementById('tk-freq-body');
  var caret=document.getElementById('tk-freq-caret');
  if(!body||!caret)return;
  var vis=body.style.display!=='none';
  body.style.display=vis?'none':'grid';
  caret.style.transform=vis?'rotate(-90deg)':'rotate(0deg)';
}
function tkEditMessage(serverId,type){
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
      '<div style="display:flex;gap:8px;"><button class="btn btn-s" onclick="tkCloseModal(this)" style="flex:1;padding:8px 12px;font-size:12px;">Cancel</button><button class="btn" id="tk-msg-save" style="flex:2;padding:8px 12px;font-size:12px;">Save</button></div></div>';
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
function tkMarkUnsaved(){
  var bar=document.getElementById('tk-unsaved-bar');
  if(bar){bar.style.display='flex'}
}
function tkResetChanges(){
  var bar=document.getElementById('tk-unsaved-bar');
  if(bar)bar.style.display='none';
  loadTickets();
  showToast('Changes reset');
}
function tkSaveChanges(){
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
      el.innerHTML=chips+'<div class="err-feed">'+d.errors.map(function(e){
        var stackHtml=e.stack?'<pre class="err-stack">'+esc(e.stack)+'</pre>':'';
        var metaHtml=e.meta?'<div class="err-meta">'+esc(e.meta)+'</div>':'';
        var extraHtml=e.extra?'<span class="err-extra">'+esc(e.extra)+'</span>':'';
        return '<div class="err-item"><div class="err-top"><span class="err-badge err-b-'+esc(e.tag)+'">'+esc(e.tag)+'</span><span class="err-msg">'+esc(e.message)+'</span>'+extraHtml+'</div>'+
          '<div class="err-sub"><span class="err-time">'+tkTimeAgo(e.timestamp)+'</span>'+
          (e.stack?'<button class="err-toggle" onclick="errToggleStack(this)">Show stack</button>':'')+
          '</div>'+metaHtml+stackHtml+'</div>';
      }).join('')+'</div>';
    }
    updateRefreshTimestamp('errors');
  }catch{
    el.innerHTML='<div class="empty"><p>Couldn\'t load errors.</p><p class="empty-act">The bot may be reconnecting.</p></div>';
  }
}
function errSetFilter(tag){errTagFilter=tag||'';loadErrors()}
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

// ═══ LOOK SWITCHER ═══
function setLook(look){
  // Remove all look classes
  document.body.classList.remove('look-neo','look-classic','look-minimal');
  // Add the selected look class
  document.body.classList.add('look-'+look);
  // Update UI
  document.querySelectorAll('#lookGrid .bg-style-opt').forEach(function(btn){
    btn.classList.toggle('active',btn.dataset.look===look);
  });
  // Save preference
  cfg.dashboardLook=look;
  // Show toast feedback
  const names={neo:'Neo (Modern)',classic:'Classic',minimal:'Minimal'};
  showToast('Switched to '+names[look]+' look');
}
