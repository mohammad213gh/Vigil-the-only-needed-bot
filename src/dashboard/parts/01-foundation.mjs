
// ═══ BACKGROUND ENGINES ═══
const bgCanvas=document.getElementById('bgCanvas'),bgCtx=bgCanvas.getContext('2d');
export let bgEngine=null,bgStyle='dots',bgAnimId=null;
const BG_STYLES=[
  {id:'dots',name:'Dots',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>'},
  {id:'shapes',name:'Shapes',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="7" height="7" rx="1"/><circle cx="17" cy="7.5" r="3.5"/><polygon points="12,22 8,14 16,14"/></svg>'},
  {id:'glitch',name:'Glitch',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="4 7 4 4 20 4 20 7"/><polyline points="4 20 4 17 20 17 20 20"/><line x1="10" y1="4" x2="6" y2="17"/><line x1="16" y1="4" x2="18" y2="17"/></svg>'},
  {id:'liquid',name:'Liquid',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2C7.5 6 4 9 4 13c0 4.4 3.6 8 8 8s8-3.6 8-8c0-4-3.5-7-8-11z"/></svg>'},
  {id:'grid',name:'Grid',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>'},
  {id:'constellation',name:'Constellation',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="5" cy="5" r="1.5"/><circle cx="19" cy="8" r="1.5"/><circle cx="12" cy="16" r="1.5"/><circle cx="20" cy="19" r="1.5"/><path d="M6.2 6l11.4 1.7M17.7 9.2l-4.6 5.6M13.2 17.2l5.6 1.3"/></svg>'},
  {id:'aurora',name:'Aurora',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 16c3-8 6 4 9-4s6 4 9-4"/><path d="M3 20c3-8 6 4 9-4s6 4 9-4" opacity="0.5"/></svg>'},
  {id:'starfield',name:'Starfield',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="8" r="0.7" fill="currentColor"/><circle cx="18" cy="6" r="0.7" fill="currentColor"/><circle cx="16" cy="17" r="0.7" fill="currentColor"/><circle cx="7" cy="18" r="0.7" fill="currentColor"/><circle cx="21" cy="12" r="0.5" fill="currentColor"/></svg>'},
  {id:'waves',name:'Waves',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5-.5"/><path d="M2 14c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5-.5"/><path d="M2 20c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5-.5"/></svg>'},
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
function engConstellation(){const w=window.innerWidth,h=window.innerHeight,N=Math.min(70,Math.floor(w*h/22000));engState.constP=[];for(let i=0;i<N;i++)engState.constP.push({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-0.5)*0.35,vy:(Math.random()-0.5)*0.35,r:1+Math.random()*1.4});return function(){bgCtx.clearRect(0,0,w,h);const ac=getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim()||'88,101,242',ps=engState.constP,LINK=130;for(const p of ps){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>w)p.vx*=-1;if(p.y<0||p.y>h)p.vy*=-1}for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const dx=ps[i].x-ps[j].x,dy=ps[i].y-ps[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<LINK){bgCtx.beginPath();bgCtx.moveTo(ps[i].x,ps[i].y);bgCtx.lineTo(ps[j].x,ps[j].y);bgCtx.strokeStyle=`rgba(${ac},${(1-d/LINK)*0.14})`;bgCtx.lineWidth=0.6;bgCtx.stroke()}}for(const p of ps){const dx=bgMouse.x-p.x,dy=bgMouse.y-p.y,d=Math.sqrt(dx*dx+dy*dy),near=d<150?(1-d/150):0;bgCtx.beginPath();bgCtx.arc(p.x,p.y,p.r+near*1.2,0,Math.PI*2);bgCtx.fillStyle=`rgba(${ac},${0.25+near*0.45})`;bgCtx.fill()}}}
function engAurora(){let t=0;return function(){const w=window.innerWidth,h=window.innerHeight;t+=0.004;bgCtx.clearRect(0,0,w,h);const ac=getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim()||'88,101,242',[r,g,b]=ac.split(',').map(Number),bands=[[0.25,140,0.05],[0.5,260,0.04],[0.72,200,0.045]];for(const[yc,R,al]of bands){const cx=w*(0.5+0.32*Math.sin(t*1.7+yc*9)),cy=h*yc+Math.sin(t*2.3+yc*7)*60,grd=bgCtx.createRadialGradient(cx,cy,0,cx,cy,R);grd.addColorStop(0,`rgba(${r},${g},${b},${al})`);grd.addColorStop(1,'transparent');bgCtx.fillStyle=grd;bgCtx.fillRect(0,0,w,h)}const mx=bgMouse.x/w-0.5;bgCtx.globalCompositeOperation='lighter';const glow=bgCtx.createRadialGradient(bgMouse.x,bgMouse.y,0,bgMouse.x,bgMouse.y,180);glow.addColorStop(0,`rgba(${r},${g},${b},0.05)`);glow.addColorStop(1,'transparent');bgCtx.fillStyle=glow;bgCtx.fillRect(0,0,w,h);bgCtx.globalCompositeOperation='source-over'}}
function engStarfield(){const w=window.innerWidth,h=window.innerHeight,N=Math.min(160,Math.floor(w*h/9000));engState.stars=[];for(let i=0;i<N;i++)engState.stars.push({x:Math.random()*w,y:Math.random()*h,z:0.3+Math.random()*0.7,tw:Math.random()*Math.PI*2});return function(){bgCtx.clearRect(0,0,w,h);const ac=getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim()||'88,101,242',t=performance.now()/1000,cx=w/2,cy=h/2;for(const s of engState.stars){s.tw+=0.02;const dx=s.x-cx,dy=s.y-cy;s.x+=dx*0.00035*s.z;s.y+=dy*0.00035*s.z;if(s.x<-10)s.x=w+10;if(s.x>w+10)s.x=-10;if(s.y<-10)s.y=h+10;if(s.y>h+10)s.y=-10;const a=(0.12+0.3*s.z)*(0.7+0.3*Math.sin(s.tw)),mdx=bgMouse.x-s.x,mdy=bgMouse.y-s.y,near=Math.max(0,1-Math.sqrt(mdx*mdx+mdy*mdy)/180);bgCtx.beginPath();bgCtx.arc(s.x,s.y,s.z*1.3+near,0,Math.PI*2);bgCtx.fillStyle=`rgba(${ac},${Math.min(0.8,a+near*0.3)})`;bgCtx.fill()}}}
function engWaves(){let t=0;return function(){const w=window.innerWidth,h=window.innerHeight;t+=0.008;bgCtx.clearRect(0,0,w,h);const ac=getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim()||'88,101,242',layers=5;for(let l=0;l<layers;l++){const yBase=h*(0.25+l*0.15),amp=14+l*8,spd=0.5+l*0.18,freq=0.006-l*0.0006,alpha=0.16-l*0.022;bgCtx.beginPath();for(let x=0;x<=w;x+=6){const y=yBase+Math.sin(x*freq+t*spd)*amp+Math.sin(x*freq*2.7+t*spd*1.4)*amp*0.4;x===0?bgCtx.moveTo(x,y):bgCtx.lineTo(x,y)}bgCtx.strokeStyle=`rgba(${ac},${alpha})`;bgCtx.lineWidth=1.2;bgCtx.stroke()}const grd=bgCtx.createLinearGradient(0,0,0,h);grd.addColorStop(0,`rgba(${ac},0.03)`);grd.addColorStop(0.5,'transparent');grd.addColorStop(1,`rgba(${ac},0.02)`);bgCtx.fillStyle=grd;bgCtx.fillRect(0,0,w,h)}}
const ENGINES={dots:engDots,shapes:engShapes,glitch:engGlitch,liquid:engLiquid,grid:engGrid,constellation:engConstellation,aurora:engAurora,starfield:engStarfield,waves:engWaves};
export function startBg(style){if(bgAnimId){cancelAnimationFrame(bgAnimId);bgAnimId=null}bgStyle=style||'dots';const fn=ENGINES[bgStyle];if(!fn){bgCtx.clearRect(0,0,bgCanvas.width,bgCanvas.height);return}rsBg();bgEngine=fn();!function l(){bgEngine();bgAnimId=requestAnimationFrame(l)}()}
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
export const srObs=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');srObs.unobserve(e.target)}})},{threshold:0.1});

// ═══ ANIMATED COUNTER ═══
function animCount(el,target,dur=600+Math.random()*200){
  const start=parseInt(el.textContent.replace(/,/g,'').replace(/[^0-9-]/g,''))||0,t0=performance.now();
  !function step(t){const p=Math.min((t-t0)/dur,1),e=1-Math.pow(1-p,3),v=Math.round(start+(target-start)*e);el.textContent=v.toLocaleString();if(p<1)requestAnimationFrame(step)}(performance.now())
}
// Catmull-Rom → cubic bezier for Apple-smooth sparklines
function smoothPath(ptsStr){const pts=(ptsStr||'').split(' ').filter(Boolean).map(p=>p.split(',').map(Number));if(pts.length<2)return'M0 0';let d='M'+pts[0][0]+' '+pts[0][1];for(let i=0;i<pts.length-1;i++){const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(pts.length-1,i+2)];d+='C'+(p1[0]+(p2[0]-p0[0])/6).toFixed(1)+' '+(p1[1]+(p2[1]-p0[1])/6).toFixed(1)+' '+(p2[0]-(p3[0]-p1[0])/6).toFixed(1)+' '+(p2[1]-(p3[1]-p1[1])/6).toFixed(1)+' '+p2[0].toFixed(1)+' '+p2[1].toFixed(1)}return d}

// ═══ EXPORT ═══
export async function exportStats(){try{const r=await fetch('/api/stats/export'),d=await r.json();const blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='growth-data-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);showToast('Data exported!')}catch{showToast('Export failed',true)}}

// ═══ LAST REFRESHED ═══
export function updateRefreshTimestamp(sectionId){
  const el=document.getElementById('rfsh-'+sectionId);
  if(!el)return;
  const now=new Date();
  const t=now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  el.textContent='\u23F3 Updated '+t;
}

// ═══ COMMAND USAGE CHART ═══
export async function loadCmdUsage(){
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
export async function exportConfig(){
  try{
    const r=await fetch('/api/dash/config'),d=await r.json();
    const blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='dashboard-config-'+new Date().toISOString().slice(0,10)+'.json';a.click();
    URL.revokeObjectURL(url);showToast('Config exported!')
  }catch{showToast('Export failed',true)}
}
export async function exportBotConfig(){
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
export let curSrv=null,cfg={},rInt=5,rTimer=null,allServers=[],darkMode=true;
const THEMES=[
  {name:'Purple',color:'#5865F2'},{name:'Blue',color:'#3b82f6'},{name:'Green',color:'#10b981'},
  {name:'Cyan',color:'#06b6d4'},{name:'Pink',color:'#ec4899'},{name:'Orange',color:'#f97316'},
  {name:'Red',color:'#ef4444'},{name:'White',color:'#e8e8ee'},{name:'Amber',color:'#f59e0b'},
  {name:'Lime',color:'#84cc16'},{name:'Teal',color:'#14b8a6'},{name:'Rose',color:'#f43f5e'},
];
const PALETTES=[
  {id:'discord',name:'Discord',swatch:'linear-gradient(135deg,#5865F2 0%,#07070d 100%)'},
  {id:'midnight',name:'Midnight',swatch:'linear-gradient(135deg,#23264d 0%,#010104 100%)'},
  {id:'nord',name:'Nord',swatch:'linear-gradient(135deg,#88c0d0 0%,#242933 100%)'},
  {id:'dracula',name:'Dracula',swatch:'linear-gradient(135deg,#bd93f9 0%,#1b1c28 100%)'},
  {id:'forest',name:'Forest',swatch:'linear-gradient(135deg,#86efac 0%,#0d1410 100%)'},
  {id:'sunset',name:'Sunset',swatch:'linear-gradient(135deg,#fb923c 0%,#150f0d 100%)'},
  {id:'ocean',name:'Ocean',swatch:'linear-gradient(135deg,#38bdf8 0%,#081420 100%)'},
  {id:'rose',name:'Rose',swatch:'linear-gradient(135deg,#f43f5e 0%,#160d13 100%)'},
];
function applyPalette(id){document.body.classList.remove(...PALETTES.map(p=>'theme-'+p.id));if(id&&id!=='discord')document.body.classList.add('theme-'+id);document.querySelectorAll('#paletteGrid .pal-pick').forEach(e=>e.classList.toggle('active',e.dataset.pal===(id||'discord')))}
function setFont(v){document.body.classList.remove('font-system','font-grotesk','font-rounded','font-mono');if(v&&v!=='inter')document.body.classList.add('font-'+v)}
function setRadiusScale(v){document.body.classList.remove('radius-compact','radius-pill');if(v==='compact')document.body.classList.add('radius-compact');else if(v==='pill')document.body.classList.add('radius-pill')}
function setBorderStrength(v){document.body.classList.remove('border-subtle','border-strong');if(v==='subtle')document.body.classList.add('border-subtle');else if(v==='strong')document.body.classList.add('border-strong')}
export function previewFont(v){setFont(v)}
export function previewRadius(v){setRadiusScale(v)}
export function previewBorder(v){setBorderStrength(v)}
export function initPalettes(){const g=document.getElementById('paletteGrid');if(!g)return;PALETTES.forEach(p=>{const b=document.createElement('button');b.className='pal-pick'+(p.id==='discord'?' active':'');b.dataset.pal=p.id;b.style.setProperty('--swatch',p.swatch);b.innerHTML='<span>'+p.name+'</span>';b.onclick=()=>applyPalette(p.id);g.appendChild(b)})}

// ═══ BRANDING (logo + favicon) ═══
function safeAssetUrl(u){return typeof u==='string'&&(/^https:\/\/.+/.test(u)||/^\/uploads\//.test(u))?u:null}
function applyLogo(url){const el=document.getElementById('notchLogo');if(!el)return;url=safeAssetUrl(url);if(url){el.innerHTML='<img src="'+esc(url)+'" style="width:24px;height:24px;border-radius:6px;object-fit:cover;" alt="">'}else{el.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="4"/><line x1="3" y1="9" x2="21" y2="9"/><path d="M9 21V9"/></svg>'}}
function applyFavicon(url){url=safeAssetUrl(url);let l=document.querySelector('link[rel="icon"]');if(!url){if(l)l.remove();return}if(!l){l=document.createElement('link');l.rel='icon';document.head.appendChild(l)}l.href=url}
export function uploadBrandAsset(inp,kind){const file=inp.files[0];if(!file)return;const fd=new FormData();fd.append('background',file);fetch('/api/upload',{method:'POST',body:fd}).then(r=>r.json()).then(d=>{if(d.success){document.getElementById(kind==='logo'?'dashLogoUrl':'dashFaviconUrl').value=d.url;showToast('Uploaded — now press Save All Settings')}else showToast('Upload failed',true)}).catch(()=>showToast('Upload failed',true))}
export function clearBrandAsset(kind){document.getElementById(kind==='logo'?'dashLogoUrl':'dashFaviconUrl').value='';if(kind==='logo')applyLogo(null);else applyFavicon(null);showToast('Cleared — press Save All Settings')}
export function showToast(msg,isErr){const t=document.getElementById('toast');t.textContent=msg;t.className='toast'+(isErr?' err':'')+' show';setTimeout(()=>t.classList.remove('show'),2500)}
export async function checkAuth(){try{const r=await fetch('/api/status');if(r.status===401){window.location.href='/login';return false}return r.ok}catch{return false}}
export async function logout(){await fetch('/api/logout',{method:'POST'});window.location.href='/login'}
// ═══ CONFIG ═══
export async function loadCfg(){try{const r=await fetch('/api/dash/config');cfg=await r.json();applyCfg(cfg)}catch{}}
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
  if(c.logoUrl!==undefined){document.getElementById('dashLogoUrl').value=c.logoUrl||'';applyLogo(c.logoUrl)}
  if(c.faviconUrl!==undefined){document.getElementById('dashFaviconUrl').value=c.faviconUrl||'';applyFavicon(c.faviconUrl)}
  if(c.animationPreset){document.getElementById('dashAnimPreset').value=c.animationPreset;const speeds={subtle:0.7,smooth:1,energetic:1.3};const dur=speeds[c.animationPreset]||1;document.documentElement.style.setProperty('--anim-speed',dur)}
  if(c.animationSpeed){document.getElementById('dashAnimSpeed').value=c.animationSpeed;document.documentElement.style.setProperty('--anim-speed',c.animationSpeed)}
  if(c.cardGlow===false)document.querySelectorAll('.card').forEach(ca=>{ca.style.setProperty('--glow-int','0')});
  if(c.ambientLight===false)document.getElementById('ambient').style.display='none';else document.getElementById('ambient').style.display='';
  applyPalette(c.themePreset||'discord');
  setFont(c.fontFamily||'system');document.getElementById('dashFont').value=c.fontFamily||'system';
  const rad=['compact','rounded','pill'].includes(c.borderRadius)?c.borderRadius:'rounded';setRadiusScale(rad);document.getElementById('dashRadius').value=rad;
  const bst=['subtle','normal','strong'].includes(c.borderStrength)?c.borderStrength:'normal';setBorderStrength(bst);document.getElementById('dashBorder').value=bst;
}
export function previewColor(h){const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);document.documentElement.style.setProperty('--accent',h);document.documentElement.style.setProperty('--accent-rgb',r+','+g+','+b);document.getElementById('dashColor').value=h;document.getElementById('colorVal').textContent=h}
export function previewTitle(v){document.getElementById('dashTitlePg').textContent=v||'Overview'}
function applyTheme(isDark){document.body.classList.toggle('light-mode',!isDark);darkMode=isDark;const lb=document.getElementById('themeLabel'),ti=document.getElementById('themeIcon'),tg=document.getElementById('themeToggle'),nti=document.getElementById('ntThemeIcon'),ntl=document.getElementById('ntMobileThemeLabel');if(lb)lb.textContent=isDark?'Light Mode':'Dark Mode';if(ti)ti.innerHTML=isDark?'<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>':'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';if(tg)tg.classList.toggle('on',isDark);if(nti)nti.innerHTML=isDark?'<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>':'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';if(ntl)ntl.textContent=isDark?'Light Mode':'Dark Mode'}
export function toggleTheme(){applyTheme(!darkMode)}
export function toggleMobileMenu(){const menu=document.getElementById('notchMobileMenu'),btn=document.getElementById('notchMobileBtn');if(!menu||!btn)return;menu.classList.toggle('open');btn.querySelector('.notch-hamburger').style.display=menu.classList.contains('open')?'none':'';btn.querySelector('.notch-close').style.display=menu.classList.contains('open')?'':'none'}
function applyPreset(idx){const t=THEMES[idx];previewColor(t.color);document.getElementById('themeGrid').querySelectorAll('.thm-pick').forEach((e,i)=>e.classList.toggle('active',i===idx))}
export function toggleBgType(){const t=document.getElementById('bgType').value;document.getElementById('bgUrlWrap').style.display=t==='url'?'':'none';document.getElementById('bgUploadWrap').style.display=t==='upload'?'':'none'}
export function previewBgBlur(v){const bg=document.getElementById('bgOverlay');bg.className='bg-overlay active'+(v&&v!=='0'?' blur-'+v:'')}
export function previewBg(){const url=document.getElementById('dashBgUrl').value,blur=document.getElementById('dashBgBlur').value;if(url&&url.startsWith('http')){document.getElementById('bgPreview').style.backgroundImage='url('+url+')';document.getElementById('bgPreview').className='bg-pv loaded';const bg=document.getElementById('bgOverlay');bg.style.backgroundImage='url('+url+')';bg.className='bg-overlay active'+(blur&&blur!=='0'?' blur-'+blur:'')}else{document.getElementById('bgPreview').style.backgroundImage='';document.getElementById('bgPreview').className='bg-pv';document.getElementById('bgPreview').textContent='No background set.'}}
export async function uploadBgFile(inp){const file=inp.files[0];if(!file)return;const fd=new FormData();fd.append('background',file);try{const r=await fetch('/api/upload',{method:'POST',body:fd}),d=await r.json();if(d.success){document.getElementById('dashBgUrl').value=d.url;document.getElementById('bgPreview').style.backgroundImage='url('+d.url+')';document.getElementById('bgPreview').className='bg-pv loaded';const bg=document.getElementById('bgOverlay');bg.style.backgroundImage='url('+d.url+')';bg.className='bg-overlay active'+(document.getElementById('dashBgBlur').value!=='0'?' blur-'+document.getElementById('dashBgBlur').value:'');document.getElementById('bgType').value='upload';showToast('Uploaded!')}else showToast('Upload failed',true)}catch{showToast('Upload failed',true)}}
export function togW(el){el.querySelector('.tg').classList.toggle('on')}
function getShowWidgets(){const w={};document.querySelectorAll('.tg').forEach(t=>{if(t.dataset.w)w[t.dataset.w]=t.classList.contains('on')});return w}
export async function saveSettings(){
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
    logoUrl:safeAssetUrl(document.getElementById('dashLogoUrl').value),
    faviconUrl:safeAssetUrl(document.getElementById('dashFaviconUrl').value),
    dashboardLook:cfg.dashboardLook||'neo',
    themePreset:(document.querySelector('#paletteGrid .pal-pick.active')||{}).dataset?.pal||'discord',
    fontFamily:document.getElementById('dashFont').value,
    borderRadius:document.getElementById('dashRadius').value,
    borderStrength:document.getElementById('dashBorder').value,
  };
  try{const r=await fetch('/api/dash/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cfg2)}),d=await r.json();if(d.success){applyCfg(d.config);showToast('Settings saved!')}}catch{showToast('Failed to save',true)}
}
export function initThemes(){const g=document.getElementById('themeGrid');THEMES.forEach((t,i)=>{const d=document.createElement('div');d.className='thm-pick'+(!i?' active':'');d.style.background=t.color;d.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';d.onclick=()=>applyPreset(i);g.appendChild(d)})}
export function initBgStyles(){const g=document.getElementById('bgStyleGrid');BG_STYLES.forEach((s,i)=>{const d=document.createElement('button');d.className='bg-style-opt'+(i===0?' active':'');d.dataset.bg=s.id;d.innerHTML=s.icon+'<span>'+s.name+'</span>';d.onclick=function(){g.querySelectorAll('.bg-style-opt').forEach(e=>e.classList.remove('active'));this.classList.add('active');switchBg(s.id)};g.appendChild(d)})}

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
export function showSkeleton(el,type,count){count=count||3;if(!SKELETONS[type]){el.innerHTML='<div class="sk"><div class="sk-line w80 h16"></div><div class="sk-line w60" style="margin-top:8px;"></div><div class="sk-line w40" style="margin-top:6px;"></div></div>';return}var html='';for(var i=0;i<count;i++)html+=SKELETONS[type];el.innerHTML=html}

// ═══ TIME SINCE HELPER ═══
export function timeSince(ts){if(!ts||typeof ts!=='number')return'';const d=Date.now()-ts;if(d<60000)return Math.floor(d/1000)+'s ago';if(d<3600000)return Math.floor(d/60000)+'m ago';if(d<86400000)return Math.floor(d/3600000)+'h ago';return Math.floor(d/86400000)+'d ago'}

// ═══ DATA LOADERS ═══
export async function loadAudit(){
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
export async function loadOv(){
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
export async function loadAn(){try{const r=await fetch('/api/stats/aggregate'),d=await r.json();if(d.timeline){animCount(document.getElementById('anJoins'),d.totalJoins);animCount(document.getElementById('anLeaves'),d.totalLeaves);const net=d.netGrowth||0;document.getElementById('anNet').textContent=(net>=0?'+':'')+net;document.getElementById('anNet').style.color=net>=0?'#3ba55c':'#ed4245';const tl=d.timeline,ac=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#5865F2';// Build SVG line chart
var maxJoin=Math.max.apply(null,tl.map(function(s){return s.joins||0}));var maxLeave=Math.max.apply(null,tl.map(function(s){return s.leaves||0}));var overallMax=Math.max(maxJoin,maxLeave,1);var anW=Math.max(100,tl.length*8+40),anH=130,p=12,ch2=90,cw2=anW-p*2;var joinPts=tl.map(function(s,i){var x=p+(i/(tl.length-1||1))*cw2,y=anH-20-(s.joins||0)/overallMax*(ch2-8);return x+','+y;}).join(' ');var leavePts=tl.map(function(s,i){var x=p+(i/(tl.length-1||1))*cw2,y=anH-20-(s.leaves||0)/overallMax*(ch2-8);return x+','+y;}).join(' ');var joinArea=tl.map(function(s,i){var x=p+(i/(tl.length-1||1))*cw2,y=anH-20-(s.joins||0)/overallMax*(ch2-8);return x+','+y;}).join(' ')+' '+p+','+(anH-20)+' '+(p+cw2)+','+(anH-20);var leaveArea=tl.map(function(s,i){var x=p+(i/(tl.length-1||1))*cw2,y=anH-20-(s.leaves||0)/overallMax*(ch2-8);return x+','+y;}).join(' ')+' '+p+','+(anH-20)+' '+(p+cw2)+','+(anH-20);const anDots=tl.map(function(s,i){var x=p+(i/(tl.length-1||1))*cw2,jy=anH-20-(s.joins||0)/overallMax*(ch2-8),ly=anH-20-(s.leaves||0)/overallMax*(ch2-8);return '<circle cx="'+x+'" cy="'+jy+'" r="2" fill="#30d158" stroke="var(--bg)" stroke-width="1.5"><title>'+s.date+': +'+(s.joins||0)+'</title></circle>'+'<circle cx="'+x+'" cy="'+ly+'" r="2" fill="#ff453a" stroke="var(--bg)" stroke-width="1.5"><title>'+s.date+': -'+(s.leaves||0)+'</title></circle>';}).join('');var anLabels=tl.map(function(s,i){if(i%Math.max(1,Math.floor(tl.length/6))===0||i===tl.length-1){var x=p+(i/(tl.length-1||1))*cw2;return'<text x="'+x+'" y="'+(anH-4)+'" text-anchor="middle" fill="var(--text-muted)" font-size="7" font-family="Inter,sans-serif">'+s.date.slice(5)+'</text>'}return''}).join('');document.getElementById('growthChart').innerHTML='<svg viewBox="0 0 '+anW+' '+anH+'" style="width:100%;height:120px;display:block;"><defs><linearGradient id="jgF2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3ba55c" stop-opacity="0.2"/><stop offset="100%" stop-color="#3ba55c" stop-opacity="0.01"/></linearGradient><linearGradient id="lgF2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ed4245" stop-opacity="0.12"/><stop offset="100%" stop-color="#ed4245" stop-opacity="0.01"/></linearGradient></defs><polygon points="'+joinArea+'" fill="url(#jgF2)"/><polygon points="'+leaveArea+'" fill="url(#lgF2)"/><path d="'+smoothPath(joinPts)+'" fill="none" stroke="#30d158" stroke-width="2" stroke-linecap="round"/><path d="'+smoothPath(leavePts)+'" fill="none" stroke="#ff453a" stroke-width="1.5" stroke-linecap="round" opacity="0.65"/><text x="8" y="14" fill="#3ba55c" font-size="7" font-family="Inter,sans-serif" opacity="0.7">Joins</text><text x="8" y="23" fill="#ed4245" font-size="7" font-family="Inter,sans-serif" opacity="0.7">Leaves</text>'+anDots+anLabels+'</svg>'}
    updateRefreshTimestamp('analytics');
  }catch{}}
export async function loadServers(){const list=document.getElementById('srvList');showSkeleton(list,'servers',4);try{const r=await fetch('/api/servers');allServers=await r.json();if(!allServers.length)return list.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/></svg><p>No servers found</p><p class="empty-act">Invite the bot to a server in Discord to see it here. Use the OAuth2 URL in your Discord Developer Portal.</p></div>';renderServers(allServers);updateRefreshTimestamp('servers')}catch{list.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Couldn\'t load servers</p><p class="empty-act">The bot may be starting up or Discord API is unreachable.</p></div>'}}
function renderServers(srvs){const sort=document.getElementById('srvSort').value;if(sort==='name')srvs.sort((a,b)=>a.name.localeCompare(b.name));else if(sort==='boosts')srvs.sort((a,b)=>b.boostCount-a.boostCount);else srvs.sort((a,b)=>b.memberCount-a.memberCount);const tierNames=['','Tier 1','Tier 2','Tier 3'];document.getElementById('srvList').innerHTML=srvs.map(s=>'<div class="srv-card" data-fn="showSrv" data-args=\'['+fnData(s.id)+']\'><img src="'+(s.icon||'https://cdn.discordapp.com/embed/avatars/0.png')+'" alt=""><div class="si"><h3>'+esc(s.name)+'</h3><p>'+s.memberCount.toLocaleString()+' members</p></div><span class="bdg"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'+(tierNames[s.boostTier]||'')+'</span></div>').join('')}
export function filterServers(){const q=document.getElementById('srvSearch').value.toLowerCase();if(!q)return renderServers(allServers);renderServers(allServers.filter(s=>s.name.toLowerCase().includes(q)))}
export async function showSrv(id){curSrv=id;document.getElementById('srvList').style.display='none';const dt=document.getElementById('srvDetail');dt.style.display='block';showSkeleton(dt,'srv-detail',1);try{const r=await fetch('/api/server/'+id),d=await r.json();const net=d.stats.totalJoins-d.stats.totalLeaves,snap=d.stats.snapshots||[],recent=snap.slice(-7).reduce((a,s)=>a+s.joins-s.leaves,0);            dt.innerHTML='<button class="bck" data-fn="backSrv"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>Back</button><div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;"><img src="'+(d.icon||'https://cdn.discordapp.com/embed/avatars/0.png')+'" style="width:48px;height:48px;border-radius:12px;"><div><h2 style="font-size:20px;font-weight:800;color:#fff;">'+esc(d.name)+'</h2><p style="color:var(--text-dim);font-size:12px;">'+d.memberCount.toLocaleString()+' members</p></div></div><div class="grid grid-4"><div class="card"><div class="lbl">Members</div><div class="val">'+d.memberCount.toLocaleString()+'</div></div><div class="card"><div class="lbl">Channels</div><div class="val">'+(d.channels.text+d.channels.voice)+'</div><div class="sub">'+d.channels.text+'T/'+d.channels.voice+'V</div></div><div class="card"><div class="lbl">Roles</div><div class="val">'+d.roles+'</div></div><div class="card"><div class="lbl">Growth</div><div class="val" style="color:'+(net>=0?'#3ba55c':'#ed4245')+'">'+(net>=0?'+':'')+net+'</div><div class="sub">7d: '+(recent>=0?'+':'')+recent+'</div></div></div>'+(snap.length?'<div class="tw"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>Growth (30d)</div><div style="padding:14px;"><div style="display:flex;gap:2px;align-items:end;height:80px;">'+(function(){var snapData=snap.slice(-30);var maxV=Math.max.apply(null,snapData.map(function(x){return Math.max(x.joins,x.leaves,1)}));var svgW=Math.min(snapData.length*10+20,window.innerWidth-80||340),svgH=80;var joinPts=snapData.map(function(s,i){var x=10+i*10,y=75-(s.joins/maxV)*65;return x+','+y;}).join(' ');var leavePts=snapData.map(function(s,i){var x=10+i*10,y=75-(s.leaves/maxV)*65;return x+','+y;}).join(' ');var joinArea=snapData.map(function(s,i){var x=10+i*10,y=75-(s.joins/maxV)*65;return x+','+y;}).join(' ')+' '+10+',75 '+(10+snapData.length*10-10)+',75';var leaveArea=snapData.map(function(s,i){var x=10+i*10,y=75-(s.leaves/maxV)*65;return x+','+y;}).join(' ')+' '+10+',75 '+(10+snapData.length*10-10)+',75';var dots=snapData.map(function(s,i){var x=10+i*10,jy=75-(s.joins/maxV)*65,ly=75-(s.leaves/maxV)*65;return '<circle cx="'+x+'" cy="'+jy+'" r="2" fill="#30d158" stroke="var(--bg)" stroke-width="1.5"><title>'+s.date+': +'+s.joins+'</title></circle><circle cx="'+x+'" cy="'+ly+'" r="2" fill="#ff453a" stroke="var(--bg)" stroke-width="1.5"><title>'+s.date+': -'+s.leaves+'</title></circle>';}).join('');var labels=snapData.map(function(s,i){if(i%Math.max(1,Math.floor(snapData.length/5))===0||i===snapData.length-1){var x=10+i*10;return '<text x="'+x+'" y="82" text-anchor="middle" fill="var(--text-muted)" font-size="6" font-family="Inter,sans-serif">'+s.date.slice(5)+'</text>';}return '';}).join('');return '<svg viewBox="0 0 '+svgW+' '+svgH+'" style="width:100%;height:80px;max-height:80px;"><defs><linearGradient id="jgF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3ba55c" stop-opacity="0.2"/><stop offset="100%" stop-color="#3ba55c" stop-opacity="0.01"/></linearGradient><linearGradient id="lgF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ed4245" stop-opacity="0.15"/><stop offset="100%" stop-color="#ed4245" stop-opacity="0.01"/></linearGradient></defs><polygon points="'+joinArea+'" fill="url(#jgF)"/><polygon points="'+leaveArea+'" fill="url(#lgF)"/><path d="'+smoothPath(joinPts)+'" fill="none" stroke="#30d158" stroke-width="2" stroke-linecap="round"/><path d="'+smoothPath(leavePts)+'" fill="none" stroke="#ff453a" stroke-width="1.5" stroke-linecap="round" opacity="0.65"/><line x1="0" y1="75" x2="'+svgW+'" y2="75" stroke="var(--border)" stroke-width="0.5" opacity="0.3"/>'+dots+labels+'<text x="4" y="9" fill="#3ba55c" font-size="6" font-family="Inter,sans-serif" opacity="0.6">Joins</text><text x="4" y="16" fill="#ed4245" font-size="6" font-family="Inter,sans-serif" opacity="0.6">Leaves</text></svg>';})()+'</div></div></div>':'')+
      // ── Management Tabs ──
      '<div style="margin-top:20px;"><div class="tab-row" style="display:flex;gap:2px;margin-bottom:16px;background:rgba(255,255,255,0.02);border-radius:10px;padding:3px;max-width:420px;">'+
      '<button class="mgmt-tab active" data-tab="overview" data-fn="showSrvTab" data-args=\'[\"overview\"]\' >Overview</button>'+
      '<button class="mgmt-tab" data-tab="roles" data-fn="showSrvTab" data-args=\'[\"roles\",'+fnData(id)+']\' >Roles</button>'+
      '<button class="mgmt-tab" data-tab="channels" data-fn="showSrvTab" data-args=\'[\"channels\",'+fnData(id)+']\' >Channels</button>'+
      '<button class="mgmt-tab" data-tab="logging" data-fn="showSrvTab" data-args=\'[\"logging\",'+fnData(id)+']\' >Logging</button>'+
      '<button class="mgmt-tab" data-tab="audit" data-fn="showSrvTab" data-args=\'[\"audit\",'+fnData(id)+']\' >Audit Log</button>'+
      '<button class="mgmt-tab" data-tab="greetings" data-fn="showSrvTab" data-args=\'[\"greetings\",'+fnData(id)+']\' >Greetings</button>'+
      '<button class="mgmt-tab" data-tab="modtools" data-fn="showSrvTab" data-args=\'[\"modtools\",'+fnData(id)+']\' >Mod Tools</button>'+
      '<button class="mgmt-tab" data-tab="settings" data-fn="showSrvTab" data-args=\'[\"settings\",'+fnData(id)+']\' >Settings</button>'+
      '</div></div>'+
      '<div class="mgmt-panel" data-panel="overview"><div class="grid grid-2">'+(d.logging&&d.logging.perCategory?'<div class="tw"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>Logging</div><table class="tbl"><tr><th>Category</th><th>Channel</th><th>Status</th></tr>'+Object.entries(d.logging.perCategory).map(([cat,info])=>'<tr><td style="text-transform:capitalize;">'+cat+'</td><td>'+(info.channel?'<code>#'+info.channel+'</code>':'<span style="color:var(--text-muted);">Default</span>')+'</td><td><span class="tag '+(info.enabled?'green':'red')+'\">'+(info.enabled?'On':'Off')+'</span></td></tr>').join('')+'</table></div>':'')+'</div></div>'+
      '<div class="mgmt-panel" data-panel="roles" style="display:none;"><div id="mgmtRoles"><div class="loading"><div class="spin"></div></div></div></div>'+
      '<div class="mgmt-panel" data-panel="channels" style="display:none;"><div id="mgmtChannels"><div class="loading"><div class="spin"></div></div></div></div>'+
      '<div class="mgmt-panel" data-panel="logging" style="display:none;"><div id="mgmtLogging"><div class="loading"><div class="spin"></div></div></div></div>'+
      '<div class="mgmt-panel" data-panel="audit" style="display:none;"><div id="mgmtAudit"><div class="loading"><div class="spin"></div></div></div></div>'+
      '<div class="mgmt-panel" data-panel="greetings" style="display:none;"><div id="mgmtGreetings"><div class="loading"><div class="spin"></div></div></div></div>'+
      '<div class="mgmt-panel" data-panel="modtools" style="display:none;"><div id="mgmtModTools"><div class="loading"><div class="spin"></div></div></div></div>'+
      '<div class="mgmt-panel" data-panel="settings" style="display:none;"><div id="mgmtSettings"><div class="loading"><div class="spin"></div></div></div></div>'}catch{dt.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Couldn\'t load server details</p><p class="empty-act">The server may have been deleted or the bot lost access.</p></div>'}}
export function backSrv(){curSrv=null;document.getElementById('srvList').style.display='';document.getElementById('srvDetail').style.display='none'}

export async function loadSrvRoles(id){const el=document.getElementById('mgmtRoles');showSkeleton(el,'roles',4);try{const r=await fetch('/api/server/'+id+'/roles'),roles=await r.json();el.innerHTML=roles.slice(0,40).map(r=>'<div class="srv-card" style="cursor:default;padding:8px 12px;"><div style="width:10px;height:10px;border-radius:50%;background:'+(r.color||'rgba(255,255,255,0.1)')+';flex-shrink:0;"></div><div class="si"><h3>'+esc(r.name)+'</h3><p style="font-size:10px;">'+(r.managed?'Managed by integration':'ID: '+r.id)+'</p></div><span style="font-size:10px;color:var(--text-dim);">'+r.memberCount+' members</span></div>').join('')}catch{el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Couldn\'t load roles</p><p class="empty-act">The bot may need the \'Manage Roles\' permission.</p></div>'}
}
export async function loadSrvChannels(id){const el=document.getElementById('mgmtChannels');showSkeleton(el,'channels',3);try{const r=await fetch('/api/server/'+id+'/channels'),channels=await r.json();const typeColors={Text:'rgba(59,165,92,0.12)',Voice:'rgba(88,101,242,0.12)',Announcement:'rgba(241,196,15,0.12)',Forum:'rgba(241,196,15,0.12)',Unknown:'rgba(255,255,255,0.04)'};el.innerHTML=channels.slice(0,50).map(c=>'<div class="srv-card" style="cursor:default;padding:8px 12px;"><span class="tag '+(c.nsfw?'red':'green')+'" style="margin-right:8px;">#'+esc(c.name)+'</span><div class="si"><h3 style="font-size:12px;">'+esc(c.type)+(c.topic?' — '+esc(c.topic):'')+'</h3></div>'+(c.memberCount!==null?'<span style="font-size:10px;color:var(--text-dim);">'+c.memberCount+' users</span>':'')+(c.bitrate?'<span style="font-size:10px;color:var(--text-dim);">'+(c.bitrate/1000)+'kbps</span>':'')+'</div>').join('')}catch{el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Couldn\'t load channels</p><p class="empty-act">The bot may need the \'View Channels\' permission.</p></div>'}
}
export async function toggleLogCat(serverId,category,enabled){
  try{await fetch('/api/server/'+serverId+'/log/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category,enabled})});showToast('Logging updated!');loadSrvLogging(serverId)}catch{showToast('Failed',true)}
}
export async function loadSrvLogging(id){const el=document.getElementById('mgmtLogging');showSkeleton(el,'logging',1);try{const[r,d]=await Promise.all([fetch('/api/server/'+id+'/channels'),fetch('/api/server/'+id)]),channels=await r.json(),server=await d.json();if(!server.logging||!server.logging.perCategory)return el.innerHTML='<div class="empty"><p>No logging config available.</p></div>';const catHtml=Object.entries(server.logging.perCategory).map(([cat,info])=>{const emojis={messages:'\uD83D\uDCE8',reactions:'\uD83D\uDC4D',members:'\uD83D\uDC65',roles:'\uD83C\uDFF7',server:'\uD83D\uDDA5',voice:'\uD83C\uDFA4',threads:'\uD83E\uDD9C',emojis:'\uD83D\uDE0E',bans:'\uD83D\uDEAB',invites:'\uD83D\uDD17',stickers:'\uD83D\uDC02',automod:'\uD83E\uDD16',scheduled:'\uD83D\uDCC5',stage:'\uD83C\uDF9F',webhooks:'\uD83D\uDD17',integrations:'\uD83D\uDD17'};const chOpts='<option value="">Default (auto)</option>'+channels.filter(c=>c.typeId===0||c.typeId===5||c.typeId===15).map(c=>'<option value="'+c.id+'"'+(c.id===info.channel?' selected':'')+'>#'+esc(c.name)+'</option>').join('');return'<div class="tg-wr" style="cursor:default;display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:4px;"><span style="font-size:12px;flex-shrink:0;">'+(emojis[cat]||'\uD83D\uDCCB')+'</span><div class="tg '+(info.enabled?'on':'')+'" data-fn="toggleLogCat" data-args=\'['+fnData(id)+','+fnData(cat)+','+fnData((!info.enabled))+']\' style="cursor:pointer;flex-shrink:0;"></div><div class="tg-lbl" style="text-transform:capitalize;flex:0 0 100px;font-size:12px;color:var(--text);">'+cat+'</div><select id="logCh-'+cat+'" style="flex:1;min-width:0;padding:5px 8px;font-size:11px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;cursor:pointer;">'+chOpts+'</select></div>'}).join('');const tracked=server.logging.trackedChannels||[];const trackedHtml=tracked.length?'<div style="margin-bottom:8px;display:flex;flex-direction:column;gap:4px;">'+tracked.map(function(cid){var ch=channels.find(function(c){return c.id===cid});return'<div style="display:flex;align-items:center;gap:8px;padding:5px 10px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:6px;"><code style="flex:1;font-size:11px;">'+(ch?'#'+esc(ch.name):esc(cid))+'</code><button class="btn btn-s" data-fn="removeTrackedChannel" data-args=\'['+fnData(id)+','+fnData(cid)+']\' style="padding:3px 8px;font-size:9px;">\u2716</button></div>'}).join('')+'</div>':'<div style="color:var(--text-muted);font-size:11px;margin-bottom:8px;">All channels are logged (no filter).</div>';el.innerHTML='<div class="tw"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>Categories</div><div style="padding:10px;">'+catHtml+'<button class="btn" data-fn="saveAllLogSettings" data-args=\'['+fnData(id)+']\' style="width:100%;margin-top:10px;padding:12px;font-size:14px;font-weight:700;background:linear-gradient(135deg,#3ba55c,#2d8c47);border:none;border-radius:10px;color:#fff;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save All Changes</button></div></div><div class="tw" style="margin-top:10px;"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>Channel Filter <span style="font-weight:400;color:var(--text-dim);font-size:10px;margin-left:4px;">('+(tracked.length||'All')+' tracked)</span></div><div style="padding:10px;"><div class="stg-hint" style="margin-bottom:8px;">When channels are in the list, ONLY those channels get logged. Empty = all channels.</div>'+trackedHtml+'<div style="display:flex;gap:6px;"><select id="trackedChSelect" style="flex:1;min-width:0;padding:5px 8px;font-size:11px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;cursor:pointer;"><option value="">Select a channel...</option>'+channels.filter(function(c){return c.typeId===0||c.typeId===2||c.typeId===5||c.typeId===15}).map(function(c){return'<option value="'+c.id+'">#'+c.name+' ('+c.type+')</option>'}).join('')+'</select><button class="btn btn-s" data-fn="addTrackedChannel" data-args=\'['+fnData(id)+']\' style="padding:5px 10px;font-size:10px;">+ Add</button><button class="btn btn-s" data-fn="clearTrackedChannels" data-args=\'['+fnData(id)+']\' style="padding:5px 10px;font-size:10px;">Clear</button></div></div></div>'}catch(e){document.getElementById('mgmtLogging').innerHTML='<div class="empty"><p>Failed to load.</p></div>'}}

export async function loadSrvAudit(id){const el=document.getElementById('mgmtAudit');showSkeleton(el,'audit',4);try{const[rd,rs]=await Promise.all([fetch('/api/server/'+id+'/audit'),fetch('/api/server/'+id)]),audit=await rd.json(),server=await rs.json();if(!audit||!audit.length)return el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><p>No recent audit log entries.</p><p style="font-size:10px;color:var(--text-muted);margin-top:6px;">The bot may lack the \'View Audit Log\' permission.</p></div>';el.innerHTML=audit.map(function(e){var time=Math.floor((Date.now()-e.createdTimestamp)/1000),timeStr=time<60?time+'s ago':time<3600?Math.floor(time/60)+'m ago':time<86400?Math.floor(time/3600)+'h ago':Math.floor(time/86400)+'d ago';var actNames={1:'Server Updated',10:'Channel Created',11:'Channel Updated',12:'Channel Deleted',13:'Channel Permission Update',14:'Channel Overwrite Delete',20:'Member Kicked',21:'Member Prune',22:'Member Banned',23:'Member Unbanned',24:'Member Updated',25:'Member Role Updated',26:'Member Move',27:'Member Disconnect',28:'Bot Added',30:'Role Created',31:'Role Updated',32:'Role Deleted',40:'Invite Created',41:'Invite Deleted',42:'Invite Updated',50:'Webhook Created',51:'Webhook Updated',52:'Webhook Deleted',60:'Emoji Created',61:'Emoji Updated',62:'Emoji Deleted',70:'Message Deleted',71:'Message Bulk Delete',72:'Message Pin',73:'Message Unpin',80:'Integration Created',81:'Integration Updated',82:'Integration Deleted',90:'Sticker Created',91:'Sticker Updated',92:'Sticker Deleted',100:'Stage Started',101:'Stage Ended',102:'Stage Updated',110:'Thread Created',111:'Thread Updated',112:'Thread Deleted',120:'Scheduled Event Created',121:'Scheduled Event Updated',122:'Scheduled Event Deleted',130:'Auto Mod Block',140:'Auto Mod Rule Created',141:'Auto Mod Rule Updated',142:'Auto Mod Rule Deleted',143:'Auto Mod Flag Message',144:'Auto Mod Timeout'};var actionName=actNames[e.action]||e.actionType||'Action';return'<div class="act-item"><img src="'+(e.executorAvatar||'https://cdn.discordapp.com/embed/avatars/0.png')+'" style="width:24px;height:24px;border-radius:6px;flex-shrink:0;"><div class="a-tx"><strong>'+esc(e.executorTag||'Unknown')+'</strong> &#8209; '+esc(actionName)+(e.reason?'<br><span style="font-size:10px;color:var(--text-dim);">Reason: '+esc(e.reason)+'</span>':'')+'</div><div class="a-tm">'+timeStr+'</div></div>'}).join('')}catch{el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Couldn\'t load audit log</p><p class="empty-act">The bot needs the \'View Audit Log\' permission. Check server settings.</p></div>'}}

export async function loadAct(){const el=document.getElementById('actFeed');showSkeleton(el,'act',3);try{const r=await fetch('/api/activity'),a=await r.json();if(!a.length||a.length<2)return el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><p>Activity will appear as people join.</p></div>';const items=a.slice(-20).filter(x=>x.type).reverse();el.innerHTML=items.map(x=>{const c=x.type==='join'?'#3ba55c':'#ed4245',b=x.type==='join'?'rgba(59,165,92,0.12)':'rgba(237,66,69,0.12)';return'<div class="act-item"><div class="a-ico" style="background:'+b+'"><svg viewBox="0 0 24 24" fill="none" stroke="'+c+'" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/></svg></div><div class="a-tx">Member '+(x.type==='join'?'joined':'left')+' <strong>'+esc(x.guildName)+'</strong></div><div class="a-tm">now</div></div>'}).join('');updateRefreshTimestamp('activity')}catch{el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Couldn\'t load activity</p><p class="empty-act">The bot may be starting up. Activity will appear once members join servers.</p></div>'}
  }
export async function loadRm(){const el=document.getElementById('rmdList');showSkeleton(el,'rmd',4);try{const r=await fetch('/api/reminders'),rm=await r.json();if(!rm.length)return el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/></svg><p>No pending reminders</p><p class="empty-act">Use <code>/remindme 30s &lt;text&gt;</code> in Discord to set your first reminder.</p></div>';el.innerHTML=rm.map(r=>{const t=r.remindAt-Date.now(),m=Math.floor(t/60000),s=Math.floor((t%60000)/1000);return'<div class="rmd"><span class="rmd-tm">'+(t>0?(m>0?m+'m ':'')+s+'s':'Due')+'</span><span class="rmd-tx">'+esc(r.text)+'</span></div>'}).join('');updateRefreshTimestamp('reminders')}catch{el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Couldn\'t load reminders</p><p class="empty-act">The bot may be reconnecting. Try refreshing the page.</p></div>'}
  }

// ═══ GIVEAWAYS MANAGER ═══
function timeUntil(ts){const d=ts-Date.now();if(d<=0)return'now';const m=Math.floor(d/60000);if(m<60)return'in '+m+'m';const h=Math.floor(m/60);if(h<48)return'in '+h+'h';return'in '+Math.floor(h/24)+'d'}
export async function loadGiveaways(){const el=document.getElementById('gwList');if(!el)return;showSkeleton(el,'audit',4);try{const r=await fetch('/api/giveaways'),gs=await r.json();if(!gs.length){el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M5 12v9h14v-9"/></svg><p>No giveaways yet</p><p class="empty-act">Create one above — it posts straight to the selected server.</p></div>';return}el.innerHTML='<div class="tw"><div class="tw-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M5 12v9h14v-9"/></svg>All Giveaways ('+gs.length+')</div><div style="padding:10px;">'+gs.map(function(g){
var stCls=g.status==='active'?'green':(g.status==='cancelled'?'red':'yellow');
var stLabel=g.status.charAt(0).toUpperCase()+g.status.slice(1);
var timeLbl=g.status==='active'?timeUntil(g.endsAt):(g.endedAt?new Date(g.endedAt).toLocaleDateString():'—');
var winners=(g.winnerIds&&g.winnerIds.length)?'Winner'+(g.winnerIds.length>1?'s':'')+': '+esc(g.winnerIds.join(', ')):'';
var btns='';
if(g.status==='active')btns='<button class="btn btn-s" data-fn="endGw" data-args=\'['+fnData(g.id)+']\' style="padding:4px 10px;font-size:10px;">End Now</button> <button class="btn btn-s" data-fn="cancelGw" data-args=\'['+fnData(g.id)+']\' style="padding:4px 10px;font-size:10px;color:#ed4245;">Cancel</button>';
else if(g.status==='ended')btns='<button class="btn btn-s" data-fn="rerollGw" data-args=\'['+fnData(g.id)+']\' style="padding:4px 10px;font-size:10px;">Reroll</button>';
return '<div class="act-item" style="flex-wrap:wrap;gap:10px;"><div style="flex:1;min-width:200px;"><div class="a-tx"><strong>'+esc(g.prize)+'</strong></div><span style="font-size:10px;color:var(--text-dim);">'+esc(g.guildName)+' · '+g.winners+' winner'+(g.winners!==1?'s':'')+' · '+esc(timeLbl)+'</span>'+(winners?'<br><span style="font-size:10px;color:#3ba55c;">'+winners+'</span>':'')+'</div><span class="tag '+stCls+'" style="align-self:center;">'+stLabel+'</span><span style="display:flex;gap:6px;align-self:center;">'+btns+'</span></div>'}).join('')+'</div></div>'}catch{el.innerHTML='<div class="empty"><p>Could not load giveaways.</p></div>'}}
export function populateGwServers(){const sel=document.getElementById('gwSrv');if(!sel||!allServers.length)return;const cur=sel.value;sel.innerHTML='<option value="">Select server…</option>'+allServers.map(s=>'<option value="'+s.id+'">'+esc(s.name)+'</option>').join('');if(cur)sel.value=cur}
export async function createGwUI(){const guildId=document.getElementById('gwSrv').value,prize=document.getElementById('gwPrize').value.trim(),hours=parseFloat(document.getElementById('gwDur').value),winners=parseInt(document.getElementById('gwWinners').value)||1,description=document.getElementById('gwDesc').value.trim();if(!guildId)return showToast('Select a server',true);if(!prize)return showToast('Enter a prize',true);try{const r=await fetch('/api/giveaways/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId,prize,durationHours:hours,winners,description})}),d=await r.json();if(d.success){showToast('Giveaway posted! 🎉');document.getElementById('gwPrize').value='';document.getElementById('gwDesc').value='';loadGiveaways()}else showToast(d.error||'Failed to create',true)}catch{showToast('Failed to create giveaway',true)}}
export async function endGw(id){if(!confirm('Pick winners and end this giveaway now?'))return;try{const r=await fetch('/api/giveaways/end',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}),d=await r.json();if(d.success){showToast('Giveaway ended, winners announced!');loadGiveaways()}else showToast(d.error||'Failed to end',true)}catch{showToast('Failed to end giveaway',true)}}
export async function cancelGw(id){if(!confirm('Cancel this giveaway? No winners will be picked.'))return;try{const r=await fetch('/api/giveaways/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}),d=await r.json();if(d.success){showToast('Giveaway cancelled');loadGiveaways()}else showToast(d.error||'Failed to cancel',true)}catch{showToast('Failed to cancel',true)}}
export async function rerollGw(id){try{const r=await fetch('/api/giveaways/reroll',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}),d=await r.json();if(d.success){showToast('New winner(s) picked!');loadGiveaways()}else showToast(d.error||'Failed to reroll',true)}catch{showToast('Failed to reroll',true)}}

// ═══ COMMANDS ═══
let allCommands=[];
export async function loadCommands(){const el=document.getElementById('cmdList');const filter=document.getElementById('cmdCatFilter');if(!el)return;showSkeleton(el,'commands',5);try{const r=await fetch('/api/commands');allCommands=await r.json();if(!allCommands.length)return el.innerHTML='<div class="empty"><p>No commands found.</p></div>';filter.innerHTML='<option value="all">All Categories</option>'+allCommands.map(c=>'<option value="'+c.category+'">'+c.category+'</option>').join('');renderCommands(allCommands)}catch{el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Couldn\'t load commands</p><p class="empty-act">The bot may be starting up. Try again in a moment.</p></div>'}}
export function esc(s){if(s==null&&s!==0)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
// Serialize a runtime value as the JSON body of one element inside the
// data-args array. Output must be valid JSON after the browser decodes the
// attribute: double quotes stay raw (safe inside a single-quoted attribute),
// single quotes in the data become &#39; so they can't terminate the attribute
// (the browser decodes them back before JSON.parse runs).
export function fnData(v){return JSON.stringify(v).replace(/'/g,'&#39;')}
function renderCommands(data){const el=document.getElementById('cmdList');const totals=data.reduce((a,c)=>a+c.commands.length,0);console.log('[Commands] loaded',data.length,'categories,',totals,'commands');el.innerHTML='<div style="margin-bottom:14px;font-size:11px;color:var(--text-dim);">'+totals+' commands across '+data.length+' categories</div>'+data.map(cat=>'<div class="cmd-cat" data-fn="toggleCollapsed" data-args=\'[\"@el\"]\'><div class="cmd-cat-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="6 9 12 15 18 9"/></svg><span>'+esc(cat.category)+'</span><span class="cmd-count">'+cat.commands.length+'</span><span class="cmd-bdg '+(cat.owner?'owner':'public')+'">'+(cat.owner?'Owner Only':'Public')+'</span></div><div class="cmd-items">'+cat.commands.map(cmd=>'<div class="cmd-item"><code class="cmd-name">/'+esc(cmd.name)+'</code><div class="cmd-desc">'+esc(cmd.description)+'</div><div class="cmd-usage"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>'+esc(cmd.usage)+'</div></div>').join('')+'</div></div>').join('')}
export function filterCommands(){const q=document.getElementById('cmdSearch').value.toLowerCase();const cat=document.getElementById('cmdCatFilter').value;if(!q&&cat==='all')return renderCommands(allCommands);const filtered=allCommands.map(c=>{if(cat!=='all'&&c.category!==cat)return null;const cmds=q?c.commands.filter(cmd=>cmd.name.includes(q)||cmd.description.toLowerCase().includes(q)):c.commands;if(!cmds||!cmds.length)return null;return{...c,commands:cmds};}).filter(Boolean);if(!filtered.length)return document.getElementById('cmdList').innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>No commands match "'+q+'"</p><p class="empty-act">Try a different search term or category.</p></div>';renderCommands(filtered)}

// ═══ SYSTEM: BACKUPS ═══
export async function loadBackups(){
  var el=document.getElementById('backupList');if(!el)return;
  try{
    var r=await fetch('/api/backups'),d=await r.json();
    if(!d||!d.backups){el.innerHTML='<div class="empty"><p>Failed to load backups.</p></div>';return}
    if(!d.backups.length){el.innerHTML='<div class="tk-chip-none">No backups yet — click \u201CBackup Now\u201D or wait for the automatic daily backup.</div>';return}
    el.innerHTML=d.backups.map(function(b){
      var size=b.size>1048576?(b.size/1048576).toFixed(2)+' MB':(b.size/1024).toFixed(1)+' KB';
      return '<div class="bk-row"><span class="bk-name">'+esc(b.name)+'</span><span class="bk-meta">'+size+' · '+tkTimeAgo(b.createdAt)+'</span>'+
        '<button class="btn btn-s" data-fn="dlBackup" data-args=\'['+fnData(b.name)+']\' style="padding:4px 10px;font-size:10px;">Download</button>'+
        '<button class="btn btn-s" data-fn="delBackup" data-args=\'['+fnData(b.name)+']\' style="padding:4px 10px;font-size:10px;background:rgba(237,66,69,0.15);border-color:rgba(237,66,69,0.4);color:#ff7b81;">Delete</button></div>';
    }).join('');
  }catch{el.innerHTML='<div class="empty"><p>Failed to load backups.</p></div>'}
}
export function backupNow(){
  fetch('/api/backups',{method:'POST'}).then(function(r){return r.json()}).then(function(d){
    if(d.success){showToast('Backup created');loadBackups()}
    else showToast(d.error||'Backup failed',true);
  }).catch(function(){showToast('Backup failed',true)});
}
export function dlBackup(name){window.location='/api/backups/download/'+encodeURIComponent(name)}
export function delBackup(name){
  if(!confirm('Delete backup '+name+'?'))return;
  fetch('/api/backups/'+encodeURIComponent(name),{method:'DELETE'}).then(function(r){return r.json()}).then(function(d){
    if(d.success){showToast('Backup deleted');loadBackups()}
    else showToast('Failed to delete',true);
  }).catch(function(){showToast('Failed to delete',true)});
}

// ═══ SYSTEM: ERROR ALERT ═══
var alertGuilds=[];
export async function loadErrorAlert(){
  var srvSel=document.getElementById('alertSrvSel'),chSel=document.getElementById('alertChSel');
  if(!srvSel)return;
  try{
    var r=await fetch('/api/errors/alert'),d=await r.json();
    alertGuilds=d.guilds||[];
    srvSel.innerHTML='<option value="">Select server…</option>'+alertGuilds.map(function(g){return '<option value="'+g.id+'">'+esc(g.name)+'</option>'}).join('');
    chSel.innerHTML='<option value="">Select channel…</option>';
    if(d.channelId){
      for(var i=0;i<alertGuilds.length;i++){
        for(var j=0;j<alertGuilds[i].channels.length;j++){
          if(alertGuilds[i].channels[j].id===d.channelId){
            srvSel.value=alertGuilds[i].id;
            alertSrvChanged();
            chSel.value=d.channelId;
            i=alertGuilds.length;break;
          }
        }
      }
    }
  }catch{}
}
export function alertSrvChanged(){
  var srvSel=document.getElementById('alertSrvSel'),chSel=document.getElementById('alertChSel');
  if(!srvSel||!chSel)return;
  var g=alertGuilds.find(function(x){return x.id===srvSel.value});
  chSel.innerHTML='<option value="">'+(g?'Select channel…':'Select server…')+'</option>'+(g?g.channels.map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+'</option>'}).join(''):'');
}
export function saveErrorAlert(){
  var chSel=document.getElementById('alertChSel');
  var channelId=chSel?chSel.value:'';
  fetch('/api/errors/alert',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channelId:channelId})}).then(function(r){return r.json()}).then(function(d){
    if(d.success)showToast(channelId?'Error alerts enabled':'Error alerts disabled');
    else showToast(d.error||'Failed to save',true);
  }).catch(function(){showToast('Failed to save',true)});
}

// ═══ SETTINGS: DASHBOARD ACCESS ═══
export async function loadDashUsers(){
  var el=document.getElementById('dashUsersList');if(!el)return;
  try{
    var r=await fetch('/api/dash/users'),users=await r.json();
    var ids=Object.keys(users||{});
    if(!ids.length){el.innerHTML='<div class="tk-chip-none">No dashboard users yet. Add one above — the owner has full access by default.</div>';return}
    el.innerHTML=ids.map(function(id){
      var u=users[id];
      var meta=[];
      if(u.addedBy)meta.push('by '+esc(u.addedBy));
      if(u.addedAt)meta.push(tkTimeAgo(u.addedAt));
      return '<div class="du-row"><span class="du-id">'+esc(id)+'</span><span class="du-meta">'+meta.join(' · ')+'</span>'+
        '<button class="btn btn-s" data-uid="'+esc(id)+'" data-fn="toggleUserScopes" data-args=\'['+fnData(esc(id))+']\' style="padding:4px 10px;font-size:10px;">Servers</button>'+
        '<button class="btn btn-s" data-uid="'+esc(id)+'" data-fn="removeDashUserUI" data-args=\'[\"@el\"]\' style="padding:4px 10px;font-size:10px;background:rgba(237,66,69,0.15);border-color:rgba(237,66,69,0.4);color:#ff7b81;">Remove</button></div>'+
        '<div id="scopes-'+esc(id)+'" style="display:none;"></div>';
    }).join('');
  }catch{el.innerHTML='<div class="empty"><p>Failed to load users.</p></div>'}
}
var scopesCache={};
export async function toggleUserScopes(userId){
  var box=document.getElementById('scopes-'+userId);
  if(!box)return;
  if(box.style.display!=='none'){box.style.display='none';return}
  if(!allServers.length){try{await loadServers()}catch{}}
  var granted=null,failed=false;
  try{granted=await(await fetch('/api/dash/users/guilds?userId='+encodeURIComponent(userId))).json();if(!Array.isArray(granted))failed=true}catch{failed=true}
  if(failed||granted===null){
    box.innerHTML='<div class="tk-prev-sim-hint" style="padding:8px 10px;margin:2px 0 8px;font-size:11px;color:#ff7b81;">Could not load current server access. Not saving anything — try again.</div>';
    box.style.display='';return;
  }
  scopesCache[userId]=granted;
  var grantedSet=new Set(granted);
  box.innerHTML='<div class="tk-prev-sim-hint" style="padding:8px 10px;margin:2px 0 8px;"><div style="font-size:11px;margin-bottom:6px;color:var(--text-dim);">Server access (unchecked = hidden from this user):</div><div style="display:flex;flex-wrap:wrap;gap:6px;">'+
    allServers.map(function(s){return '<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text);cursor:pointer;padding:3px 8px;background:rgba(255,255,255,0.03);border-radius:6px;"><input type="checkbox" data-gid="'+s.id+'"'+(grantedSet.has(s.id)?' checked':'')+'> '+esc(s.name)+'</label>'}).join('')+
    (allServers.length?'':'<span style="color:var(--text-muted);font-size:11px;">No servers available.</span>')+
    '</div><div style="display:flex;gap:6px;margin-top:8px;"><button class="btn btn-s" data-fn="saveUserScopes" data-args=\'['+fnData(esc(userId))+']\' style="padding:4px 12px;font-size:10px;">Save Access</button><span style="font-size:10px;color:var(--text-muted);align-self:center;">With no servers selected, this user sees nothing.</span></div></div>';
  box.style.display='';
}
export async function saveUserScopes(userId){
  var box=document.getElementById('scopes-'+userId);if(!box)return;
  var ids=[];box.querySelectorAll('input[type="checkbox"]:checked').forEach(function(cb){ids.push(cb.dataset.gid)});
  if(!ids.length&&!confirm('No servers selected — this user will see NOTHING on the dashboard. Save?'))return;
  if(ids.length&&allServers.length&&ids.length===allServers.length&&!confirm('Grant access to ALL servers for this user?'))return;
  try{
    var r=await fetch('/api/dash/users/guilds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,guildIds:ids})}),d=await r.json();
    if(d.success){scopesCache[userId]=ids;showToast('Server access updated')}
    else showToast(d.error||'Failed to save',true);
  }catch{showToast('Failed to save server access',true)}
}
export function addDashUserUI(){
  var inp=document.getElementById('dashUserIdInput');var id=(inp.value||'').trim();
  if(!id){showToast('Enter a Discord user ID',true);return}
  fetch('/api/dash/users/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:id})}).then(function(r){return r.json()}).then(function(d){
    if(d.accessToken){inp.value='';loadDashUsers();showAccessToken(id,d.accessToken)}
    else showToast(d.error||'Failed to add user',true);
  }).catch(function(){showToast('Failed to add user',true)});
}
export function removeDashUserUI(id){
  if(id&&id.nodeType)id=id.dataset.uid;
  if(!confirm('Revoke dashboard access for '+id+'?'))return;
  fetch('/api/dash/users/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:id})}).then(function(r){return r.json()}).then(function(d){
    if(d.success){showToast('Access revoked');loadDashUsers()}
    else showToast('Failed to remove',true);
  }).catch(function(){showToast('Failed to remove',true)});
}
function showAccessToken(userId,token){
  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;';
  overlay.onclick=function(e){if(e.target===overlay)document.body.removeChild(overlay)};
  overlay.innerHTML='<div class="tk-glass" style="max-width:440px;width:calc(100% - 40px);padding:20px;"><div class="tk-glass-h" style="margin:-20px -20px 14px;padding:14px 18px;">Access Token</div>'+
    '<p style="font-size:12px;color:var(--text-dim);margin:0 0 10px;">User <b style="color:var(--text);">'+esc(userId)+'</b> can now log in with their Discord ID and this token. <b style="color:var(--text);">Shown only once — copy it now.</b></p>'+
    '<code id="tkTokenSrc" style="display:block;padding:10px;font-size:11px;background:rgba(0,0,0,0.35);border:1px solid var(--border);border-radius:8px;color:#7ee7a8;word-break:break-all;">'+esc(token)+'</code>'+
    '<div style="display:flex;gap:8px;margin-top:14px;"><button class="btn" style="flex:1;padding:9px;font-size:12px;" data-fn="copyToken">Copy</button>'+
    '<button class="btn btn-s" style="flex:1;padding:9px;font-size:12px;" data-fn="tkCloseModal" data-args=\'[\"@el\"]\'>Done</button></div></div>';
  document.body.appendChild(overlay);
}

// ═══ SYSTEM ═══
export async function loadSys(){try{const r=await fetch('/api/system'),s=await r.json();document.getElementById('sysHost').innerHTML='<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;"><span style="color:var(--text-dim);">Platform</span><span>'+s.platform+'</span></div><div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;"><span style="color:var(--text-dim);">Node</span><span>'+s.nodeVersion+'</span></div><div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;"><span style="color:var(--text-dim);">CPU</span><span>'+s.cpuCores+' cores</span></div><div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;"><span style="color:var(--text-dim);">Uptime</span><span>'+s.uptime+'</span></div>';// Cap RAM display (containers report host memory, use process values)
let memLabel='System',memUsedDisplay=s.memoryUsed,memTotalDisplay=s.memoryTotal,memUsageDisplay=s.memoryUsage;
if(parseFloat(s.memoryTotal)>64){memLabel='Container (process)';memUsedDisplay=s.rss;memTotalDisplay='RSS';memUsageDisplay=Math.min(100,(parseFloat(s.heapUsed)/Math.max(1,parseFloat(s.heapTotal)))*100)}else{memLabel='System';memUsedDisplay=s.memoryUsed;memTotalDisplay=s.memoryTotal+' GB'}
document.getElementById('sysMem').innerHTML='<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;"><span style="color:var(--text-dim);">'+memLabel+'</span><span>'+memUsedDisplay+'/'+memTotalDisplay+(memTotalDisplay==='RSS'?' MB':' GB')+'</span></div><div class="prog"><div class="pf" style="width:'+memUsageDisplay+'%"></div></div></div>'+
      '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;"><span style="color:var(--text-dim);">RSS</span><span>'+s.rss+' MB</span></div><div class="prog"><div class="pf" style="width:'+Math.min(100,(s.rss/1024)*100)+'%;background:rgba(var(--accent-rgb),0.5);"></div></div></div><div><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;"><span style="color:var(--text-dim);">Heap</span><span>'+s.heapUsed+'/'+s.heapTotal+' MB</span></div><div class="prog"><div class="pf" style="width:'+Math.min(100,(parseFloat(s.heapUsed)/parseFloat(s.heapTotal))*100)+'%;background:rgba(59,165,92,0.5);"></div></div></div>'}catch{}}
// ═══ BOT CUSTOMIZATION ═══
export async function updateBotPresence(){const type=document.getElementById('botPresenceType').value,text=document.getElementById('botPresenceText').value;if(!text)return showToast('Enter a presence text',true);try{const r=await fetch('/api/bot/presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,text})}),d=await r.json();d.success?showToast('Presence updated!'):showToast(d.error||'Failed',true)}catch{showToast('Failed to update',true)}}
export async function updateBotName(){const name=document.getElementById('botNameInput').value;if(!name)return showToast('Enter a name',true);if(name.length>32)return showToast('Max 32 characters',true);try{const r=await fetch('/api/bot/name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})}),d=await r.json();if(d.success){showToast('Username changed!');document.getElementById('botNameInput').value=''}else showToast(d.error||'Failed',true)}catch{showToast('Failed to rename',true)}}
export async function updateBotAvatar(){const url=document.getElementById('botAvatarInput').value;if(!url)return showToast('Enter an image URL',true);try{const r=await fetch('/api/bot/avatar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})}),d=await r.json();if(d.success){showToast('Avatar changed!');document.getElementById('botAvatarInput').value=''}else showToast(d.error||'Failed',true)}catch{showToast('Failed to set avatar',true)}}

// ═══ BUGS BADGE THEME ═══
(function(){const b=document.getElementById('bugBadge');if(b){const o=new MutationObserver(()=>{b.style.color=document.body.classList.contains('light-mode')?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.06)'});o.observe(document.body,{attributes:true,attributeFilter:['class']})}})();

// ═══ BRANDING ═══
export async function loadBrand(){try{const r=await fetch('/api/status');if(r.ok){const d=await r.json();if(d.brandName)document.getElementById('brandFt').textContent='Powered by '+d.brandName}}catch{}}

// ═══ LOOK SWITCHER ═══
export function setLook(look){
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

// ═══ ERRORS ═══
var errTagFilter='';
export function tkTimeAgo(ts){
  if(!ts)return '';
  var t=new Date(ts).getTime();if(isNaN(t))return '';
  var s=Math.floor((Date.now()-t)/1000);
  if(s<45)return 'just now';
  if(s<3600)return Math.floor(s/60)+'m ago';
  if(s<86400)return Math.floor(s/3600)+'h ago';
  if(s<2592000)return Math.floor(s/86400)+'d ago';
  return new Date(ts).toLocaleDateString();
}
export async function loadErrors(){
  var el=document.getElementById('errFeed');if(!el)return;
  try{
    var qs=errTagFilter?'?tag='+encodeURIComponent(errTagFilter):'';
    var r=await fetch('/api/errors'+qs),d=await r.json();
    if(!d||!d.errors){el.innerHTML='<div class="empty"><p>Failed to load errors.</p></div>';return}
    var tags=d.tags||[];
    var allCount=tags.reduce(function(a,t){return a+t.count},0);
    var chips='<div class="err-chips">'+
      '<button class="err-chip'+(errTagFilter===''?' on':'')+'" data-tag="" data-fn="errSetFilter" data-args=\'[\"@el\"]\'>All <span class="err-chip-n">'+allCount+'</span></button>'+
      tags.map(function(t){return '<button class="err-chip'+(errTagFilter===t.tag?' on':'')+'" data-tag="'+esc(t.tag)+'" data-fn="errSetFilter" data-args=\'[\"@el\"]\'>'+esc(t.tag)+' <span class="err-chip-n">'+t.count+'</span></button>'}).join('')+
      '<button class="err-chip err-clear" data-fn="errClearLog" style="margin-left:auto;">\uD83D\uDDD1 Clear</button></div>';
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
          (e.stack?'<button class="err-toggle" data-fn="errToggleStack" data-args=\'[\"@el\"]\'>Show stack</button>':'')+
          '</div>'+metaHtml+stackHtml+'</div>';
       }).join('')+'</div>'+(errAll.length>errShown?'<button class="btn btn-s" data-fn="errLoadMore" style="margin:10px auto;display:block;padding:8px 20px;font-size:11px;">Load More ('+(errAll.length-errShown)+' remaining)</button>':'');
    }
    updateRefreshTimestamp('errors');
  }catch{
    el.innerHTML='<div class="empty"><p>Couldn\'t load errors.</p><p class="empty-act">The bot may be reconnecting.</p></div>';
  }
}
var errAll=[],errShown=0;
export function errLoadMore(){errShown+=50;loadErrors()}
export function errSetFilter(tag){errTagFilter=(tag&&tag.nodeType)?tag.dataset.tag:(tag||'');errShown=25;loadErrors()}
export function errToggleStack(btn){
  var item=(btn&&btn.nodeType)?btn.closest('.err-item'):document.querySelector('.err-item');
  if(!item)return;
  var p=item.querySelector('.err-stack');
  if(!p)return;
  var show=p.style.display!=='block';
  p.style.display=show?'block':'none';
  btn.textContent=show?'Hide stack':'Show stack';
}
export function errClearLog(){
  if(!confirm('Clear all logged errors?'))return;
  fetch('/api/errors',{method:'DELETE'}).then(function(r){return r.json()}).then(function(d2){
    if(d2.success){errTagFilter='';loadErrors();showToast('Error log cleared')}
    else showToast('Failed to clear',true);
  }).catch(function(){showToast('Failed to clear',true)});
}

export function stRf(){if(rTimer)clearInterval(rTimer);rTimer=setInterval(()=>{if(document.hidden)return;loadOv();loadAn();loadRm();loadCmdUsage();var se=document.getElementById('sec-errors');if(se&&se.classList.contains('active'))loadErrors()},rInt*1000)}
window.addEventListener('resize',()=>{rsBg();startBg(bgStyle)});
// Pause dashboard polling while the tab is hidden — saves CPU + API load
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!rTimer)stRf()});

// ──── Dispatcher helpers (replaced inline event handlers) ────
// Copy the one-time dashboard access token from the token modal.
export function copyToken() {
  var src=document.getElementById('tkTokenSrc');
  var text=src?src.textContent:'';
  if(!text){return}
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){showToast('Token copied')}).catch(function(){showToast('Copy failed — select the text manually',true)});
  }else{
    showToast('Copy unavailable in this browser',true);
  }
}
// Collapse/expand toggle used by command-category cards.
export function toggleCollapsed(el){el.classList.toggle('collapsed')}
// ──── Formerly-inline handlers moved out for CSP compliance ────
// Uncheck the 'use bot default' checkbox when a custom embed color is picked.
export function srvEmbedSync(el){
  var c=document.getElementById('srvEmbedClear');
  if(c)c.checked=false;
  void el;
}
// Open the hidden .txt file picker used by the automod upload button.
export function amTxtUploadClick(){
  var inp=document.getElementById('amTxtUpload');
  if(inp)inp.click();
}