/*
Interactive active background:
- Canvas particle system with subtle connecting lines, parallax, and pointer influence.
- Mobile and desktop friendly. Starts immediately.
*/
/* Default to a native dark theme on load */
(function initTheme(){
  try {
    // persist a native 'dark' theme as the default experience
    if(!localStorage.getItem('theme')) localStorage.setItem('theme','dark');
    const theme = localStorage.getItem('theme') || 'dark';
    if(theme === 'dark') document.documentElement.setAttribute('data-theme','dark');

    // ensure the default search provider is Bing unless the user has explicitly chosen otherwise
    if(!localStorage.getItem('defaultSearchProvider')) localStorage.setItem('defaultSearchProvider','bing');
  } catch(e){}
})();

// Ensure the background canvas exists before accessing it to avoid runtime errors
let canvas = document.getElementById('bg');
if (!canvas) {
  canvas = document.createElement('canvas');
  canvas.id = 'bg';
  // insert as first child so it sits behind other content
  if (document.body.firstChild) document.body.insertBefore(canvas, document.body.firstChild);
  else document.body.appendChild(canvas);
}
const ctx = canvas.getContext('2d', { alpha: false }) || (function(){ 
  // create a fake 2d context fallback to avoid crashes if getContext fails
  return { fillRect: ()=>{}, createRadialGradient: ()=>({ addColorStop: ()=>{} }), beginPath:()=>{}, arc:()=>{}, fill:()=>{}, stroke:()=>{}, moveTo:()=>{}, quadraticCurveTo:()=>{}, setTransform:()=>{}, clearRect:()=>{} };
})();

let DPR = Math.max(1, window.devicePixelRatio || 1);

