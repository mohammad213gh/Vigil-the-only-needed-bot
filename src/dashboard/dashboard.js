
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

// ═══ DOCK MAGNIFICATION ═══
let dockItems=[];
function initDock(){dockItems=document.querySelectorAll('.dock-item');dockMagnify()}
function dockMagnify(){const dock=document.getElementById('dock');if(!dock||!dockItems.length)return;const rect=dock.getBoundingClientRect();const mx=bgMouse.x;const itemW=52;
dockItems.forEach(item=>{const ir=item.getBoundingClientRect(),ic=ir.left+ir.width/2,dist=Math.abs(mx-ic),maxDist=200,scale=Math.max(1,1+(1-Math.min(dist/maxDist,1))*0.4);item.style.transform=`scale(${scale})`;if(scale>1.15)item.style.zIndex='10';else item.style.zIndex='';// Dynamic margin to prevent overlap
const extraMargin=(itemW*(scale-1))/2;item.style.marginLeft=6+extraMargin+'px';item.style.marginRight=6+extraMargin+'px'})}
function dockReset(){dockItems.forEach(item=>{item.style.transform='scale(1)';item.style.zIndex='';item.style.marginLeft='6px';item.style.marginRight='6px'})}
document.addEventListener('mousemove',e=>{
  if(!dockItems.length)return;
  if(e.clientY>window.innerHeight-140)dockMagnify();
  else dockReset()
});

// ═══ AMBIENT + CARD GLOW ═══
document.addEventListener('mousemove',e=>{
  document.documentElement.style.setProperty('--mx',e.clientX/window.innerWidth);
  document.documentElement.style.setProperty('--my',e.clientY/window.innerHeight);
  if(cfg.cardGlow!==false)document.querySelectorAll('.card').forEach(c=>{
    const r=c.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,d=Math.sqrt(dx*dx+dy*dy),i=Math.max(0,1-d/250),a2=Math.atan2(dy,dx)*(180/Math.PI)+90;
    c.style.setProperty('--glow-int',i.toFixed(3));c.style.setProperty('--glow-ang',a2.toFixed(1)+'deg')
  })
});

// ═══ SIDEBAR ═══
let sbPinned=false;
function showSidebar(){if(!sbPinned)document.getElementById('sidebar').classList.remove('hidden')}
function hideSidebar(){if(!sbPinned)setTimeout(()=>{if(!document.getElementById('sidebar').matches(':hover'))document.getElementById('sidebar').classList.add('hidden')},200)}
document.getElementById('sidebar').addEventListener('mouseenter',showSidebar);
document.getElementById('sidebar').addEventListener('mouseleave',hideSidebar);
document.addEventListener('mousemove',e=>{if(!sbPinned&&e.clientX<16)showSidebar()});
function togglePin(){sbPinned=!sbPinned;const sb=document.getElementById('sidebar'),pin=document.getElementById('sbPin');if(sbPinned){sb.classList.remove('hidden');pin.classList.add('pinned');document.documentElement.classList.add('sb-pinned')}else{pin.classList.remove('pinned');document.documentElement.classList.remove('sb-pinned');hideSidebar()}}

// ═══ SCROLL REVEAL ═══
const srObs=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');srObs.unobserve(e.target)}})},{threshold:0.1});

// ═══ ANIMATED COUNTER ═══
function animCount(el,target,dur=600+Math.random()*200){
  const start=parseInt(el.textContent.replace(/,/g,'').replace(/[^0-9-]/g,''))||0,t0=performance.now();
  !function step(t){const p=Math.min((t-t0)/dur,1),e=1-Math.pow(1-p,3),v=Math.round(start+(target-start)*e);el.textContent=v.toLocaleString();if(p<1)requestAnimationFrame(step)}(performance.now())
}

