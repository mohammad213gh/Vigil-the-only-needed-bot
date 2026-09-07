// Login page script — extracted from an inline <script> block so the CSP can
// forbid 'unsafe-inline' in script-src. Served as a module from /static.
// Theme toggle
let loginDark = true;
function applyLoginTheme(isDark) { document.body.classList.toggle('light-mode', !isDark); loginDark = isDark; const ti = document.getElementById('loginThemeIcon'), btn = document.getElementById('loginThemeBtn'); if (ti) ti.innerHTML = isDark ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>' : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'; if (btn) { btn.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'; btn.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'; btn.style.color = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' } }
function toggleTheme() { applyLoginTheme(!loginDark); localStorage.setItem('loginTheme', loginDark ? 'dark' : 'light') }
const savedTheme = localStorage.getItem('loginTheme'); if (savedTheme === 'light') applyLoginTheme(false);
document.getElementById('loginThemeBtn').addEventListener('click', toggleTheme);
// Readonly until focus: defeats password managers pre-filling a shared kiosk.
document.getElementById('password').addEventListener('focus', function () { this.removeAttribute('readonly') });

// Show brand name if set
const brandEl = document.createElement('div'); brandEl.style.cssText = 'position:fixed;bottom:16px;left:0;right:0;text-align:center;z-index:1;font-size:10px;color:' + (document.body.classList.contains('light-mode') ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)') + ';letter-spacing:0.3px;pointer-events:none;font-family:Inter,sans-serif'; brandEl.textContent = ''; (async () => { try { const r = await fetch('/api/status'); if (r.ok) { const d = await r.json(); if (d.brandName) { brandEl.textContent = 'Powered by ' + d.brandName; document.getElementById('loginBrand').style.display = 'none' } } } catch { } })(); document.body.appendChild(brandEl); document.getElementById('loginThemeBtn').addEventListener('mouseenter', () => { const btn = document.getElementById('loginThemeBtn'); btn.style.borderColor = loginDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }); document.getElementById('loginThemeBtn').addEventListener('mouseleave', () => { const btn = document.getElementById('loginThemeBtn'); btn.style.borderColor = loginDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' });

// Floating particles
const fc = document.getElementById('floatContainer');
for (let i = 0; i < 40; i++) { const p = document.createElement('div'); p.className = 'float-el'; p.style.left = Math.random() * 100 + '%'; p.style.width = p.style.height = (2 + Math.random() * 5) + 'px'; p.style.animationDuration = (10 + Math.random() * 20) + 's'; p.style.animationDelay = (Math.random() * 20) + 's'; fc.appendChild(p) }