function resize() {
  DPR = Math.max(1, window.devicePixelRatio || 1);
  const w = Math.max(320, innerWidth);
  const h = Math.max(320, innerHeight);
  canvas.width = Math.floor(w * DPR);
  canvas.height = Math.floor(h * DPR);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
addEventListener('resize', resize, { passive: true });
resize();

/* Config */
const cfg = {
  particleCountBase: 40,      // base count scaled by area
  speed: 0.25,
  maxRadius: 2.5,
  connectDist: 140,
  color: { r: 0, g: 224, b: 198 },
  backgroundFade: 0.07
};

/* particles */
let particles = [];
function buildParticles() {
  particles = [];
  const area = (canvas.width / DPR) * (canvas.height / DPR);
  const scale = area / (1366 * 768);
  const count = Math.round(cfg.particleCountBase * Math.max(0.7, scale));
  for (let i=0;i<count;i++){
    particles.push(new Particle());
  }
}
class Particle{
  constructor(){
    this.reset(true);
  }
  reset(init=false){
    const W = canvas.width/DPR, H = canvas.height/DPR;
    this.x = Math.random() * W;
    this.y = Math.random() * H;
    const s = (Math.random() * 0.9 + 0.1) * cfg.maxRadius;
    this.r = s;
    const angle = Math.random() * Math.PI * 2;
    const speedFactor = cfg.speed * (0.5 + Math.random());
    this.vx = Math.cos(angle) * speedFactor;
    this.vy = Math.sin(angle) * speedFactor;
    this.phase = Math.random() * Math.PI * 2;
    this.life = init ? 1 + Math.random()*4 : 0; // for gentle fade-in
  }
  update(dt){
    const W = canvas.width/DPR, H = canvas.height/DPR;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.phase += 0.01 * dt;
    // wrap with gentle respawn
    if(this.x < -20) this.x = W + 10;
    if(this.x > W + 20) this.x = -10;
    if(this.y < -20) this.y = H + 10;
    if(this.y > H + 20) this.y = -10;
    // life for fade-in/out
    this.life = Math.min(1, this.life + 0.002 * dt);
  }
  draw(ctx, alphaScale=1){
    const a = 0.6 * this.life * alphaScale;
    const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 5);
    const c = cfg.color;
    grd.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${a})`);
    grd.addColorStop(0.4, `rgba(${c.r},${c.g},${c.b},${a*0.35})`);
    grd.addColorStop(1, `rgba(10,12,14,0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r*3, 0, Math.PI*2);
    ctx.fill();

    // small core
    ctx.fillStyle = `rgba(255,255,255,${0.05 * this.life * alphaScale})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0.5,this.r*0.6), 0, Math.PI*2);
    ctx.fill();
  }
}

/* pointer influence */
const pointer = { x: null, y: null, vx:0, vy:0, active:false, lastX:0, lastY:0, lastT:0 };
function onPointerMove(x,y,t){
  if(pointer.lastT){
    const dt = Math.max(1, t - pointer.lastT);
    pointer.vx = (x - pointer.lastX)/dt;
    pointer.vy = (y - pointer.lastY)/dt;
  }
  pointer.lastX = x; pointer.lastY = y; pointer.lastT = t;
  pointer.x = x; pointer.y = y; pointer.active = true;
}
function clearPointer(){ pointer.x = null; pointer.y = null; pointer.active = false; pointer.vx = pointer.vy = 0; }

/* Input handlers */
canvas.addEventListener('pointermove', (e)=> { onPointerMove(e.clientX, e.clientY, performance.now()); }, {passive:true});
canvas.addEventListener('pointerdown', (e)=> { onPointerMove(e.clientX, e.clientY, performance.now()); }, {passive:true});
window.addEventListener('pointerup', ()=> clearPointer(), {passive:true});
canvas.addEventListener('touchstart', (e)=>{ const t=e.touches[0]; if(t) onPointerMove(t.clientX, t.clientY, performance.now()); }, {passive:true});
canvas.addEventListener('touchmove', (e)=>{ const t=e.touches[0]; if(t) onPointerMove(t.clientX, t.clientY, performance.now()); }, {passive:true});
canvas.addEventListener('touchend', ()=> clearPointer(), {passive:true});

/* animation */
let lastTime = performance.now();
let frame = 0;
function step(now){
  const dtMs = Math.min(40, now - lastTime);
  lastTime = now;
  update(dtMs);
  draw();
  frame++;
  requestAnimationFrame(step);
}
function update(dt){
  // lazy rebuild on size changes
  if(!particles.length) buildParticles();
  // pointer attract/repel influence
  const influenceRadius = Math.max(80, Math.min(canvas.width/DPR, canvas.height/DPR) * 0.18);
  for (let p of particles){
    // subtle noise-driven drift
    const nx = Math.sin((p.x + frame*0.1) * 0.002 + p.phase) * 0.02;
    const ny = Math.cos((p.y + frame*0.1) * 0.002 + p.phase) * 0.02;
    p.vx += nx * 0.2;
    p.vy += ny * 0.2;
    // pointer effect
    if(pointer.active && pointer.x != null){
      const dx = p.x - pointer.x;
      const dy = p.y - pointer.y;
      const d2 = dx*dx + dy*dy;
      const r = influenceRadius;
      if(d2 < r*r){
        const d = Math.sqrt(d2) || 0.0001;
        // attract/repel based on pointer speed (fast => repel)
        const speed = Math.hypot(pointer.vx, pointer.vy);
        const repel = Math.min(1, speed * 60);
        const force = (1 - (d/r)) * (repel*1.5 + 0.4);
        const nx2 = dx / d;
        const ny2 = dy / d;
        // if user is stationary, gentle attraction; if moving fast, repel
        p.vx += (nx2 * force) * (repel ? 1 : -0.3);
        p.vy += (ny2 * force) * (repel ? 1 : -0.3);
      }
    }
    // dampen velocities slightly
    p.vx *= 0.995;
    p.vy *= 0.995;
    p.update(dt);
  }
}

/* Rendering */
function draw(){
  // fade background slightly for trailing effect
  ctx.fillStyle = `rgba(6,9,12,${cfg.backgroundFade})`;
  ctx.fillRect(0,0,canvas.width/DPR,canvas.height/DPR);

  // connect close particles
  const c = cfg.color;
  const W = canvas.width/DPR, H = canvas.height/DPR;
  for (let i=0;i<particles.length;i++){
    const a = particles[i];
    a.draw(ctx, 1);
    for (let j=i+1;j<particles.length;j++){
      const b = particles[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d2 = dx*dx + dy*dy;
      const maxD = cfg.connectDist;
      if(d2 < maxD*maxD){
        const t = 1 - (Math.sqrt(d2)/maxD);
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${(0.08 + 0.18*t)*a.life*b.life})`;
        ctx.lineWidth = 1 * (0.5 + 0.5 * t);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        // subtle curve toward midpoint to create flow
        const mx = (a.x + b.x)/2 + Math.sin((a.x - b.x) * 0.01 + frame * 0.01) * 6;
        const my = (a.y + b.y)/2 + Math.cos((a.y - b.y) * 0.01 + frame * 0.01) * 6;
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.stroke();
      }
    }
  }

  // parallax glow that follows pointer for added depth
  if(pointer.active && pointer.x != null){
    const grd = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, Math.max(80, canvas.width/DPR*0.15));
    grd.addColorStop(0, `rgba(0,220,198,0.06)`);
    grd.addColorStop(1, `rgba(0,0,0,0)`);
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,W,H);
  }
}

/* rebuild when DPR/size changes */
let lastW = canvas.width, lastH = canvas.height;
function checkResizeLoop(){
  if(canvas.width !== lastW || canvas.height !== lastH){
    lastW = canvas.width; lastH = canvas.height;
    buildParticles();
  }
  requestAnimationFrame(checkResizeLoop);
}

/* init */
buildParticles();
requestAnimationFrame(step);
requestAnimationFrame(checkResizeLoop);

/* EXTRACTION image interactions: click/tap to wipe up and reveal panel */
const img = document.getElementById('extraction');
const panel = document.getElementById('panel');