// ═══ EXPORT ═══
async function exportStats(){try{const r=await fetch('/api/stats/export'),d=await r.json();const blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='growth-data-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);showToast('Data exported!')}catch{showToast('Export failed',true)}}

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
  document.querySelectorAll('.nav-item').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.dock-item').forEach(s=>s.classList.remove('active'));
  const sec=document.getElementById('sec-'+n);sec.classList.add('active');
  sec.classList.remove('sec-enter');void sec.offsetWidth;sec.classList.add('sec-enter');
  const nav=document.querySelector('[data-sec="'+n+'"]');if(nav)nav.classList.add('active');
  const dnav=document.querySelector('.dock-item[data-sec="'+n+'"]');if(dnav)dnav.classList.add('active');
  setTimeout(()=>{document.querySelectorAll('#sec-'+n+' .sr').forEach(el=>srObs.observe(el))},50)
}

// ═══ CONFIG ═══
async function loadCfg(){try{const r=await fetch('/api/dash/config');cfg=await r.json();applyCfg(cfg)}catch{}}
function applyCfg(c){
  if(c.accentColor){const h=c.accentColor.replace('#',''),r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);document.documentElement.style.setProperty('--accent',c.accentColor);document.documentElement.style.setProperty('--accent-rgb',r+','+g+','+b);document.getElementById('dashColor').value=c.accentColor;document.getElementById('colorVal').textContent=c.accentColor}
  if(c.title){document.getElementById('dashTitle').value=c.title;document.getElementById('dashTitlePg').textContent=c.title;document.getElementById('dashTitleSidebar').textContent=c.title}
  if(c.refreshInterval){document.getElementById('dashRefresh').value=c.refreshInterval;rInt=c.refreshInterval;if(rTimer){clearInterval(rTimer);stRf()}}
  if(c.showWidgets)document.querySelectorAll('.tg').forEach(t=>{const w=t.dataset.w;if(w&&c.showWidgets[w]===false)t.classList.remove('on')});
  if(c.cardStyle){document.getElementById('dashCardStyle').value=c.cardStyle;document.querySelectorAll('.card').forEach(ca=>{ca.classList.toggle('card-solid',c.cardStyle==='solid');ca.classList.toggle('card-border',c.cardStyle==='border')})}
  if(c.layoutDensity){document.getElementById('dashDensity').value=c.layoutDensity;document.documentElement.style.setProperty('--layout-dense',c.layoutDensity==='compact'?'0.7':c.layoutDensity==='comfortable'?'1.2':'1')}
  if(c.backgroundImage&&c.backgroundType==='url'){document.getElementById('dashBgUrl').value=c.backgroundImage;const bg=document.getElementById('bgOverlay');bg.style.backgroundImage='url('+c.backgroundImage+')';bg.className='bg-overlay active'+(c.backgroundBlur&&c.backgroundBlur!=='0'?' blur-'+c.backgroundBlur:'')}
  if(c.backgroundBlur)document.getElementById('dashBgBlur').value=c.backgroundBlur;
  if(c.backgroundType){document.getElementById('bgType').value=c.backgroundType;const t=c.backgroundType;document.getElementById('bgUrlWrap').style.display=t==='url'?'':'none';document.getElementById('bgUploadWrap').style.display=t==='upload'?'':'none'}
  if(c.backgroundStyle){bgStyle=c.backgroundStyle;document.querySelectorAll('.bg-style-opt').forEach(e=>e.classList.toggle('active',e.dataset.bg===c.backgroundStyle));if(!document.getElementById('sec-settings').classList.contains('active'))switchBg(c.backgroundStyle)}
  if(c.darkMode===false){darkMode=false;applyTheme(false)}else{darkMode=true;applyTheme(true)}
  // New settings
  if(c.botAvatarUrl){document.getElementById('dashAvatarUrl').value=c.botAvatarUrl;previewAvatar(c.botAvatarUrl)}
  if(c.animationPreset){document.getElementById('dashAnimPreset').value=c.animationPreset;const speeds={subtle:0.7,smooth:1,energetic:1.3};const dur=speeds[c.animationPreset]||1;document.documentElement.style.setProperty('--anim-speed',dur)}
  if(c.animationSpeed){document.getElementById('dashAnimSpeed').value=c.animationSpeed;document.documentElement.style.setProperty('--anim-speed',c.animationSpeed)}
  if(c.dockEnabled!==undefined){document.body.classList.toggle('dock-enabled',c.dockEnabled);const dt=document.getElementById('dockToggle');if(c.dockEnabled)dt.classList.add('on');else dt.classList.remove('on')}
  if(c.cardGlow===false)document.querySelectorAll('.card').forEach(ca=>{ca.style.setProperty('--glow-int','0')});
  if(c.ambientLight===false)document.getElementById('ambient').style.display='none';else document.getElementById('ambient').style.display=''
}
function previewColor(h){const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);document.documentElement.style.setProperty('--accent',h);document.documentElement.style.setProperty('--accent-rgb',r+','+g+','+b);document.getElementById('dashColor').value=h;document.getElementById('colorVal').textContent=h}
function previewTitle(v){document.getElementById('dashTitlePg').textContent=v||'Overview';document.getElementById('dashTitleSidebar').textContent=v||'Dashboard'}
function applyTheme(isDark){document.body.classList.toggle('light-mode',!isDark);darkMode=isDark;const lb=document.getElementById('themeLabel'),ti=document.getElementById('themeIcon'),tg=document.getElementById('themeToggle');if(lb)lb.textContent=isDark?'Light Mode':'Dark Mode';if(ti)ti.innerHTML=isDark?'<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>':'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';if(tg)tg.classList.toggle('on',isDark)}
function toggleTheme(){applyTheme(!darkMode)}
function applyPreset(idx){const t=THEMES[idx];previewColor(t.color);document.getElementById('themeGrid').querySelectorAll('.thm-pick').forEach((e,i)=>e.classList.toggle('active',i===idx))}
function toggleBgType(){const t=document.getElementById('bgType').value;document.getElementById('bgUrlWrap').style.display=t==='url'?'':'none';document.getElementById('bgUploadWrap').style.display=t==='upload'?'':'none'}
function previewAvatar(url){const img=document.getElementById('sbAvatar'),def=document.getElementById('sbIconDefault');if(url&&url.startsWith('http')){img.src=url;img.style.display='block';def.style.display='none'}else{img.style.display='none';def.style.display='flex'}}
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
    dockEnabled:document.getElementById('dockToggle').classList.contains('on'),
    cardGlow:document.getElementById('glowToggle').classList.contains('on'),ambientLight:document.getElementById('ambientToggle').classList.contains('on'),
    botAvatarUrl:document.getElementById('dashAvatarUrl').value||null,
  };
  try{const r=await fetch('/api/dash/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cfg2)}),d=await r.json();if(d.success){applyCfg(d.config);showToast('Settings saved!')}}catch{showToast('Failed to save',true)}
}
function initThemes(){const g=document.getElementById('themeGrid');THEMES.forEach((t,i)=>{const d=document.createElement('div');d.className='thm-pick'+(!i?' active':'');d.style.background=t.color;d.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';d.onclick=()=>applyPreset(i);g.appendChild(d)})}
function initBgStyles(){const g=document.getElementById('bgStyleGrid');BG_STYLES.forEach((s,i)=>{const d=document.createElement('button');d.className='bg-style-opt'+(i===0?' active':'');d.dataset.bg=s.id;d.innerHTML=s.icon+'<span>'+s.name+'</span>';d.onclick=function(){g.querySelectorAll('.bg-style-opt').forEach(e=>e.classList.remove('active'));this.classList.add('active');switchBg(s.id)};g.appendChild(d)})}

// ═══ DATA LOADERS ═══
async function loadOv(){
  try{
    const[sr,rr,ar]=await Promise.all([fetch('/api/status'),fetch('/api/reminders'),fetch('/api/stats/aggregate')]);
    const s=await sr.json(),rm=await rr.json(),ag=await ar.json();
    if(s.online){
      document.getElementById('sDot').className='sl-dot on';document.getElementById('sTxt').textContent='Online';
      if(s.version)document.getElementById('sbVersion').textContent='v'+s.version;
      // Set bot avatar from status if no custom avatar configured
      if(!cfg.botAvatarUrl&&s.avatar){const img=document.getElementById('sbAvatar'),def=document.getElementById('sbIconDefault');img.src=s.avatar;img.style.display='block';def.style.display='none'}
      const sv=s.servers||0,rmC=rm.length,ng=ag.netGrowth||0;
      animCount(document.getElementById('ovServers'),sv);animCount(document.getElementById('ovReminders'),rmC);
      const ovG=document.getElementById('ovGrowth');ovG.textContent=(ng>=0?'+':'')+ng;ovG.style.color=ng>=0?'#3ba55c':'#ed4245';
      document.getElementById('ovCards').innerHTML=
        '<div class="card sr"><svg class="ico-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg><div class="lbl">Connection</div><div class="val">'+(s.status||'Ready')+'</div><div class="sub">'+s.ping+'ms ping</div></div>'+
        '<div class="card sr"><svg class="ico-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><div class="lbl">Uptime</div><div class="val">'+s.uptime+'</div><div class="sub">Since last restart</div></div>'+
        '<div class="card sr"><svg class="ico-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/></svg><div class="lbl">Servers</div><div class="val">'+sv+'</div><div class="sub">'+s.users+' total users</div></div>'+
        '<div class="card sr"><svg class="ico-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><div class="lbl">Memory</div><div class="val">'+s.memory+' MB</div><div class="sub">Node '+s.nodeVersion+'</div></div>';
      if(ag.timeline&&ag.timeline.length>1){const tl=ag.timeline.slice(-14),mx=Math.max(...tl.map(d=>Math.abs(d.net)),1);const mw=tl.length*14+16,mh=50,cx=8,cw2=tl.length*14,ch2=38;const mpts=tl.map((d,i)=>{const x=cx+(i/(tl.length-1||1))*cw2,y=cx+ch2/2-(d.net/mx)*(ch2/2-4);return x+','+y;}).join(' ');const marea=tl.map((d,i)=>{const x=cx+(i/(tl.length-1||1))*cw2,y=cx+ch2/2-(d.net/mx)*(ch2/2-2);return x+','+y;}).join(' ')+' '+cx+','+(cx+ch2)+' '+(cx+cw2)+','+(cx+ch2);const mDots=tl.map((d,i)=>{const x=cx+(i/(tl.length-1||1))*cw2,y=cx+ch2/2-(d.net/mx)*(ch2/2-2),c=d.net>=0?'#3ba55c':'#ed4245';return '<circle cx="'+x+'" cy="'+y+'" r="2" fill="'+c+'" stroke="var(--bg)" stroke-width="1.5"><title>'+d.date.slice(5)+': '+(d.net>=0?'+':'')+d.net+'</title></circle>';}).join('');document.getElementById('ovMiniChart').innerHTML='<svg viewBox="0 0 '+mw+' '+mh+'" style="width:100%;height:100%;"><defs><linearGradient id="mFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity="0.15"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0.01"/></linearGradient></defs><polygon points="'+marea+'" fill="url(#mFill)"/><polyline points="'+mpts+'" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>'+mDots+'</svg>'}
      setTimeout(()=>{document.querySelectorAll('#sec-overview .sr').forEach(el=>srObs.observe(el))},50);
    }
  }catch{}
}
async function loadAn(){try{const r=await fetch('/api/stats/aggregate'),d=await r.json();if(d.timeline){animCount(document.getElementById('anJoins'),d.totalJoins);animCount(document.getElementById('anLeaves'),d.totalLeaves);const net=d.netGrowth||0;document.getElementById('anNet').textContent=(net>=0?'+':'')+net;document.getElementById('anNet').style.color=net>=0?'#3ba55c':'#ed4245';const tl=d.timeline,ac=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#5865F2';// Build SVG line chart
var maxJoin=Math.max.apply(null,tl.map(function(s){return s.joins||0}));var maxLeave=Math.max.apply(null,tl.map(function(s){return s.leaves||0}));var overallMax=Math.max(maxJoin,maxLeave,1);var anW=Math.max(100,tl.length*8+40),anH=130,p=12,ch2=90,cw2=anW-p*2;var joinPts=tl.map(function(s,i){var x=p+(i/(tl.length-1||1))*cw2,y=anH-20-(s.joins||0)/overallMax*(ch2-8);return x+','+y;}).join(' ');var leavePts=tl.map(function(s,i){var x=p+(i/(tl.length-1||1))*cw2,y=anH-20-(s.leaves||0)/overallMax*(ch2-8);return x+','+y;}).join(' ');var joinArea=tl.map(function(s,i){var x=p+(i/(tl.length-1||1))*cw2,y=anH-20-(s.joins||0)/overallMax*(ch2-8);return x+','+y;}).join(' ')+' '+p+','+(anH-20)+' '+(p+cw2)+','+(anH-20);var leaveArea=tl.map(function(s,i){var x=p+(i/(tl.length-1||1))*cw2,y=anH-20-(s.leaves||0)/overallMax*(ch2-8);return x+','+y;}).join(' ')+' '+p+','+(anH-20)+' '+(p+cw2)+','+(anH-20);var anDots=tl.map(function(s,i){var x=p+(i/(tl.length-1||1))*cw2,jy=anH-20-(s.joins||0)/overallMax*(ch2-8),ly=anH-20-(s.leaves||0)/overallMax*(ch2-8);return '<circle cx="'+x+'" cy="'+jy+'" r="2" fill="#3ba55c" stroke="var(--bg)" stroke-width="1.5"><title>'+s.date+': +'+(s.joins||0)+'</title></circle>'+'<circle cx="'+x+'" cy="'+ly+'" r="2" fill="#ed4245" stroke="var(--bg)" stroke-width="1.5"><title>'+s.date+': -'+(s.leaves||0)+'</title></circle>';}).join('');var anLabels=tl.map(function(s,i){if(i%Math.max(1,Math.floor(tl.length/6))===0||i===tl.length-1){var x=p+(i/(tl.length-1||1))*cw2;return'<text x="'+x+'" y="'+(anH-4)+'" text-anchor="middle" fill="var(--text-muted)" font-size="7" font-family="Inter,sans-serif">'+s.date.slice(5)+'</text>'}return''}).join('');document.getElementById('growthChart').innerHTML='<svg viewBox="0 0 '+anW+' '+anH+'" style="width:100%;height:120px;display:block;"><defs><linearGradient id="jgF2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3ba55c" stop-opacity="0.2"/><stop offset="100%" stop-color="#3ba55c" stop-opacity="0.01"/></linearGradient><linearGradient id="lgF2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ed4245" stop-opacity="0.12"/><stop offset="100%" stop-color="#ed4245" stop-opacity="0.01"/></linearGradient></defs><polygon points="'+joinArea+'" fill="url(#jgF2)"/><polygon points="'+leaveArea+'" fill="url(#lgF2)"/><polyline points="'+joinPts+'" fill="none" stroke="#3ba55c" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><polyline points="'+leavePts+'" fill="none" stroke="#ed4245" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="3 2"/><text x="8" y="14" fill="#3ba55c" font-size="7" font-family="Inter,sans-serif" opacity="0.7">Joins</text><text x="8" y="23" fill="#ed4245" font-size="7" font-family="Inter,sans-serif" opacity="0.7">Leaves</text>'+anDots+anLabels+'</svg>'}}catch{}}
async function loadServers(){const list=document.getElementById('srvList');list.innerHTML='<div class="loading"><div class="spin"></div>Loading...</div>';try{const r=await fetch('/api/servers');allServers=await r.json();if(!allServers.length)return list.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/></svg><p>No servers found.</p></div>';renderServers(allServers)}catch{list.innerHTML='<div class="empty"><p>Failed to load.</p></div>'}}
function renderServers(srvs){const sort=document.getElementById('srvSort').value;if(sort==='name')srvs.sort((a,b)=>a.name.localeCompare(b.name));else if(sort==='boosts')srvs.sort((a,b)=>b.boostCount-a.boostCount);else srvs.sort((a,b)=>b.memberCount-a.memberCount);document.getElementById('srvList').innerHTML=srvs.map(s=>'<div class="srv-card" onclick="showSrv(\''+s.id+'\')"><img src="'+(s.icon||'https://cdn.discordapp.com/embed/avatars/0.png')+'" alt=""><div class="si"><h3>'+s.name+'</h3><p>'+s.memberCount.toLocaleString()+' members</p></div><span class="bdg"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'+s.boostTier+'</span></div>').join('')}
function filterServers(){const q=document.getElementById('srvSearch').value.toLowerCase();if(!q)return renderServers(allServers);renderServers(allServers.filter(s=>s.name.toLowerCase().includes(q)))}
async function showSrv(id){curSrv=id;document.getElementById('srvList').style.display='none';const dt=document.getElementById('srvDetail');dt.style.display='block';dt.innerHTML='<div class="loading"><div class="spin"></div>Loading...</div>';try{const r=await fetch('/api/server/'+id),d=await r.json();const net=d.stats.totalJoins-d.stats.totalLeaves,snap=d.stats.snapshots||[],recent=snap.slice(-7).reduce((a,s)=>a+s.joins-s.leaves,0);            dt.innerHTML='<button class="bck" onclick="backSrv()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>Back</button><div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;"><img src="'+(d.icon||'https://cdn.discordapp.com/embed/avatars/0.png')+'" style="width:48px;height:48px;border-radius:12px;"><div><h2 style="font-size:20px;font-weight:800;color:#fff;">'+d.name+'</h2><p style="color:var(--text-dim);font-size:12px;">'+d.memberCount.toLocaleString()+' members</p></div></div><div class="grid grid-4"><div class="card"><div class="lbl">Members</div><div class="val">'+d.memberCount.toLocaleString()+'</div></div><div class="card"><div class="lbl">Channels</div><div class="val">'+(d.channels.text+d.channels.voice)+'</div><div class="sub">'+d.channels.text+'T/'+d.channels.voice+'V</div></div><div class="card"><div class="lbl">Roles</div><div class="val">'+d.roles+'</div></div><div class="card"><div class="lbl">Growth</div><div class="val" style="color:'+(net>=0?'#3ba55c':'#ed4245')+'">'+(net>=0?'+':'')+net+'</div><div class="sub">7d: '+(recent>=0?'+':'')+recent+'</div></div></div>'+(snap.length?'<div class="tw"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>Growth (30d)</div><div style="padding:14px;"><div style="display:flex;gap:2px;align-items:end;height:80px;">'+(function(){var snapData=snap.slice(-30);var maxV=Math.max.apply(null,snapData.map(function(x){return Math.max(x.joins,x.leaves,1)}));var svgW=snapData.length*10+20,svgH=90;var joinPts=snapData.map(function(s,i){var x=10+i*10,y=75-(s.joins/maxV)*65;return x+','+y;}).join(' ');var leavePts=snapData.map(function(s,i){var x=10+i*10,y=75-(s.leaves/maxV)*65;return x+','+y;}).join(' ');var joinArea=snapData.map(function(s,i){var x=10+i*10,y=75-(s.joins/maxV)*65;return x+','+y;}).join(' ')+' '+10+',75 '+(10+snapData.length*10-10)+',75';var leaveArea=snapData.map(function(s,i){var x=10+i*10,y=75-(s.leaves/maxV)*65;return x+','+y;}).join(' ')+' '+10+',75 '+(10+snapData.length*10-10)+',75';var dots=snapData.map(function(s,i){var x=10+i*10,jy=75-(s.joins/maxV)*65,ly=75-(s.leaves/maxV)*65;return '<circle cx="'+x+'" cy="'+jy+'" r="2" fill="#3ba55c" stroke="var(--bg)" stroke-width="1.5"><title>'+s.date+': +'+s.joins+'</title></circle><circle cx="'+x+'" cy="'+ly+'" r="2" fill="#ed4245" stroke="var(--bg)" stroke-width="1.5"><title>'+s.date+': -'+s.leaves+'</title></circle>';}).join('');var labels=snapData.map(function(s,i){if(i%Math.max(1,Math.floor(snapData.length/5))===0||i===snapData.length-1){var x=10+i*10;return '<text x="'+x+'" y="82" text-anchor="middle" fill="var(--text-muted)" font-size="6" font-family="Inter,sans-serif">'+s.date.slice(5)+'</text>';}return '';}).join('');return '<svg viewBox="0 0 '+svgW+' '+svgH+'" style="width:100%;height:90px;"><defs><linearGradient id="jgF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3ba55c" stop-opacity="0.2"/><stop offset="100%" stop-color="#3ba55c" stop-opacity="0.01"/></linearGradient><linearGradient id="lgF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ed4245" stop-opacity="0.15"/><stop offset="100%" stop-color="#ed4245" stop-opacity="0.01"/></linearGradient></defs><polygon points="'+joinArea+'" fill="url(#jgF)"/><polygon points="'+leaveArea+'" fill="url(#lgF)"/><polyline points="'+joinPts+'" fill="none" stroke="#3ba55c" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><polyline points="'+leavePts+'" fill="none" stroke="#ed4245" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="3 2"/><line x1="0" y1="75" x2="'+svgW+'" y2="75" stroke="var(--border)" stroke-width="0.5" opacity="0.3"/>'+dots+labels+'<text x="4" y="9" fill="#3ba55c" font-size="6" font-family="Inter,sans-serif" opacity="0.6">Joins</text><text x="4" y="16" fill="#ed4245" font-size="6" font-family="Inter,sans-serif" opacity="0.6">Leaves</text></svg>';})()+'</div></div></div>':'')+
      // ── Management Tabs ──
      '<div style="margin-top:20px;"><div class="tab-row" style="display:flex;gap:2px;margin-bottom:16px;background:rgba(255,255,255,0.02);border-radius:10px;padding:3px;max-width:420px;">'+
      '<button class="mgmt-tab active" data-tab="overview" onclick="showSrvTab(\'overview\')" style="flex:1;padding:7px 12px;border-radius:8px;border:none;background:transparent;color:rgba(255,255,255,0.3);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s;">Overview</button>'+
      '<button class="mgmt-tab" data-tab="roles" onclick="showSrvTab(\'roles\',\''+id+'\')" style="flex:1;padding:7px 12px;border-radius:8px;border:none;background:transparent;color:rgba(255,255,255,0.3);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s;">Roles</button>'+
      '<button class="mgmt-tab" data-tab="channels" onclick="showSrvTab(\'channels\',\''+id+'\')" style="flex:1;padding:7px 12px;border-radius:8px;border:none;background:transparent;color:rgba(255,255,255,0.3);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s;">Channels</button>'+
      '<button class="mgmt-tab" data-tab="logging" onclick="showSrvTab(\'logging\',\''+id+'\')" style="flex:1;padding:7px 12px;border-radius:8px;border:none;background:transparent;color:rgba(255,255,255,0.3);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s;">Logging</button>'+
      '<button class="mgmt-tab" data-tab="audit" onclick="showSrvTab(\'audit\',\''+id+'\')" style="flex:1;padding:7px 12px;border-radius:8px;border:none;background:transparent;color:rgba(255,255,255,0.3);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s;">Audit Log</button>'+
      '<button class="mgmt-tab" data-tab="greetings" onclick="showSrvTab(\'greetings\',\''+id+'\')" style="flex:1;padding:7px 12px;border-radius:8px;border:none;background:transparent;color:rgba(255,255,255,0.3);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s;">Greetings</button>'+
      '</div></div>'+
      '<div class="mgmt-panel" data-panel="overview"><div class="grid grid-2">'+(d.logging&&d.logging.perCategory?'<div class="tw"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>Logging</div><table class="tbl"><tr><th>Category</th><th>Channel</th><th>Status</th></tr>'+Object.entries(d.logging.perCategory).map(([cat,info])=>'<tr><td style="text-transform:capitalize;">'+cat+'</td><td>'+(info.channel?'<code>#'+info.channel+'</code>':'<span style="color:var(--text-muted);">Default</span>')+'</td><td><span class="tag '+(info.enabled?'green':'red')+'\">'+(info.enabled?'On':'Off')+'</span></td></tr>').join('')+'</table></div>':'')+'</div></div>'+
      '<div class="mgmt-panel" data-panel="roles" style="display:none;"><div id="mgmtRoles"><div class="loading"><div class="spin"></div></div></div></div>'+
      '<div class="mgmt-panel" data-panel="channels" style="display:none;"><div id="mgmtChannels"><div class="loading"><div class="spin"></div></div></div></div>'+
      '<div class="mgmt-panel" data-panel="logging" style="display:none;"><div id="mgmtLogging"><div class="loading"><div class="spin"></div></div></div></div>'+
      '<div class="mgmt-panel" data-panel="audit" style="display:none;"><div id="mgmtAudit"><div class="loading"><div class="spin"></div></div></div></div>'+
      '<div class="mgmt-panel" data-panel="greetings" style="display:none;"><div id="mgmtGreetings"><div class="loading"><div class="spin"></div></div></div></div>'}catch{dt.innerHTML='<p style="color:#ed4245;padding:16px;">Failed to load.</p>'}}
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
  if(tab==='greetings'&&serverId)loadSrvGreetings(serverId)
}
async function loadSrvRoles(id){try{const r=await fetch('/api/server/'+id+'/roles'),roles=await r.json();const el=document.getElementById('mgmtRoles');el.innerHTML=roles.slice(0,40).map(r=>'<div class="srv-card" style="cursor:default;padding:8px 12px;"><div style="width:10px;height:10px;border-radius:50%;background:'+(r.color||'rgba(255,255,255,0.1)')+';flex-shrink:0;"></div><div class="si"><h3>'+r.name+'</h3><p style="font-size:10px;">'+(r.managed?'Managed by integration':'ID: '+r.id)+'</p></div><span style="font-size:10px;color:var(--text-dim);">'+r.memberCount+' members</span></div>').join('')}catch{document.getElementById('mgmtRoles').innerHTML='<div class="empty"><p>Failed to load.</p></div>'}}
async function loadSrvChannels(id){try{const r=await fetch('/api/server/'+id+'/channels'),channels=await r.json();const el=document.getElementById('mgmtChannels');const typeColors={Text:'rgba(59,165,92,0.12)',Voice:'rgba(88,101,242,0.12)',Announcement:'rgba(241,196,15,0.12)',Forum:'rgba(241,196,15,0.12)',Unknown:'rgba(255,255,255,0.04)'};el.innerHTML=channels.slice(0,50).map(c=>'<div class="srv-card" style="cursor:default;padding:8px 12px;"><span class="tag '+(c.nsfw?'red':'green')+'" style="margin-right:8px;">#'+c.name+'</span><div class="si"><h3 style="font-size:12px;">'+c.type+(c.topic?' — '+c.topic:'')+'</h3></div>'+(c.memberCount!==null?'<span style="font-size:10px;color:var(--text-dim);">'+c.memberCount+' users</span>':'')+(c.bitrate?'<span style="font-size:10px;color:var(--text-dim);">'+(c.bitrate/1000)+'kbps</span>':'')+'</div>').join('')}catch{document.getElementById('mgmtChannels').innerHTML='<div class="empty"><p>Failed to load.</p></div>'}}
async function toggleLogCat(serverId,category,enabled){
  try{await fetch('/api/server/'+serverId+'/log/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category,enabled})});showToast('Logging updated!');loadSrvLogging(serverId)}catch{showToast('Failed',true)}
}
async function loadSrvLogging(id){try{const[r,d]=await Promise.all([fetch('/api/server/'+id+'/channels'),fetch('/api/server/'+id)]),channels=await r.json(),server=await d.json();const el=document.getElementById('mgmtLogging');if(!server.logging||!server.logging.perCategory)return el.innerHTML='<div class="empty"><p>No logging config available.</p></div>';const catHtml=Object.entries(server.logging.perCategory).map(([cat,info])=>{const emojis={messages:'\uD83D\uDCE8',reactions:'\uD83D\uDC4D',members:'\uD83D\uDC65',roles:'\uD83C\uDFF7',server:'\uD83D\uDDA5',voice:'\uD83C\uDFA4',threads:'\uD83E\uDD9C',emojis:'\uD83D\uDE0E',bans:'\uD83D\uDEAB',invites:'\uD83D\uDD17',stickers:'\uD83D\uDC02',automod:'\uD83E\uDD16',scheduled:'\uD83D\uDCC5',stage:'\uD83C\uDF9F',webhooks:'\uD83D\uDD17',integrations:'\uD83D\uDD17'};const chOpts='<option value="">Default (auto)</option>'+channels.filter(c=>c.typeId===0||c.typeId===5||c.typeId===15).map(c=>'<option value="'+c.id+'"'+(c.id===info.channel?' selected':'')+'>#'+c.name+'</option>').join('');return'<div class="tg-wr" style="cursor:default;display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:4px;"><span style="font-size:12px;flex-shrink:0;">'+(emojis[cat]||'\uD83D\uDCCB')+'</span><div class="tg '+(info.enabled?'on':'')+'" onclick="toggleLogCat(\''+id+'\',\''+cat+'\','+(!info.enabled)+')" style="cursor:pointer;flex-shrink:0;"></div><div class="tg-lbl" style="text-transform:capitalize;flex:0 0 100px;font-size:12px;color:var(--text);">'+cat+'</div><select id="logCh-'+cat+'" style="flex:1;min-width:0;padding:5px 8px;font-size:11px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;cursor:pointer;">'+chOpts+'</select></div>'}).join('');const tracked=server.logging.trackedChannels||[];const trackedHtml=tracked.length?'<div style="margin-bottom:8px;display:flex;flex-direction:column;gap:4px;">'+tracked.map(function(cid){var ch=channels.find(function(c){return c.id===cid});return'<div style="display:flex;align-items:center;gap:8px;padding:5px 10px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:6px;"><code style="flex:1;font-size:11px;">'+(ch?'#'+ch.name:cid)+'</code><button class="btn btn-s" onclick="removeTrackedChannel(\''+id+'\',\''+cid+'\')" style="padding:3px 8px;font-size:9px;">\u2716</button></div>'}).join('')+'</div>':'<div style="color:var(--text-muted);font-size:11px;margin-bottom:8px;">All channels are logged (no filter).</div>';el.innerHTML='<div class="tw"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>Categories</div><div style="padding:10px;">'+catHtml+'<button class="btn" onclick="saveAllLogSettings(\''+id+'\')" style="width:100%;margin-top:10px;padding:12px;font-size:14px;font-weight:700;background:linear-gradient(135deg,#3ba55c,#2d8c47);border:none;border-radius:10px;color:#fff;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save All Changes</button></div></div><div class="tw" style="margin-top:10px;"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>Channel Filter <span style="font-weight:400;color:var(--text-dim);font-size:10px;margin-left:4px;">('+(tracked.length||'All')+' tracked)</span></div><div style="padding:10px;"><div class="stg-hint" style="margin-bottom:8px;">When channels are in the list, ONLY those channels get logged. Empty = all channels.</div>'+trackedHtml+'<div style="display:flex;gap:6px;"><select id="trackedChSelect" style="flex:1;min-width:0;padding:5px 8px;font-size:11px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;cursor:pointer;"><option value="">Select a channel...</option>'+channels.filter(function(c){return c.typeId===0||c.typeId===2||c.typeId===5||c.typeId===15}).map(function(c){return'<option value="'+c.id+'">#'+c.name+' ('+c.type+')</option>'}).join('')+'</select><button class="btn btn-s" onclick="addTrackedChannel(\''+id+'\')" style="padding:5px 10px;font-size:10px;">+ Add</button><button class="btn btn-s" onclick="clearTrackedChannels(\''+id+'\')" style="padding:5px 10px;font-size:10px;">Clear</button></div></div></div>'}catch(e){document.getElementById('mgmtLogging').innerHTML='<div class="empty"><p>Failed to load.</p></div>'}}
async function setLogChannel(serverId,category){const chId=document.getElementById('logCh-'+category).value;try{await fetch('/api/server/'+serverId+'/log/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category,channelId:chId||null})});showToast('Channel set!')}catch{showToast('Failed',true)}}
 async function saveAllLogSettings(serverId){const categories=[];const cats=["messages","reactions","members","roles","server","voice","threads","emojis","bans","invites","stickers","automod","scheduled","stage","webhooks","integrations"];for(const cat of cats){const sel=document.getElementById("logCh-"+cat);if(sel)categories.push({category:cat,channelId:sel.value||null});}try{const r=await fetch("/api/server/"+serverId+"/log/config/batch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({categories})});const d=await r.json();if(d.success){showToast("All log settings saved!");loadSrvLogging(serverId)}else showToast("Save failed",true)}catch{showToast("Save failed",true)}}
async function addTrackedChannel(serverId){const chId=document.getElementById('trackedChSelect').value;if(!chId)return showToast('Select a channel',true);try{await fetch('/api/server/'+serverId+'/log/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackedChannel:chId,trackedChannels:'add'})});showToast('Added!');loadSrvLogging(serverId)}catch{showToast('Failed',true)}}
async function removeTrackedChannel(serverId,chId){try{await fetch('/api/server/'+serverId+'/log/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackedChannel:chId,trackedChannels:'remove'})});showToast('Removed!');loadSrvLogging(serverId)}catch{showToast('Failed',true)}}
async function clearTrackedChannels(serverId){try{await fetch('/api/server/'+serverId+'/log/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackedChannels:'clear'})});showToast('Cleared!');loadSrvLogging(serverId)}catch{showToast('Failed',true)}}

async function loadSrvAudit(id){const el=document.getElementById('mgmtAudit');try{const[rd,rs]=await Promise.all([fetch('/api/server/'+id+'/audit'),fetch('/api/server/'+id)]),audit=await rd.json(),server=await rs.json();if(!audit||!audit.length)return el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><p>No recent audit log entries.</p><p style="font-size:10px;color:var(--text-muted);margin-top:6px;">The bot may lack the \'View Audit Log\' permission.</p></div>';el.innerHTML=audit.map(function(e){var time=Math.floor((Date.now()-e.createdTimestamp)/1000),timeStr=time<60?time+'s ago':time<3600?Math.floor(time/60)+'m ago':time<86400?Math.floor(time/3600)+'h ago':Math.floor(time/86400)+'d ago';var actNames={1:'Server Updated',10:'Channel Created',11:'Channel Updated',12:'Channel Deleted',13:'Channel Permission Update',14:'Channel Overwrite Delete',20:'Member Kicked',21:'Member Prune',22:'Member Banned',23:'Member Unbanned',24:'Member Updated',25:'Member Role Updated',26:'Member Move',27:'Member Disconnect',28:'Bot Added',30:'Role Created',31:'Role Updated',32:'Role Deleted',40:'Invite Created',41:'Invite Deleted',42:'Invite Updated',50:'Webhook Created',51:'Webhook Updated',52:'Webhook Deleted',60:'Emoji Created',61:'Emoji Updated',62:'Emoji Deleted',70:'Message Deleted',71:'Message Bulk Delete',72:'Message Pin',73:'Message Unpin',80:'Integration Created',81:'Integration Updated',82:'Integration Deleted',90:'Sticker Created',91:'Sticker Updated',92:'Sticker Deleted',100:'Stage Started',101:'Stage Ended',102:'Stage Updated',110:'Thread Created',111:'Thread Updated',112:'Thread Deleted',120:'Scheduled Event Created',121:'Scheduled Event Updated',122:'Scheduled Event Deleted',130:'Auto Mod Block',140:'Auto Mod Rule Created',141:'Auto Mod Rule Updated',142:'Auto Mod Rule Deleted',143:'Auto Mod Flag Message',144:'Auto Mod Timeout'};var actionName=actNames[e.action]||e.actionType||'Action';return'<div class="act-item"><img src="'+(e.executorAvatar||'https://cdn.discordapp.com/embed/avatars/0.png')+'" style="width:24px;height:24px;border-radius:6px;flex-shrink:0;"><div class="a-tx"><strong>'+(e.executorTag||'Unknown')+'</strong> &#8209; '+actionName+(e.reason?'<br><span style="font-size:10px;color:var(--text-dim);">Reason: '+e.reason+'</span>':'')+'</div><div class="a-tm">'+timeStr+'</div></div>'}).join('')}catch{el.innerHTML='<div class="empty"><p>Failed to load audit log.</p></div>'}}

async function loadAct(){const el=document.getElementById('actFeed');try{const r=await fetch('/api/activity'),a=await r.json();if(!a.length||a.length<2)return el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><p>Activity will appear as people join.</p></div>';const items=a.slice(-20).filter(x=>x.type).reverse();el.innerHTML=items.map(x=>{const c=x.type==='join'?'#3ba55c':'#ed4245',b=x.type==='join'?'rgba(59,165,92,0.12)':'rgba(237,66,69,0.12)';return'<div class="act-item"><div class="a-ico" style="background:'+b+'"><svg viewBox="0 0 24 24" fill="none" stroke="'+c+'" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/></svg></div><div class="a-tx">Member '+(x.type==='join'?'joined':'left')+' <strong>'+x.guildName+'</strong></div><div class="a-tm">now</div></div>'}).join('')}catch{el.innerHTML='<div class="empty"><p>Failed to load.</p></div>'}}
async function loadRm(){const el=document.getElementById('rmdList');try{const r=await fetch('/api/reminders'),rm=await r.json();if(!rm.length)return el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/></svg><p>No pending reminders.</p></div>';el.innerHTML=rm.map(r=>{const t=r.remindAt-Date.now(),m=Math.floor(t/60000),s=Math.floor((t%60000)/1000);return'<div class="rmd"><span class="rmd-tm">'+(t>0?(m>0?m+'m ':'')+s+'s':'Due')+'</span><span class="rmd-tx">'+r.text+'</span></div>'}).join('')}catch{el.innerHTML='<div class="empty"><p>Failed to load.</p></div>'}}
async function loadSys(){try{const r=await fetch('/api/system'),s=await r.json();document.getElementById('sysHost').innerHTML='<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;"><span style="color:var(--text-dim);">Platform</span><span>'+s.platform+'</span></div><div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;"><span style="color:var(--text-dim);">Node</span><span>'+s.nodeVersion+'</span></div><div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;"><span style="color:var(--text-dim);">CPU</span><span>'+s.cpuCores+' cores</span></div><div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;"><span style="color:var(--text-dim);">Uptime</span><span>'+s.uptime+'</span></div>';// Cap RAM display (containers report host memory, use process values)
let memLabel='System',memUsedDisplay=s.memoryUsed,memTotalDisplay=s.memoryTotal,memUsageDisplay=s.memoryUsage;
if(parseFloat(s.memoryTotal)>64){memLabel='Container (process)';memUsedDisplay=s.rss;memTotalDisplay='RSS';memUsageDisplay=Math.min(100,(parseFloat(s.heapUsed)/Math.max(1,parseFloat(s.heapTotal)))*100)}else{memLabel='System';memUsedDisplay=s.memoryUsed;memTotalDisplay=s.memoryTotal+' GB'}
document.getElementById('sysMem').innerHTML='<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;"><span style="color:var(--text-dim);">'+memLabel+'</span><span>'+memUsedDisplay+'/'+memTotalDisplay+(memTotalDisplay==='RSS'?' MB':' GB')+'</span></div><div class="prog"><div class="pf" style="width:'+memUsageDisplay+'%"></div></div></div>'+
      '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;"><span style="color:var(--text-dim);">RSS</span><span>'+s.rss+' MB</span></div><div class="prog"><div class="pf" style="width:'+Math.min(100,(s.rss/1024)*100)+'%;background:rgba(var(--accent-rgb),0.5);"></div></div></div><div><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;"><span style="color:var(--text-dim);">Heap</span><span>'+s.heapUsed+'/'+s.heapTotal+' MB</span></div><div class="prog"><div class="pf" style="width:'+Math.min(100,(parseFloat(s.heapUsed)/parseFloat(s.heapTotal))*100)+'%;background:rgba(59,165,92,0.5);"></div></div></div>'}catch{}}
// ═══ BOT CUSTOMIZATION ═══
async function updateBotPresence(){const type=document.getElementById('botPresenceType').value,text=document.getElementById('botPresenceText').value;if(!text)return showToast('Enter a presence text',true);try{const r=await fetch('/api/bot/presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,text})}),d=await r.json();d.success?showToast('Presence updated!'):showToast(d.error||'Failed',true)}catch{showToast('Failed to update',true)}}
async function updateBotName(){const name=document.getElementById('botNameInput').value;if(!name)return showToast('Enter a name',true);if(name.length>32)return showToast('Max 32 characters',true);try{const r=await fetch('/api/bot/name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})}),d=await r.json();if(d.success){showToast('Username changed!');document.getElementById('botNameInput').value=''}else showToast(d.error||'Failed',true)}catch{showToast('Failed to rename',true)}}
async function updateBotAvatar(){const url=document.getElementById('botAvatarInput').value;if(!url)return showToast('Enter an image URL',true);try{const r=await fetch('/api/bot/avatar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})}),d=await r.json();if(d.success){showToast('Avatar changed!');document.getElementById('botAvatarInput').value='';// Refresh sidebar avatar
const img=document.getElementById('sbAvatar'),def=document.getElementById('sbIconDefault');img.src=d.avatar;img.style.display='block';def.style.display='none'}else showToast(d.error||'Failed',true)}catch{showToast('Failed to set avatar',true)}}

// ═══ BUGS BADGE THEME ═══
(function(){const b=document.getElementById('bugBadge');if(b){const o=new MutationObserver(()=>{b.style.color=document.body.classList.contains('light-mode')?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.06)'});o.observe(document.body,{attributes:true,attributeFilter:['class']})}})();

// ═══ BRANDING ═══
async function loadBrand(){try{const r=await fetch('/api/status');if(r.ok){const d=await r.json();if(d.brandName)document.getElementById('brandFt').textContent='Powered by '+d.brandName}}catch{}}

function stRf(){if(rTimer)clearInterval(rTimer);rTimer=setInterval(()=>{loadOv();loadRm()},rInt*1000)}
window.addEventListener('resize',()=>{rsBg();startBg(bgStyle)});
// ═══ GREETINGS (Welcome / Goodbye) ═══

function greetFieldsHtml(cfg,type,serverId,channels){
  const typeLabel=type==='welcome'?'Welcome':'Goodbye';
  var chOpts='<option value="">— No channel (disabled) —</option>';
  if(channels&&channels.length)channels.forEach(function(c){chOpts+='<option value="'+c.id+'"'+(c.id===cfg.channelId?' selected':'')+'>#'+c.name+'</option>'});
  var cId='gr_'+type+'_'+serverId;
  return 
  '<div style="margin-bottom:16px;">'+
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

async function loadSrvGreetings(id){
  const el=document.getElementById('mgmtGreetings');
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

window.addEventListener('beforeunload',()=>{if(bgAnimId)cancelAnimationFrame(bgAnimId)});

checkAuth().then(async ok=>{if(!ok)return;initThemes();initBgStyles();await loadCfg();startBg(cfg.backgroundStyle||'dots');initDock();await loadOv();await loadAn();await loadServers();await loadAct();await loadRm();await loadSys();loadBrand();stRf()});