// Background canvas animation
const c = document.getElementById('bgCanvas'), ctx = c.getContext('2d');
let w, h, dots = [];
function resize() { w = window.innerWidth; h = window.innerHeight; c.width = w * (devicePixelRatio || 1); c.height = h * (devicePixelRatio || 1); c.style.width = w + 'px'; c.style.height = h + 'px'; ctx.setTransform(devicePixelRatio || 1, 0, 0, devicePixelRatio || 1, 0, 1); buildDots() }
function buildDots() { dots = []; for (let y = 0; y < h; y += 32)for (let x = 0; x < w; x += 32)dots.push({ x, y, ox: x, oy: y }) }
let mx = -9999, my = -9999;
document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY });
document.addEventListener('mouseleave', () => { mx = -9999; my = -9999 });
function anim() { ctx.clearRect(0, 0, w, h); for (const d of dots) { const dx = mx - d.ox, dy = my - d.oy, di = Math.sqrt(dx * dx + dy * dy); let ox = 0, oy = 0; if (di < 100) { const f = (1 - di / 100) * 12, ang = Math.atan2(dy, dx); ox = -Math.cos(ang) * f; oy = -Math.sin(ang) * f } d.x += (d.ox + ox - d.x) * 0.08; d.y += (d.oy + oy - d.y) * 0.08; ctx.beginPath(); ctx.arc(d.x, d.y, 0.6, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${0.06 + 0.12 * (1 - Math.min(di / 200, 1))})`; ctx.fill() } requestAnimationFrame(anim) }
resize(); window.addEventListener('resize', resize); anim();

// Login logic
let loginMode = 'password';
function switchMode(m) { loginMode = m; document.querySelectorAll('.tab-btn').forEach(t => t.classList.toggle('active', t.dataset.mode === m)); document.getElementById('passwordFields').style.display = m === 'password' ? '' : 'none'; document.getElementById('discordFields').style.display = m === 'discord' ? '' : 'none'; document.getElementById('modeHint').textContent = m === 'password' ? 'Enter your password to sign in.' : 'Enter your Discord user ID. Only granted users can use this.'; (m === 'password' ? document.getElementById('password') : document.getElementById('discordId')).focus() }
document.getElementById('loginTabs').addEventListener('click', e => { const b = e.target.closest('.tab-btn'); if (b) switchMode(b.dataset.mode) });
document.getElementById('loginForm').addEventListener('submit', async e => { e.preventDefault(); const btn = document.getElementById('loginBtn'), err = document.getElementById('errorMsg'); btn.classList.add('loading'); err.classList.remove('show'); try {      const body = loginMode === 'password' ? { password: document.getElementById('password').value } : { discordId: document.getElementById('discordId').value, accessToken: document.getElementById('accessToken').value }; const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const d = await r.json(); if (d.success) { window.location.href = '/' } else {              err.textContent = 'Invalid ' + (loginMode === 'password' ? 'password' : 'credentials') + '.'; err.classList.add('show') } } catch { err.textContent = 'Connection error.'; err.classList.add('show') }
    btn.classList.remove('loading') });

// ═══ Clear form on load (security: prevent password persistence) ═══
window.addEventListener('pageshow', e => {
    if (e.persisted) {
        document.getElementById('password').value = '';
        document.getElementById('discordId').value = '';
    }
});
document.getElementById('password').value = '';
document.getElementById('discordId').value = '';

// ═══ Branding (accent, title, logo, favicon) ═══
(async () => { try { const r = await fetch('/api/branding'); if (!r.ok) return; const b = await r.json();
const safe = u => typeof u === 'string' && (/^https:\/\//.test(u) || /^\/uploads\//.test(u));
if (b.accentColor && /^#[0-9a-fA-F]{6}$/.test(b.accentColor)) { const hx = b.accentColor, r = parseInt(hx.slice(1, 3), 16), g = parseInt(hx.slice(3, 5), 16), bl = parseInt(hx.slice(5, 7), 16); const st = document.createElement('style'); st.textContent = '.bg-mesh{background:radial-gradient(ellipse 80% 60% at 0% 20%,rgba(' + r + ',' + g + ',' + bl + ',0.15) 0%,transparent 50%),radial-gradient(ellipse 60% 50% at 100% 80%,rgba(' + r + ',' + g + ',' + bl + ',0.12) 0%,transparent 50%)} .float-el{background:rgba(' + r + ',' + g + ',' + bl + ',0.08)} .icon-wrap{background:linear-gradient(135deg,' + hx + ',#7850c8)} .tab-btn.active{background:rgba(' + r + ',' + g + ',' + bl + ',0.15)} .inp-grp input:focus{border-color:' + hx + ';background:rgba(' + r + ',' + g + ',' + bl + ',0.05);box-shadow:0 0 16px rgba(' + r + ',' + g + ',' + bl + ',0.06)} .btn{background:linear-gradient(135deg,' + hx + ',#7850c8)} .btn:hover{box-shadow:0 6px 24px rgba(' + r + ',' + g + ',' + bl + ',0.25)} .login-card{box-shadow:0 0 80px rgba(' + r + ',' + g + ',' + bl + ',0.06)} body.light-mode .inp-grp input:focus{border-color:' + hx + '}'; document.head.appendChild(st) }
if (b.title) { document.querySelector('h1').textContent = b.title; document.title = b.title }
if (safe(b.faviconUrl)) { const l = document.createElement('link'); l.rel = 'icon'; l.href = b.faviconUrl; document.head.appendChild(l) }
if (safe(b.logoUrl)) { document.querySelector('.icon-wrap').innerHTML = '<img src="' + b.logoUrl.replace(/"/g, '&quot;') + '" style="width:32px;height:32px;border-radius:8px;object-fit:cover;" alt="">' }
} catch { } })();

// ═══ Bugs badge ═══
const bugEl = document.createElement('div'); bugEl.style.cssText = 'position:fixed;bottom:12px;right:14px;z-index:10;font-size:9px;color:rgba(255,255,255,0.06);font-family:Inter,sans-serif;letter-spacing:0.2px;pointer-events:none;transition:color 0.3s'; bugEl.textContent = 'Bugs? DM .nlux.'; (function () { const o = new MutationObserver(() => { bugEl.style.color = document.body.classList.contains('light-mode') ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }); o.observe(document.body, { attributes: true, attributeFilter: ['class'] }) })(); document.body.appendChild(bugEl);