if (img) {
  // support click and touchend -> use pointerup on img for reliability
  img.addEventListener('pointerup', (e) => {
    // ignore if already wiped
    if (img.classList.contains('wipe')) return;
    img.classList.add('wipe');
    // clear any pointer influence so particles don't chase the tap
    clearPointer();
  }, {passive: true});

  // when the wipe transition finishes, show the panel
  img.addEventListener('transitionend', (ev) => {
    // wait for transform/opacity transition to complete
    if (!img.classList.contains('wipe')) return;
    if (ev.propertyName && !/transform|opacity/.test(ev.propertyName)) return;
    // reveal panel
    if (panel) {
      panel.classList.add('visible');
      panel.setAttribute('aria-hidden', 'false');
    }
    // hide the image visually once the animation is done to avoid it blocking the panel
    img.style.display = 'none';
  });

  // --- New: RAF-driven violent jitter constrained to a small step grid (instant teleport jumps) ---
  // Rapid, instantaneous jumps but limited to a few small "steps" away from center (keeps violence while reducing travel).
  (function(){
    let rafId = null;
    let running = false;

    // step-grid configuration: allow up to ~6 steps (keeps jumps within ~5-7 steps from origin)
    const MAX_STEPS = 6;      // maximum number of small steps from origin (±MAX_STEPS)
    const STEP_X = 3;         // pixels per horizontal step
    const STEP_Y = 3;         // pixels per vertical step

    // interval between teleport jumps
    const SNAP_MS = 80; // slightly slower interval for fewer jumps per second

    // current offsets applied
    let ox = 0, oy = 0;
    let lastJump = 0;

    function now(){ return performance.now(); }

    function jumpToRandomTarget() {
      // choose a step count between -MAX_STEPS and +MAX_STEPS and convert to pixel offset
      const sx = Math.floor(Math.random() * (MAX_STEPS * 2 + 1)) - MAX_STEPS;
      const sy = Math.floor(Math.random() * (MAX_STEPS * 2 + 1)) - MAX_STEPS;
      // ensure at least some movement (avoid always choosing 0,0)
      const tx = (sx === 0 && Math.random() < 0.35) ? (Math.random() < 0.5 ? STEP_X : -STEP_X) : sx * STEP_X;
      const ty = (sy === 0 && Math.random() < 0.35) ? (Math.random() < 0.5 ? STEP_Y : -STEP_Y) : sy * STEP_Y;

      ox = Number.isFinite(tx) ? tx : 0;
      oy = Number.isFinite(ty) ? ty : 0;

      // apply instantly with no rotation and a slight scale increase for intensity
      img.style.transition = 'transform 0ms linear, opacity 100ms linear';
      img.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px)) scale(1.06)`;
      lastJump = now();
    }

    function step() {
      if(!running) return;
      const elapsed = now() - lastJump;
      // perform immediate teleport if interval elapsed
      if (elapsed >= SNAP_MS) {
        jumpToRandomTarget();
      } else {
        // keep the current instantaneous transform (no interpolation)
        img.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px)) scale(1.06)`;
      }

      // occasional micro-noise to keep motion erratic but small
      if (Math.random() < 0.12) {
        ox += (Math.random() - 0.5) * 2;
        oy += (Math.random() - 0.5) * 2;
        img.style.transform = `translate(calc(-50% + ${Math.round(ox)}px), calc(-50% + ${Math.round(oy)}px)) scale(1.06)`;
      }

      rafId = requestAnimationFrame(step);
    }

    function startJitter(){
      if (running) return;
      if (img.classList.contains('wipe')) return;
      running = true;
      lastJump = 0;
      jumpToRandomTarget();
      rafId = requestAnimationFrame(step);
    }

    function stopJitter(){
      if (!running) return;
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      // keep position but apply a short cooldown (no forced snap-back)
      try {
        img.style.transition = 'transform 120ms linear, opacity 120ms linear';
        img.style.transform = `translate(calc(-50% + ${Math.round(ox)}px), calc(-50% + ${Math.round(oy)}px)) scale(1.02)`;
        setTimeout(()=> {
          try { if (!img.classList.contains('wipe')) img.style.transition = ''; } catch(e){}
        }, 140);
      } catch(e){}
    }

    img.addEventListener('pointerenter', startJitter, { passive: true });
    img.addEventListener('pointerleave', stopJitter, { passive: true });
    img.addEventListener('touchstart', startJitter, { passive: true });
    window.addEventListener('touchend', stopJitter, { passive: true });

    const observer = new MutationObserver(() => {
      if (img.classList.contains('wipe')) stopJitter();
    });
    observer.observe(img, { attributes: true, attributeFilter: ['class'] });
  })();
}

