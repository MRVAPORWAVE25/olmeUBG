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
  } catch(e){}
})();

const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d', { alpha: false });

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
}

/* panel buttons: open actions; Search opens the stylized iframe preview */
document.querySelectorAll('.panel-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const action = btn.dataset.action;
    // lightweight animation feedback
    btn.animate([{ transform: 'translateY(-3px) scale(1.02)' }, { transform: 'translateY(0) scale(1)' }], { duration: 180 });

    if (action === 'search') {
      // open modal and attach a sandboxed live iframe pointing to the local proxy site folder
      // The iframe is sandboxed to keep navigation contained (no top-level navigation).
      const modal = document.getElementById('search-modal');
      const frame = document.getElementById('search-frame');
      if (modal) {
        modal.setAttribute('aria-hidden', 'false');
        modal.style.display = 'flex';
      }

      if (frame) {
        // clear any previous children
        frame.innerHTML = '';

        // primary sandboxed iframe: runs the proxy preview but cannot navigate top-level
        const iframe = document.createElement('iframe');
        iframe.src = '/github-fork-files/index.html';
        iframe.className = 'full-preview';
        // sandbox attribute intentionally omits allow-top-navigation to keep links contained
        // allow-same-origin is only set for local preview behavior; do NOT include allow-top-navigation
        iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin');
        iframe.allow = 'fullscreen';
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('title', 'Sandboxed proxy preview');

        // add a couple of inert decorative iframes behind the main one (visual complexity only)
        for (let i = 0; i < 2; i++) {
          const deco = document.createElement('iframe');
          deco.src = 'about:blank';
          deco.setAttribute('aria-hidden', 'true');
          // fully inert sandbox
          deco.setAttribute('sandbox', '');
          deco.style.position = 'absolute';
          deco.style.inset = '0';
          deco.style.opacity = (i === 0 ? '0.02' : '0.01');
          deco.style.pointerEvents = 'none';
          frame.appendChild(deco);
        }

        // append the primary iframe last so it sits above decorative iframes
        frame.appendChild(iframe);

        // add an event listener to catch attempts by the iframe content to navigate top and keep them contained
        iframe.addEventListener('load', () => {
          try {
            // try to neutralize target="_top" links by rewriting anchors when same-origin allows
            const win = iframe.contentWindow;
            const doc = iframe.contentDocument;
            if (doc && doc.querySelectorAll) {
              doc.querySelectorAll('a[target]').forEach(a => {
                // remove targets so the link stays in the iframe
                a.removeAttribute('target');
              });
            }
          } catch (e) {
            // cross-origin or other access errors are ignored; sandbox still prevents top navigation
          }

          // detect common "refuse to be iframed" behavior: browser loads about:blank inside iframe
          // even though we set a remote src (often due to X-Frame-Options or CSP). Reveal chooser so
          // the user can pick an alternate handling instead of silently failing.
          try {
            const requestedUrl = iframe.getAttribute('data-requested-src') || iframe.src || '';
            setTimeout(() => {
              try {
                const href = iframe && iframe.contentWindow && iframe.contentWindow.location && iframe.contentWindow.location.href;
                if (href === 'about:blank' && requestedUrl && !requestedUrl.startsWith('about:')) {
                  const chooser = document.getElementById('search-chooser');
                  if (chooser) chooser.setAttribute('aria-hidden', 'false');
                }
              } catch (err) {
                // cross-origin access denied likely means iframe loaded content successfully
              }
            }, 250);
          } catch (err) {}
        });
      }

      // focus the single top-left close button for keyboard users
      const globalBack = document.getElementById('global-back');
      if (globalBack) {
        globalBack.hidden = false;
        globalBack.focus();
      }

      console.log('panel action: search (sandboxed iframe preview opened)');
      return;
    }

    console.log('panel action:', action);
  }, { passive: true });
});

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

  // ensure the global back is hidden on initial load
  (function(){ const gb = document.getElementById('global-back'); if(gb) gb.hidden = true; })();
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

/* Handle incoming search messages from the embedded minimal search preview.
   Shows a chooser allowing the user to pick Bing/Google/DuckDuckGo or open in a new tab.
   When chosen, the preview iframe src is updated to the selected provider URL. */
window.addEventListener('message', (ev) => {
  try {
    const msg = ev.data;
    if (!msg || msg.type !== 'search' || !msg.providers) return;
    const modal = document.getElementById('search-modal');
    const chooser = document.getElementById('search-chooser');
    const frameContainer = document.getElementById('search-frame');
    if (!modal || !chooser || !frameContainer) return;

    // if a default provider is set, auto-load it into the preview iframe (Bing default)
    const defaultProv = getDefaultProvider() || 'bing';
    const providers = msg.providers || {};
    const iframe = frameContainer.querySelector('iframe.full-preview');
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