/* panel buttons: open actions; Search opens the stylized iframe preview */
document.querySelectorAll('.panel-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const action = btn.dataset.action;
    // lightweight animation feedback
    btn.animate([{ transform: 'translateY(-3px) scale(1.02)' }, { transform: 'translateY(0) scale(1)' }], { duration: 180 });

    if (action === 'games') {
      // Load the local games listing into the in-page fullscreen iframe so navigation works when embedded.
      const targetUrl = 'newExtr/github-fork-files/game.html';

      // Hide panel and splash visual to keep UI clean
      if (panel) {
        panel.classList.remove('visible');
        panel.setAttribute('aria-hidden', 'true');
      }
      if (img && !img.classList.contains('wipe')) {
        img.classList.add('wipe');
        img.style.display = 'none';
      }

      // Use the fullscreen iframe helper to load the games page inside this document.
      // This avoids cross-frame navigation issues and keeps the back button on top.
      try {
        createFullscreenIframe(targetUrl);
      } catch (e) {
        // Fallback: attempt same-window navigation only if iframe creation fails
        try { window.location.href = targetUrl; } catch (err) { console.warn('Unable to open games page', err); }
      }
      return;
    }

    if (action === 'apps') {
      // Load the local apps listing into the in-page fullscreen iframe so navigation works when embedded.
      const targetUrl = 'newExtr/github-fork-files/apps.html';

      // Hide panel and splash visual to keep UI clean
      if (panel) {
        panel.classList.remove('visible');
        panel.setAttribute('aria-hidden', 'true');
      }
      if (img && !img.classList.contains('wipe')) {
        img.classList.add('wipe');
        img.style.display = 'none';
      }

      // Use the fullscreen iframe helper to load the apps page inside this document.
      try {
        createFullscreenIframe(targetUrl);
      } catch (e) {
        // Fallback: attempt same-window navigation only if iframe creation fails
        try { window.location.href = targetUrl; } catch (err) { console.warn('Unable to open apps page', err); }
      }
      return;
    }

    if (action === 'search') {
      // Hide splash visual and panel, then create a fullscreen chained iframe that loads the minimal search.
      if (panel) {
        panel.classList.remove('visible');
        panel.setAttribute('aria-hidden', 'true');
      }
      if (img && !img.classList.contains('wipe')) {
        img.classList.add('wipe');
        img.style.display = 'none';
      }

      // Create the fullscreen wrapped iframe chain and reveal the global back button.
      const targetUrl = 'newExtr/github-fork-files/index.html';
      try {
        createFullscreenIframe(targetUrl);
      } catch (e) {
        // fallback: attempt a same-window navigation; if that fails, open in-page iframe
        try { window.location.href = targetUrl; } catch (err) { try { createFullscreenIframe(targetUrl); } catch (ee) {} }
      }
      return;
    }

    console.log('panel action:', action);
  }, { passive: true });
});

/* Status strip: live time and battery updates (12-hour clock; revealed after splash wipe; SVG battery icon) */
(function(){
  const timeEl = document.getElementById('status-time');
  const battEl = document.getElementById('status-battery');
  const statusStrip = document.getElementById('status-strip');
  const splashImg = document.getElementById('extraction');

  // hide status strip until the splash has been wiped/entered
  try {
    if (statusStrip) statusStrip.style.display = 'none';
  } catch (e){}

  // format a 12-hour time with AM/PM
  function format12Hour(d){
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2,'0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  }

  function showStatusStripIfEntered(){
    try {
      // consider the site "entered" if the splash image has the 'wipe' class or panel is visible
      const entered = (splashImg && splashImg.classList && splashImg.classList.contains('wipe')) ||
                      (document.getElementById('panel') && document.getElementById('panel').classList.contains('visible'));
      if (entered && statusStrip) statusStrip.style.display = '';
    } catch (e){}
  }
  // expose helper so other parts of the app can re-evaluate status-strip visibility
  try { window.showStatusStripIfEntered = showStatusStripIfEntered; } catch (e){}

  function updateTime(){
    try {
      if(!timeEl) return;
      // only reveal and update time after the splash is wiped/entered
      showStatusStripIfEntered();
      // if still not entered, don't update visible time
      const entered = (splashImg && splashImg.classList && splashImg.classList.contains('wipe')) ||
                      (document.getElementById('panel') && document.getElementById('panel').classList.contains('visible'));
      if(!entered) return;
      const now = new Date();
      timeEl.textContent = format12Hour(now);
    } catch(e){}
  }

  // initial time update + interval
  updateTime();
  setInterval(updateTime, 1000 * 30); // update every 30s

  // Small inline SVG battery icon generator (simple outline with fill reflecting percentage)
  function batterySvg(pct, charging){
    // clamp
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    const fillWidth = Math.max(2, Math.round((pct / 100) * 18)); // inner fill up to 18px
    // choose color: green above 50, yellow above 20, red otherwise
    const color = charging ? '#9feee0' : (pct > 50 ? '#00e0c6' : (pct > 20 ? '#ffd54f' : '#ff6b6b'));
    const chargingMark = charging ? `<polyline points="9,4 7,10 11,10 9,16" fill="${color}" opacity="0.9"/>` : '';
    return `
      <svg width="28" height="16" viewBox="0 0 28 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <rect x="1" y="2" width="22" height="12" rx="2" ry="2" fill="none" stroke="#9fbfb6" stroke-width="1.5" />
        <rect x="23.5" y="5" width="2.5" height="6" rx="0.8" ry="0.8" fill="#9fbfb6" />
        <rect x="${4}" y="4" width="${fillWidth}" height="8" rx="1" ry="1" fill="${color}" />
        ${chargingMark}
      </svg>
    `;
  }

  // Battery API (if available) — plug into the updateTime visibility flow
  function updateBatteryInfo(batt){
    try {
      if(!batt || !battEl) return;
      const pct = Math.round(batt.level * 100);
      const charging = !!batt.charging;
      // set innerHTML to icon + percentage text (keeps compact)
      battEl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px;">' +
        batterySvg(pct, charging) +
        `<span style="font-weight:700;color:var(--accent);min-width:44px;text-align:center;">${pct}%</span>` +
        '</span>';
      // ensure strip is revealed if user has entered
      showStatusStripIfEntered();
    } catch(e){}
  }

  if (navigator.getBattery && typeof navigator.getBattery === 'function') {
    navigator.getBattery().then(batt => {
      updateBatteryInfo(batt);
      // listen for changes
      batt.addEventListener('levelchange', () => updateBatteryInfo(batt));
      batt.addEventListener('chargingchange', () => updateBatteryInfo(batt));
    }).catch(()=> {
      if (battEl) battEl.textContent = 'Battery: n/a';
    });
  } else {
    // fallback: mark unknown
    try { battEl.textContent = 'Battery: n/a'; } catch(e){}
  }

  // Also reveal the status strip as soon as the splash completes its wipe (transitionend handler)
  try {
    if (splashImg) {
      splashImg.addEventListener('transitionend', (ev) => {
        if (!splashImg.classList.contains('wipe')) return;
        // show the strip on wipe completion
        try { if (statusStrip) statusStrip.style.display = ''; } catch (e){}
        // do an immediate time update so users see the time right away
        updateTime();
      }, { passive: true });
    }
  } catch (e){}

})();

/* Small helper: reveal the site logo with a blip+glitch 2s after the user clicks the logo.
   This replaces the previous auto-reveal on load so the reveal only happens after an explicit click. */
(function(){
  try {
    const revealDelayMs = 2000;
    const logoWrap = document.getElementById('site-logo-wrap');
    const logo = document.getElementById('site-logo');
    if (!logoWrap || !logo) return;

    // Ensure it's initially hidden (defensive)
    logoWrap.setAttribute('aria-hidden','true');
    logoWrap.style.opacity = '0';

    // Handler that schedules the delayed reveal; idempotent (only schedules once)
    let scheduled = false;
    function scheduleReveal() {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        try {
          logoWrap.setAttribute('aria-hidden','false');
          logoWrap.classList.add('visible');
          // apply glitch class to the image to run blip+glitch animations
          logo.classList.add('glitch');
          // remove the transient 'glitch' class after the animations complete
          setTimeout(() => {
            try { logo.classList.remove('glitch'); } catch(e){}
          }, 900);
        } catch (e) {}
      }, revealDelayMs);
    }

    // Wait for a click (or pointerup) on the logo to start the delayed reveal.
    // Use pointerup for broader device compatibility; also accept keyboard Enter/Space via click.
    logo.addEventListener('pointerup', scheduleReveal, { passive: true });
    // fallback: also listen for click just in case
    logo.addEventListener('click', scheduleReveal, { passive: true });
  } catch (e){}
})();

/* Search modal close interactions */
const searchModal = document.getElementById('search-modal');
if (searchModal) {
  function closeSearchFull() {
    // clear injected proxy content
    const frame = document.getElementById('search-frame');
    if (frame) frame.innerHTML = '';
    // fully hide modal (both ARIA and actual layout/display) so the page returns to the original view
    searchModal.setAttribute('aria-hidden', 'true');
    try { searchModal.style.display = 'none'; } catch (e) {}
    // hide the global top-left back button
    const globalBack = document.getElementById('global-back');
    if (globalBack) globalBack.hidden = true;
  }

  // original close behavior (attempt to close window / fallback to about:blank)
  function closeSearch() {
    closeSearchFull();

    try {
      window.close();
      setTimeout(() => {
        try {
          if (!window.closed) {
            window.location.replace('about:blank');
          }
        } catch (e) {}
      }, 250);
    } catch (e) {
      try { window.location.replace('about:blank'); } catch (err) {}
    }
  }

  // scrim close (should behave like full hide)
  searchModal.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', closeSearchFull, { passive: true });
  });

  // global back button (top-left X): close the preview and clear injected iframe
  const globalBack = document.getElementById('global-back');
  if (globalBack) {
    globalBack.addEventListener('click', (e) => {
      e.preventDefault();
      closeSearchFull();
    }, { passive: true });
  }

  // allow Escape to close (full close behavior)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && searchModal.getAttribute('aria-hidden') === 'false') closeSearchFull();
  }, { passive: true });

  // ensure the global back is hidden on initial load and wire it to close any fullscreen iframe we created
  (function(){
    const gb = document.getElementById('global-back');
    if(gb) {
      gb.hidden = true;
      gb.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          // remove the fullscreen outer iframe if present
          const outer = document.getElementById('__search_full_iframe');
          if (outer && outer.parentNode) {
            outer.parentNode.removeChild(outer);
          }
        } catch (err) {}
        try { document.body.classList.remove('search-beam'); } catch(e) {}
        // also hide the button after attempting removal
        try { gb.hidden = true; } catch (e) {}
      }, { passive: true });
    }
  })();
}

/* SETTINGS: gear toggle, persistence for default provider */
const settingsGear = document.getElementById('settings-gear');
const settingsModal = document.getElementById('settings-modal');

function getDefaultProvider(){ return localStorage.getItem('defaultSearchProvider') || 'bing'; }
function setDefaultProvider(p){ localStorage.setItem('defaultSearchProvider', p); }

/* wire gear open/close */
if (settingsGear && settingsModal) {
  settingsGear.addEventListener('click', ()=> {
    settingsModal.setAttribute('aria-hidden', 'false');
  }, { passive: true });

  settingsModal.querySelectorAll('.settings-close').forEach(btn => {
    btn.addEventListener('click', ()=> settingsModal.setAttribute('aria-hidden', 'true'), { passive: true });
  });

  // option buttons
  settingsModal.querySelectorAll('.settings-option').forEach(btn => {
    const prov = btn.dataset.provider;
    if (getDefaultProvider() === prov) btn.classList.add('active');
    btn.addEventListener('click', (e) => {
      settingsModal.querySelectorAll('.settings-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setDefaultProvider(prov);
      // close after select
      settingsModal.setAttribute('aria-hidden', 'true');
    }, { passive: true });
  });
}

/* If an iframe loads to about:blank even though we set a real src, it's likely
   being refused by X-Frame-Options / CSP. Show the chooser so the user can pick
   an alternate handling instead of silently failing. */
function checkIframeRefused(iframe, requestedUrl, revealChooser=true){
  // slight delay to allow browser to finish navigation/blanking
  setTimeout(()=>{
    try{
      const href = iframe && iframe.contentWindow && iframe.contentWindow.location && iframe.contentWindow.location.href;
      if(href === 'about:blank' && requestedUrl && !requestedUrl.startsWith('about:')){
        const chooser = document.getElementById('search-chooser');
        if(revealChooser && chooser) chooser.setAttribute('aria-hidden','false');
        return true;
      }
    }catch(e){
      // cross-origin access denied likely means iframe loaded successfully in-frame
    }
    return false;
  }, 300);
}

/* Create a simple fullscreen iframe that fills the viewport and is easy to update.
   Reuses id '__search_full_iframe' so other handlers can find/remove it.
   Ensures the global back button is revealed and layered above the iframe (so it remains clickable for Bing/results). */
/* Helper to remove the fullscreen iframe and clean up "search-beam" / "games-view" state */
function removeFullscreenIframe() {
  try {
    const outer = document.getElementById('__search_full_iframe');
    if (outer && outer.parentNode) {
      outer.parentNode.removeChild(outer);
    }
  } catch (err) {}
  try {
    // remove any beam state (search preview) and also clear games-view marking
    document.body.classList.remove('search-beam');
    document.body.classList.remove('games-view');
  } catch (e) {}
  try {
    const gb = document.getElementById('global-back');
    if (gb) gb.hidden = true;
  } catch (e){}

  // after removing fullscreen content, re-evaluate status-strip visibility (will only show on main)
  try {
    if (typeof window.showStatusStripIfEntered === 'function') {
      window.showStatusStripIfEntered();
    } else {
      const statusStrip = document.getElementById('status-strip');
      if (statusStrip) statusStrip.style.display = '';
    }
  } catch (e) {}
}

/* Create a simple fullscreen iframe that fills the viewport and is easy to update.
   Reuses id '__search_full_iframe' so other handlers can find/remove it.
   Ensures the global back button is revealed and layered above the iframe (so it remains clickable for Bing/results). */
function createFullscreenIframe(url){
  // If an iframe already exists, just update its src and return it.
  let existing = document.getElementById('__search_full_iframe');
  if (existing) {
    try { existing.src = url; } catch (e) { /* ignore */ }
    try {
      // when updating an existing iframe, set search-beam on; clear games-view unless this is the games URL
      document.body.classList.add('search-beam');
      if (typeof url === 'string' && url.indexOf('/github-fork-files/game.html') !== -1) {
        document.body.classList.add('games-view');
      } else {
        document.body.classList.remove('games-view');
      }
    } catch (e) {}
    // ensure the global back button is visible when replacing an existing iframe
    try {
      const gb = document.getElementById('global-back');
      if (gb) {
        gb.hidden = false;
        gb.style.zIndex = '9999'; // very high to guarantee it sits above cross-origin iframes (visual stacking)
        // ensure pointer events are enabled so it receives clicks above the iframe
        gb.style.pointerEvents = 'auto';
      }
    } catch (e) {}
    return existing;
  }

  const iframe = document.createElement('iframe');
  iframe.id = '__search_full_iframe';
  iframe.className = 'full-search-iframe';
  iframe.title = 'Search results';
  // sandbox kept reasonably permissive while still preventing top-level navigation
  iframe.setAttribute('sandbox','allow-scripts allow-forms allow-same-origin');
  iframe.src = url;

  // style so it covers the viewport but stays beneath the global back button
  iframe.style.position = 'fixed';
  iframe.style.inset = '0';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = '0';
  // keep iframe low but don't assume it will block the back button; we force the button above later
  iframe.style.zIndex = '1';
  iframe.style.background = 'transparent';

  document.body.appendChild(iframe);

  // mark the document as in "search-beam" mode so site chrome can reveal the topbar,
  // and mark "games-view" when loading the games page so the top-slide topbar stays hidden.
  try {
    document.body.classList.add('search-beam');
    if (typeof url === 'string' && url.indexOf('/github-fork-files/game.html') !== -1) {
      document.body.classList.add('games-view');
    } else {
      document.body.classList.remove('games-view');
    }
  } catch (e) {}

  // hide the status strip (time & battery) whenever a non-main fullscreen iframe is shown
  try {
    const statusStrip = document.getElementById('status-strip');
    if (statusStrip) statusStrip.style.display = 'none';
  } catch (e) {}

  // Ensure the global top-left back button is shown and usable to close the fullscreen iframe
  try {
    const gb = document.getElementById('global-back');
    if (gb) {
      gb.hidden = false;
      // place the button on a very high stacking layer to ensure it visually overlays cross-origin content
      gb.style.zIndex = '9999';
      // ensure it receives pointer events even when covering the iframe
      gb.style.pointerEvents = 'auto';
      // ensure it is positioned above other chrome
      gb.style.position = gb.style.position || 'absolute';
      // ensure it closes the iframe if clicked (idempotent handler)
      if (!gb._boundClose) {
        gb.addEventListener('click', (e) => {
          e.preventDefault();
          removeFullscreenIframe();
        }, { passive: true });
        gb._boundClose = true;
      }
    }
  } catch (e) {}

  return iframe;
}

/* --- Top slide button: reveal when pointer is dragged/moved to the top; click returns to homepage ---
     Only reveal when the default search provider is Bing. */
(function(){
  const btn = document.getElementById('top-slide-btn');
  if(!btn) return;

  // Only allow showing if default provider is bing
  function canShow() {
    try {
      return (typeof getDefaultProvider === 'function' ? getDefaultProvider() : (localStorage.getItem('defaultSearchProvider') || 'bing')) === 'bing';
    } catch (e) {
      return false;
    }
  }

  // show/hide helpers (enforce canShow)
  function showTopBtn(){ if(!canShow()) return; btn.hidden = false; btn.classList.add('visible'); }
  function hideTopBtn(){ btn.classList.remove('visible'); setTimeout(()=>{ try{ if(!btn.classList.contains('visible')) btn.hidden = true; }catch(e){} }, 300); }

  // pointer tracking: detect a quick upward drag into the top area, or any pointerenter near top.
  let tracking = { active: false, startY: null, lastY: null, moved: false, startT: 0 };
  window.addEventListener('pointerdown', (e)=>{
    tracking.active = true;
    tracking.startY = e.clientY;
    tracking.lastY = e.clientY;
    tracking.moved = false;
    tracking.startT = performance.now();
  }, { passive: true });

  window.addEventListener('pointermove', (e)=>{
    const y = e.clientY;
    if(tracking.active){
      tracking.moved = true;
      tracking.lastY = y;
      const upwardDistance = (tracking.startY != null) ? (tracking.startY - y) : 0;
      // if user dragged upward from lower area into the top threshold quickly, show (only if bing)
      if(upwardDistance > 80 && y < 48){
        showTopBtn();
      }
    } else {
      // if not dragging, simple hover/peek to top shows the button (only if bing)
      if(y < 36 && canShow()) showTopBtn();
      else {
        // if pointer leaves the top, hide after short delay unless sticky
        if(!btn.matches(':hover')) hideTopBtn();
      }
    }
  }, { passive: true });

  window.addEventListener('pointerup', (e)=>{
    // if pointer released near top and not previously shown, show briefly (only if bing)
    if(e.clientY < 36 && canShow()) showTopBtn();
    // finish tracking
    tracking.active = false;
    tracking.startY = tracking.lastY = null;
    tracking.moved = false;
  }, { passive: true });

  // hide when clicking elsewhere (but keep if mouse over button)
  window.addEventListener('click', (e)=>{
    if(!btn.contains(e.target) && e.clientY > 64){
      hideTopBtn();
    }
  }, { passive: true });

  // ensure button closes fullscreen iframe and navigates same-tab to homepage when clicked
  btn.addEventListener('click', (e) => {
    // defensive, ensure any unexpected errors are caught so clicking won't crash the page
    try {
      e.preventDefault && e.preventDefault();

      // remove any fullscreen iframe only if it exists in this document
      const outer = document.getElementById('__search_full_iframe');
      if (outer && outer.parentNode) {
        try {
          outer.parentNode.removeChild(outer);
        } catch (remErr) {
          // ignore removal errors (e.g. concurrent DOM changes)
        }
      }
      try { document.body.classList.remove('search-beam'); } catch(e) {}

      try { btn.hidden = true; } catch (hideErr) {}

      // Prefer replace to avoid creating an extra history entry; fallback to href/back if needed
      try {
        if (typeof window.location.replace === 'function') {
          window.location.replace('/index.html');
        } else {
          window.location.href = '/index.html';
        }
      } catch (navErr) {
        try {
          if (window.history && window.history.length > 1) window.history.back();
        } catch (hbErr) {}
      }
    } catch (err) {
      // final safety net: log and avoid throwing
      try { console.warn('top-slide-btn click handler error', err); } catch (e) {}
    }
  }, { passive: true });

  // keyboard accessibility: allow pressing Escape to hide and 'b' to show (optional quick keys)
  window.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape') hideTopBtn();
    if((e.key === 'b' || e.key === 'B') && canShow()) showTopBtn();
  }, { passive: true });

  // ensure the button is hidden initially
  hideTopBtn();
})();

/* Handle incoming search messages from the embedded minimal search preview.
   Shows a chooser allowing the user to pick Bing/Google/DuckDuckGo or open in a new tab.
   When chosen, the preview iframe src is updated to the selected provider URL. */
window.addEventListener('message', (ev) => {
  try {
    const msg = ev.data;

    // allow child frames to request closing the fullscreen search iframe
    if (msg && msg.type === 'close-preview') {
      try {
        const outer = document.getElementById('__search_full_iframe');
        if (outer && outer.parentNode) outer.parentNode.removeChild(outer);
      } catch (err) {}
      // also hide chooser if visible
      try { const chooser = document.getElementById('search-chooser'); if (chooser) chooser.setAttribute('aria-hidden','true'); } catch (e) {}
      // navigate the parent page back to the homepage so the visible "Back" in embedded pages results in returning to /
      try { window.location.href = '/index.html'; } catch (e) {}
      return;
    }

    if (!msg || msg.type !== 'search' || !msg.providers) return;
    const modal = document.getElementById('search-modal');
    const chooser = document.getElementById('search-chooser');
    const frameContainer = document.getElementById('search-frame');
    if (!modal || !chooser || !frameContainer) return;

    // if a default provider is set, auto-load it into the preview iframe (Bing default)
    const defaultProv = getDefaultProvider() || 'bing';
    const providers = msg.providers || {};
    const iframe = frameContainer.querySelector('iframe.full-preview');

    // If the search sender requested to force Bing (e.g. Enter pressed / Search clicked),
    // create a cloaked fullscreen proxy that immediately redirects inside the iframe to the provider.
    if (msg.forceBing && providers.bing) {
      try {
        // create a small HTML proxy blob that redirects to the real provider (cloaks the direct link)
        const target = providers.bing;
        const proxyHtml = '<!doctype html><html><head><meta charset="utf-8">' +
          '<meta http-equiv="refresh" content="0;url=' + target.replace(/"/g,'&quot;') + '">' +
          '<script>try{location.replace(' + JSON.stringify(target) + ');}catch(e){}</' + 'script>' +
          '</head><body></body></html>';
        const proxyBlob = new Blob([proxyHtml], { type: 'text/html' });
        const proxyUrl = URL.createObjectURL(proxyBlob);

        // load the proxy into a fullscreen iframe so the result appears fullscreen
        createFullscreenIframe(proxyUrl);

        // ensure chooser hidden and make the global back X visible and layered above the fullscreen iframe
        chooser.setAttribute('aria-hidden', 'true');
        const gb = document.getElementById('global-back');
        if (gb) {
          gb.hidden = false;
          try { gb.style.zIndex = 70; } catch (e) {}
        }
      } catch (e) {
        // graceful fallback: open inside the page using the fullscreen iframe
        try { createFullscreenIframe(providers.bing); } catch (err) {}
      }
      return;
    }

    if (providers[defaultProv] && iframe) {
      iframe.src = providers[defaultProv];
      // ensure chooser hidden since we auto-open the default
      chooser.setAttribute('aria-hidden', 'true');
      return;
    }

    // populate internal chooser handlers
    chooser.setAttribute('aria-hidden', 'false');

    function hideChooser() {
      chooser.setAttribute('aria-hidden', 'true');
    }

    // attach click handlers once (idempotent)
    if (!chooser._bound) {
      chooser.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const prov = btn.dataset.provider;
        const action = btn.dataset.action;
        // get the currently prepared provider URLs from the message (ev might be different on click; capture them)
        const providers = msg.providers || {};
        if (action === 'cancel') {
          hideChooser();
          return;
        }
        if (prov === 'newtab') {
          // Instead of opening a new top-level tab, load the URL into the sandboxed preview iframe to keep navigation contained.
          const url = providers.bing || providers.google || providers.ddg;
          const iframe = frameContainer.querySelector('iframe.full-preview');
          if (iframe) {
            try {
              // If iframe is same-origin and sandbox permits, load; otherwise set src directly (sandbox prevents top-level navigation)
              iframe.src = url;
            } catch (e) {
              iframe.src = url;
            }
          } else if (url) {
            // as a last resort, open in a new tab (user action required browser will decide)
            window.open(url, '_blank', 'noopener');
          }
          hideChooser();
          return;
        }
        if (prov && providers[prov]) {
          // find the iframe inside frameContainer (we inserted the live preview iframe earlier)
          const iframe = frameContainer.querySelector('iframe.full-preview');
          if (iframe) {
            // load selected provider into the preview iframe (kept sandboxed to prevent top navigation)
            iframe.src = providers[prov];
          } else {
            // fallback: open new tab
            window.open(providers[prov], '_blank', 'noopener');
          }
          hideChooser();
        }
      }, { passive: true });
      chooser._bound = true;
    }

    // ensure chooser is visible for this search message
    chooser.setAttribute('aria-hidden', 'false');
  } catch (e) {
    // ignore bad messages
    console.warn('search message handling error', e);
  }
}, { passive: true });
