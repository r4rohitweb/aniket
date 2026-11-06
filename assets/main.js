
const $ = (s, r = document) => r.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
const root = document.documentElement;

/* ---------- adaptive grid scale-up above 1920px ---------- */
function applyAdaptiveGrid(){
  const FONT_BASE = 16, baseWidth = 1920, coef = 0.6666;
  const w = window.innerWidth;
  const widthReduction = ((baseWidth - w) / baseWidth) * 100;
  const size = FONT_BASE - (FONT_BASE * (widthReduction * coef)) / 100;
  if (size > FONT_BASE) root.style.fontSize = size + 'px';
  else root.style.removeProperty('font-size');
}
applyAdaptiveGrid(); addEventListener('resize', applyAdaptiveGrid);

/* ---------- scroll lock (Lenis attached once loaded) ---------- */
let lenis = null, scrollEnabled = true, locks = 0;
// touch state shared by the pinned sections: never snap while a finger is down or a flick is still coasting
window.__touching = false;
addEventListener('touchstart', () => { window.__touching = true; }, { passive: true, capture: true });
addEventListener('touchend', () => { window.__touching = false; }, { passive: true, capture: true });
addEventListener('touchcancel', () => { window.__touching = false; }, { passive: true, capture: true });
const COARSE = matchMedia('(pointer: coarse)').matches;
window.__snapTo = top => { if (!COARSE && window.__lenis) window.__lenis.scrollTo(top, { duration: .6, easing: x => 1 - Math.pow(1 - x, 3) }); else scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); };
function stopScroll(){ locks++; scrollEnabled = false; lenis?.stop(); Object.assign(root.style, { position:'relative', overflow:'hidden', height:'100%' }); }
function startScroll(){ locks = Math.max(0, locks - 1); if (locks) return; scrollEnabled = true; lenis?.start(); root.style.removeProperty('position'); root.style.removeProperty('overflow'); root.style.removeProperty('height'); }
function scrollToId(id){
  const el = document.getElementById(id); if (!el) return;
  scrollEnabled = false;
  setTimeout(() => {
    const top = el.getBoundingClientRect().top + window.pageYOffset;
    if (lenis) lenis.scrollTo(top); else window.scrollTo({ top, behavior:'smooth' });
    setTimeout(() => { scrollEnabled = true; }, 100);
  }, 50);
}
window.scrollTo(0, 0);

/* ---------- spring helper (mass 1, semi-implicit Euler) ---------- */
function spring({ tension, friction }, render){
  let x = 0, v = 0, target = 0, raf = 0;
  const step = () => {
    const dt = 1 / 60, a = tension * (target - x) - friction * v;
    v += a * dt; x += v * dt; render(x);
    if (Math.abs(target - x) < 0.001 && Math.abs(v) < 0.001){ x = target; v = 0; render(x); raf = 0; return; }
    raf = requestAnimationFrame(step);
  };
  render(0);
  return { set(t){ target = t; if (!raf) raf = requestAnimationFrame(step); } };
}
// declarative hovers: data-h="s 1 1.04|y 0 -2|o .8 1"  data-hs="tension friction"  data-ht="closest trigger"
function bindHovers(scope = document){
  scope.querySelectorAll('[data-h]').forEach(el => {
    if (el._h) return; el._h = 1;
    const props = el.dataset.h.split('|').map(p => { const [k, a, b] = p.trim().split(/\s+/); return { k, a:+a, b:+b }; });
    const [tension, friction] = (el.dataset.hs || '320 18').split(/\s+/).map(Number);
    const trig = el.dataset.ht ? el.closest(el.dataset.ht) || el : el;
    const render = p => {
      const v = { s:1, x:0, y:0, r:0 };
      let o = null;
      props.forEach(({ k, a, b }) => { const val = a + (b - a) * p; if (k === 'o') o = val; else v[k] = val; });
      el.style.transform = `translate(${v.x}px,${v.y}px) rotate(${v.r}deg) scale(${v.s})`;
      if (o !== null) el.style.opacity = o;
    };
    const s = spring({ tension, friction }, render);
    if (!canHover) return;
    trig.addEventListener('mouseenter', () => s.set(1));
    trig.addEventListener('mouseleave', () => s.set(0));
    trig.addEventListener('focusin', () => s.set(1));
    trig.addEventListener('focusout', () => s.set(0));
  });
}



/* ---------- sticky header: gets a soft backing once the page scrolls ---------- */
{ const hdr = $('.hdr'); const upd = () => hdr.classList.toggle('stuck', scrollY > 24); addEventListener('scroll', upd, { passive: true }); upd(); }
/* ---------- live clock ---------- */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function tickClock(){
  const d = new Date(), h = d.getHours();
  const time = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2,'0')}${h < 12 ? 'am' : 'pm'}`;
  const date = `${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
  document.querySelectorAll('[data-time]').forEach(e => e.textContent = time);
  document.querySelectorAll('[data-date]').forEach(e => e.textContent = date);
  document.querySelectorAll('[data-dshort]').forEach(e => e.textContent = `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`);
  document.querySelectorAll('[data-navtime]').forEach(e => e.textContent = ' — ' + time);
}
tickClock(); setInterval(tickClock, 1000);

/* ---------- overlays ---------- */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
function openLayer(el, onKey){
  el.hidden = false; stopScroll();
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('open')));
  el._key = e => {
    if (e.key === 'Escape'){ onKey(); return; }
    // keep Tab inside the open layer: without this the keyboard walks onto the page behind it
    if (e.key !== 'Tab') return;
    const f = [...el.querySelectorAll(FOCUSABLE)].filter(n => n.offsetWidth || n.offsetHeight || n.getClientRects().length);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!el.contains(document.activeElement)){ e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  };
  addEventListener('keydown', el._key);
}
function closeLayer(el, after){
  if (el.hidden) return;
  el.classList.remove('open'); el.classList.add('closing');
  removeEventListener('keydown', el._key);
  setTimeout(() => { el.hidden = true; el.classList.remove('closing'); startScroll(); after?.(); }, 460);
}
// nav menu
const NAV = [['Home','home'],['SEO Content',0],['Website Copy',1],['Social & Ad Copy',2],['Email & Scripts',3],['My story','about'],['Novel','novel'],['Tools','tools'],['Certificates','certificates'],['Contact',null]];
const navm = $('#navm');
$('#navList').innerHTML = NAV.map(([l, id], i) =>
  `<li><button class="navm__item" style="--d:${i * 45 + 80}ms" data-i="${i}"><small>0${i + 1}</small><span>${l}</span></button></li>`).join('');
const openNav = () => { openLayer(navm, closeNav); setTimeout(() => $('#navClose').focus(), 60); };
const closeNav = (after) => closeLayer(navm, typeof after === 'function' ? after : () => $('#menuBtn').focus());
$('#menuBtn').addEventListener('click', openNav);
$('#navClose').addEventListener('click', closeNav);
$('#navList').addEventListener('click', e => {
  const b = e.target.closest('.navm__item'); if (!b) return;
  const id = NAV[+b.dataset.i][1];
  closeNav(() => typeof id === 'number' ? window.openDoor?.(id) : id ? scrollToId(id) : openModal());
});
$('#navStart').addEventListener('click', () => closeNav(() => openModal()));
// request modal
const CONTACT_EMAIL = ['ch.aniket12', 'gmail.com'].join('@');   // where project requests go (assembled here so address-harvesting bots don't find it in the page)
document.querySelectorAll('[data-mail]').forEach(a => { a.href = 'mailto:' + CONTACT_EMAIL; a.textContent = CONTACT_EMAIL; });
const modal = $('#modal'), form = $('#reqForm');
let lastFocus = null;
function openModal(){ lastFocus = document.activeElement; openLayer(modal, closeModal); setTimeout(() => $('#f-name')?.focus({ preventScroll:true }), 120); }
let lastInput = 'mouse';
addEventListener('pointerdown', () => { lastInput = 'mouse'; }, true);
addEventListener('keydown', e => { if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') lastInput = 'key'; }, true);
function closeModal(){
  closeLayer(modal, () => {
    // give focus back only to keyboard users, so a mouse click doesn't leave the nav item looking hovered
    if (lastInput === 'key') lastFocus?.focus?.({ preventScroll:true }); else document.activeElement?.blur?.();
    setTimeout(() => { form.reset(); $('#mForm').hidden = false; $('#mSuccess').hidden = true; $('#mSendLbl').textContent = SEND_LABEL; }, 300);
  });
}
modal.addEventListener('click', closeModal);
$('#mPanel').addEventListener('click', e => e.stopPropagation());
$('#mClose').addEventListener('click', closeModal);
$('#mDone').addEventListener('click', closeModal);
// Prepare the visitor's message in their email app.
const SEND_LABEL = 'Write the email';
$('#mSendLbl').textContent = SEND_LABEL;
form.addEventListener('submit', e => {
  e.preventDefault();
  const d = new FormData(form), name = (d.get('name') || '').trim(), mail = (d.get('email') || '').trim(), proj = (d.get('project') || '').trim();
  const subject = `New project enquiry from ${name}`;
  const body = `Hi Aniket,\n\n${proj}\n\n— ${name}\n${mail}`;
  const viaMail = () => {
    location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    $('#mOkT').textContent = 'Almost there';
    $('#mOkP').textContent = "Your email app has opened with your message ready to go. Press send there to get in touch.";
    $('.msuccess__alt').hidden = false;
    $('#mForm').hidden = true; $('#mSuccess').hidden = false; $('#mDone').focus();
  };
  viaMail();
});
// routing for in-page buttons
document.addEventListener('click', e => {
  const ln = e.target.closest('a[data-door],a[data-go]');
  if (ln){ if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return; e.preventDefault(); }   // a real link for crawlers and new tabs; a plain click stays in the page
  const c = e.target.closest('[data-contact]'); if (c){ openModal(); return; }
  const dr = e.target.closest('[data-door]'); if (dr){ window.openDoor?.(+dr.dataset.door); return; }
  const g = e.target.closest('[data-go]'); if (g) scrollToId(g.dataset.go);
});

bindHovers();

/* ---------- Flip calendar: skills on an endless desk-calendar flip ---------- */
(function flipCalendar(){
  const SKILLS = ['Content Writer', 'Copywriter', 'SEO Strategist', 'Content Marketer', 'Storyteller'];
  const HOLD = 1700, FLIP = 1250;
  const cal = $('#cal'); if (!cal) return;
  const body = $('.cal__body', cal), leaf = $('.cal__leaf', cal);
  const under = $('[data-under]', cal), face = $('.cal__face', cal);
  const measure = $('.cal__measure', cal), rings = $('.cal__rings', cal);
  const n = SKILLS.length;
  let i = 0, timer = 0, flipping = false, started = false;

  const paint = (page, k) => {
    $('.cal__word', page).textContent = SKILLS[k];
    $('.cal__no', page).textContent = `${String(k + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
  };
  paint(face, 0); paint(under, 1);

  // size the page to the longest skill, shrink the whole calendar if the column is too narrow
  function fit(){
    cal.style.fontSize = '';
    const fs = parseFloat(getComputedStyle(cal).fontSize);
    let max = 0;
    for (const w of SKILLS){ measure.textContent = w; max = Math.max(max, measure.getBoundingClientRect().width); }
    const wEm = max / fs + 0.8 + 0.06;               // word + side padding
    body.style.setProperty('--cal-w', wEm.toFixed(3) + 'em');
    cal.style.setProperty('--cal-w', wEm.toFixed(3) + 'em');
    const avail = cal.closest('.h1').getBoundingClientRect().width - fs * 0.25;
    const need = wEm * fs;
    if (need > avail) cal.style.fontSize = (fs * avail / need).toFixed(2) + 'px';
    // spiral rings + punched holes, spaced roughly every 0.62em
    const count = Math.max(5, Math.round((wEm - 0.64) / 0.7) + 1);
    rings.innerHTML = '<i></i>'.repeat(count);
    cal.querySelectorAll('.cal__holes').forEach(h => h.innerHTML = '<i></i>'.repeat(count));
  }
  fit();
  document.fonts?.ready.then(fit);
  addEventListener('resize', () => { clearTimeout(fit._t); fit._t = setTimeout(fit, 120); });

  function flip(){
    if (document.hidden){ timer = setTimeout(flip, 600); return; }
    flipping = true;
    const next = (i + 1) % n;
    if (reduced){
      i = next; paint(face, i); paint(under, (i + 1) % n);
      flipping = false; timer = setTimeout(flip, HOLD + 700); return;
    }
    const timing = { duration: FLIP, easing: 'cubic-bezier(.5,.05,.2,1)', fill: 'forwards' };
    face.animate([{ opacity: 1 }, { opacity: 1, offset: .285 }, { opacity: 0, offset: .295 }, { opacity: 0 }], { duration: FLIP, easing: 'linear', fill: 'forwards' });
    // once the page is over the top it slips away behind the calendar instead of hanging over the text
    // the back of the page catches the light as it comes over the top, then falls into shadow as it drops behind the stack
    $('.cal__rear', leaf).animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.02)', offset: .29 }, { filter: 'brightness(.96)', offset: .45 }, { filter: 'brightness(.9)' }], { duration: FLIP, easing: 'linear', fill: 'forwards' });
    const a = leaf.animate([
      { transform: 'translateZ(.004em) rotateX(0deg)' },
      { transform: 'translateZ(.004em) rotateX(352deg)' }
    ], timing);
    $('.cal__shade', face).animate([{ opacity: 0 }, { opacity: .45, offset: .2 }, { opacity: 0, offset: .275 }, { opacity: 0 }], { duration: FLIP, easing: 'linear', fill: 'forwards' });
    $('.cal__shade', under).animate([{ opacity: .7 }, { opacity: 0 }], { duration: FLIP * .9, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' });
    a.onfinish = () => {
      i = next;
      paint(face, i);                       // the leaf now shows what was underneath…
      leaf.getAnimations({ subtree: true }).forEach(x => x.cancel());
      cal.querySelectorAll('.cal__shade').forEach(sh => sh.getAnimations().forEach(x => x.cancel()));
      paint(under, (i + 1) % n);            // …and the next skill waits below
      flipping = false;
      timer = setTimeout(flip, HOLD);
    };
  }
  const start = () => { if (started) return; started = true; timer = setTimeout(flip, 1300); };
  if (document.body.classList.contains('ready')) start(); else addEventListener('intro:ready', start, { once: true });
})();


/* ---------- LiquidReveal: paint the colour cut-out along the cursor trail ----------
   The trail is kept as a soft mask; each frame the canvas shows  bw·(1−mask) + colour·mask
   (added with 'lighter'), so semi-transparent hair edges keep exactly the same opacity
   instead of doubling up where the colour layer sits on the B&W one. */
function liquidReveal(stage, canvas, afterSrc, { brushRadius = 143, decay = 0.016 } = {}){
  if (!stage || !canvas) return;
  if (reduced || !canHover) { canvas.remove(); return; }
  const base = stage.querySelector('img');
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const mk = () => { const c = document.createElement('canvas'); return [c, c.getContext('2d')]; };
  const [bwC, bwX] = mk(), [colC, colX] = mk(), [mask, mX] = mk(), [tmp, tX] = mk();
  const bwImg = new Image(), colImg = new Image();
  bwImg.src = base.currentSrc || base.src; colImg.src = afterSrc;
  let W = 1, H = 1, radius = brushRadius * dpr;
  const points = []; let last = null, idle = 999, running = false, showing = false;

  function fitDraw(x, img){
    x.clearRect(0, 0, W, H);
    if (!img.naturalWidth) return;
    // Match the portrait: object-fit cover, centered horizontally and aligned to the top.
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    x.filter = x === bwX ? 'grayscale(1)' : 'none';
    x.drawImage(img, (W - dw) / 2, 0, dw, dh);
    x.filter = 'none';
  }
  function measure(){
    const r = stage.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    for (const c of [canvas, bwC, colC, mask, tmp]){ c.width = W; c.height = H; }
    radius = brushRadius * dpr;
    fitDraw(bwX, bwImg); fitDraw(colX, colImg);
    hide();
  }
  bwImg.onload = () => fitDraw(bwX, bwImg);
  colImg.onload = () => fitDraw(colX, colImg);

  function stamp(x, y){
    const g = mX.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,.82)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    mX.globalCompositeOperation = 'source-over';
    mX.fillStyle = g; mX.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  function render(){
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bwC, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(mask, 0, 0);                       // bw · (1 − mask)
    tX.globalCompositeOperation = 'source-over';
    tX.clearRect(0, 0, W, H);
    tX.drawImage(colC, 0, 0);
    tX.globalCompositeOperation = 'destination-in';
    tX.drawImage(mask, 0, 0);                        // colour · mask
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(tmp, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }
  function show(){ if (!showing){ showing = true; render(); base.style.visibility = 'hidden'; } }
  function hide(){
    showing = false; base.style.visibility = '';
    ctx.clearRect(0, 0, W, H); mX.clearRect(0, 0, W, H);
  }
  function frame(){
    const drawing = points.length > 0;
    if (drawing) idle = 0; else idle++;
    if (idle >= 120){ hide(); running = false; return; }
    const fade = drawing ? decay : Math.min(decay + idle * 0.004, 0.5);
    mX.globalCompositeOperation = 'destination-out';
    mX.fillStyle = `rgba(0,0,0,${fade})`;
    mX.fillRect(0, 0, W, H);
    if (drawing){ for (const p of points) stamp(p.x, p.y); points.length = 0; }
    render(); show();
    requestAnimationFrame(frame);
  }
  addEventListener('pointermove', e => {
    if (!colImg.naturalWidth || !bwImg.naturalWidth) return;
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr;
    if (x < -radius || y < -radius || x > W + radius || y > H + radius){ last = null; return; }
    if (last){
      const dx = x - last.x, dy = y - last.y, dist = Math.hypot(dx, dy);
      const step = Math.max(radius * 0.3, 1), n = Math.min(Math.ceil(dist / step), 60);
      for (let i = 1; i <= n; i++) points.push({ x: last.x + dx * i / n, y: last.y + dy * i / n });
    } else points.push({ x, y });
    last = { x, y };
    if (!running){ running = true; idle = 0; requestAnimationFrame(frame); }
  }, { passive:true });
  addEventListener('blur', () => { last = null; points.length = 0; hide(); });
  new ResizeObserver(measure).observe(stage);
  measure();
}
if (matchMedia('(max-width: 1023.98px), (hover: none)').matches){
  $('#figCanvas')?.remove();                                     // touch screens: the black & white photo, no reveal
} else liquidReveal($('#fig'), $('#figCanvas'), $('#figBase').src);

/* ---------- Mode (light / dark) ---------- */
const MODE_KEY = 'aniket-mode';
const themeMeta = document.querySelector('meta[name="theme-color"]');
let modeAnimT = 0;
function getMode(){ return root.dataset.mode === 'dark' ? 'dark' : 'light'; }
function setMode(m, animate = true){
  if (animate && !reduced && document.startViewTransition){
    document.startViewTransition(() => setMode(m, false));
    return;
  }
  if (m === 'dark') root.dataset.mode = 'dark'; else delete root.dataset.mode;
  themeMeta?.setAttribute('content', m === 'dark' ? '#1A1818' : '#EEEAE6');
  $('#cordHit')?.setAttribute('aria-checked', String(m === 'dark'));
  try { localStorage.setItem(MODE_KEY, m); } catch (e) {}
}
setMode(getMode(), false);
const toggleMode = () => setMode(getMode() === 'dark' ? 'light' : 'dark');

/* ---------- Pull cord: verlet rope you can grab, swing and pull ----------
   The rope hangs from above the top edge. Pulling it past the switch's spring travel
   clicks the switch (toggles the mode) the way a ceiling pull-cord does; letting go
   lets the spring snap the cord back up and the rope settles under gravity. */
(function pullCord(){
  const wrap = $('#cord'), cv = $('.cord__cv', wrap), hit = $('#cordHit');
  const ctx = cv.getContext('2d');
  const N = 26;                         // segments
  const G = 4600;                       // gravity, px/s² (tuned so a ~30 cm cord swings at a lifelike ~1.2 s period)
  const STEP = 1 / 120;                 // fixed physics step
  const ITER = 16;                      // constraint passes
  let dpr = 1, W = 300, H = 500;
  let L = 220, EXT_MAX = 46, HIDDEN = 70, seg = 10, ax = 200, thick = 3.2, knobS = 1;
  let pts = [];                         // {x,y,px,py,w}
  let ext = 0, extV = 0, armed = true;
  let grab = -1, grabOff = { x:0, y:0 }, target = null, ptr = null, ptrPrev = null;
  let downAt = 0, downPos = null, moved = 0;
  let acc = 0, lastT = 0, t = 0;
  let dropped = false, live = false;

  function layout(){
    const rem = parseFloat(getComputedStyle(root).fontSize) || 16;
    const vw = innerWidth, vh = innerHeight;
    let offset;                          // anchor distance from the viewport's right edge
    if (vw >= 1024){ offset = 4.25 * rem; L = Math.min(270, Math.max(190, vh * .3)); EXT_MAX = 72; thick = 3.7; knobS = 1.3; }
    else if (vw >= 640){ offset = 5.9 * rem; L = Math.min(220, Math.max(160, vh * .2)); EXT_MAX = 62; thick = 3.4; knobS = 1.2; }
    else { offset = 5.7 * rem; L = 70; EXT_MAX = 54; thick = 3.1; knobS = 1.1; }
    HIDDEN = EXT_MAX + 18;
    W = Math.min(vw, 340);
    H = Math.round(L + EXT_MAX + 170);
    wrap.style.height = H + 'px';
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    // small screens: hang just left of the local-time badge
    const ck = document.querySelector('.hdr .clock');
    if (ck && ck.offsetWidth){
      // desktop: hang right beside the local-time badge; small screens: near the right edge (over the badge is fine)
      offset = vw >= 1200 ? Math.max(1.2 * rem, vw - ck.getBoundingClientRect().right - 1.4 * rem) : 2.4 * rem;
    }
    const newAx = W - offset;
    const total = L + HIDDEN;
    seg = total / N;
    if (!pts.length){
      for (let i = 0; i <= N; i++){
        const x = newAx, y = -HIDDEN + i * seg;
        pts.push({ x, y, px: x, py: y, w: i === 0 ? 0 : i === N ? .28 : 1 });
      }
    } else {
      const dx = newAx - ax;
      for (const p of pts){ p.x += dx; p.px += dx; }
    }
    ax = newAx;
  }

  /* ----- physics ----- */
  function step(dt){
    if (!dropped) return;
    t += dt;
    // switch spring (anchor travel) — free when nobody is pulling
    if (grab < 0){
      const K = 760, C = 21;
      extV += (-K * ext - C * extV) * dt;
      ext += extV * dt;
    }
    if (ext > EXT_MAX * .8 && armed && live){ armed = false; toggleMode(); try { navigator.vibrate?.(12); } catch (e) {} }
    if (ext < EXT_MAX * .22) armed = true;

    const a = pts[0];
    a.x = a.px = ax; a.y = a.py = -HIDDEN + ext;

    const wind = reduced ? 0 : (Math.sin(t * .63) * 16 + Math.sin(t * 1.71 + 1.3) * 7);
    const damp = grab >= 0 ? .992 : .9875;
    for (let i = 1; i <= N; i++){
      if (i === grab) continue;
      const p = pts[i];
      const vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp;
      p.px = p.x; p.py = p.y;
      p.x += vx + wind * dt * dt * (i / N);
      p.y += vy + G * dt * dt;
    }
    if (grab >= 0 && target){
      const g = pts[grab];
      g.px = g.x; g.py = g.y;
      g.x = target.x; g.y = target.y;
    }
    for (let k = 0; k < ITER; k++){
      for (let i = 0; i < N; i++){
        const p1 = pts[i], p2 = pts[i + 1];
        const w1 = (i === grab) ? 0 : p1.w, w2 = (i + 1 === grab) ? 0 : p2.w;
        const sw = w1 + w2; if (!sw) continue;
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const diff = (d - seg) / d / sw;
        p1.x += dx * diff * w1; p1.y += dy * diff * w1;
        p2.x -= dx * diff * w2; p2.y -= dy * diff * w2;
      }
    }
    // keep the knob inside the drawing area
    for (let i = 1; i <= N; i++){
      const p = pts[i];
      if (p.x < 14){ p.x = 14; } else if (p.x > W - 14){ p.x = W - 14; }
      if (p.y > H - 46){ p.y = H - 46; }
    }
  }

  // while dragging: the pointer sets the grabbed point; the switch spring gives way
  function updateDrag(){
    if (grab < 0 || !ptr) return;
    let tx = ptr.x - grabOff.x, ty = ptr.y - grabOff.y;
    const bx = ax, by = -HIDDEN;
    const reach = grab * seg;                         // rope length from switch to grabbed point
    let dx = tx - bx, dy = ty - by, d = Math.hypot(dx, dy) || 1e-6;
    let need = d - reach;
    if (need > EXT_MAX){                              // past the end stop: heavy rubbery resistance
      const over = need - EXT_MAX;
      const allowed = reach + EXT_MAX + over * .14 / (1 + over / 160);
      tx = bx + dx / d * allowed; ty = by + dy / d * allowed;
      need = EXT_MAX;
    }
    const targetExt = Math.max(0, need);
    const prevExt = ext;
    ext += (targetExt - ext) * .55;
    extV = (ext - prevExt) * 60;
    target = { x: Math.max(14, Math.min(W - 14, tx)), y: Math.min(H - 46, ty) };
  }

  /* ----- input ----- */
  const local = e => { const r = wrap.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function startDrag(e_, i_){ wake(); return startDrag_(e_, i_); }
  function startDrag_(e, idx){
    grab = idx;
    const p = local(e), g = pts[idx];
    grabOff = { x: p.x - g.x, y: p.y - g.y };
    ptr = ptrPrev = p; target = { x: g.x, y: g.y };
    downAt = performance.now(); downPos = p; moved = 0;
    wrap.classList.add('dragging');
    addEventListener('pointermove', onMove, { passive: false });
    addEventListener('pointerup', endDrag);
    addEventListener('pointercancel', endDrag);
  }
  function onMove(e){
    if (grab < 0) return;
    e.preventDefault();
    ptrPrev = ptr; ptr = local(e);
    moved = Math.max(moved, Math.hypot(ptr.x - downPos.x, ptr.y - downPos.y));
  }
  function endDrag(){
    if (grab < 0) return;
    const g = pts[grab];
    // fling: carry the hand's last velocity into the rope
    if (ptr && ptrPrev){
      const vx = (ptr.x - ptrPrev.x), vy = (ptr.y - ptrPrev.y);
      g.px = g.x - vx * .5; g.py = g.y - vy * .5;
    }
    const tap = moved < 6 && performance.now() - downAt < 300;
    grab = -1; target = null; ptr = ptrPrev = null;
    wrap.classList.remove('dragging');
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerup', endDrag);
    removeEventListener('pointercancel', endDrag);
    if (tap) tug();
  }
  // a quick tug (tap, click or keyboard) yanks the cord just past the click point
  function tug(){ wake(); extV = EXT_MAX * 44; pts[N].px = pts[N].x + 1.5; }

  hit.addEventListener('pointerdown', e => {
    if (!dropped) return;
    e.preventDefault();
    try { hit.setPointerCapture(e.pointerId); } catch (_) {}
    startDrag(e, N);
  });
  hit.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); tug(); } });
  hit.addEventListener('click', e => e.preventDefault());

  // desktop: the rope itself can be grabbed anywhere along its length
  document.addEventListener('pointerdown', e => {
    if (!dropped || e.pointerType !== 'mouse' || e.button !== 0 || grab >= 0 || e.target === hit) return;
    const p = local(e);
    if (p.x < 0 || p.y < 0 || p.x > W || p.y > H) return;
    let best = -1, bd = 11;
    for (let i = 2; i <= N; i++){
      if (pts[i].y < 0) continue;
      const d = Math.hypot(pts[i].x - p.x, pts[i].y - p.y);
      if (d < bd){ bd = d; best = i; }
    }
    if (best > 0){ e.preventDefault(); startDrag(e, best); }
  });
  // brushing past the rope with the mouse nudges it
  addEventListener('pointermove', e => {
    if (grab >= 0 || e.pointerType !== 'mouse') return;
    const p = local(e);
    if (p.x < -20 || p.y < -20 || p.x > W + 20 || p.y > H + 20){ brush.last = null; return; }
    if (brush.last){
      wake();
      const vx = p.x - brush.last.x, vy = p.y - brush.last.y;
      for (let i = 2; i <= N; i++){
        const q = pts[i], d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < 16){ const f = (1 - d / 16) * .35; q.x += vx * f; q.y += vy * f * .5; }
      }
    }
    brush.last = p;
  }, { passive: true });
  const brush = { last: null };

  /* ----- drawing ----- */
  function pathThrough(c, ps){
    c.beginPath();
    c.moveTo(ps[0].x, ps[0].y);
    for (let i = 1; i < ps.length - 1; i++){
      const mx = (ps[i].x + ps[i + 1].x) / 2, my = (ps[i].y + ps[i + 1].y) / 2;
      c.quadraticCurveTo(ps[i].x, ps[i].y, mx, my);
    }
    const l = ps[ps.length - 1]; c.lineTo(l.x, l.y);
  }
  // sample the smoothed rope densely for the braid texture
  function samples(ps, spacing){
    const out = [];
    let carry = 0;
    for (let i = 0; i < ps.length - 1; i++){
      const a = ps[i], b = ps[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1e-6;
      let s = carry;
      while (s < len){ out.push({ x: a.x + dx * s / len, y: a.y + dy * s / len, tx: dx / len, ty: dy / len }); s += spacing; }
      carry = s - len;
    }
    return out;
  }
  function knobPath(c){
    c.beginPath();
    c.moveTo(-3.1, 6.2);
    c.bezierCurveTo(-3.6, 10.5, -9.6, 13.5, -9.6, 22.5);
    c.bezierCurveTo(-9.6, 30.5, -5.4, 35, 0, 35);
    c.bezierCurveTo(5.4, 35, 9.6, 30.5, 9.6, 22.5);
    c.bezierCurveTo(9.6, 13.5, 3.6, 10.5, 3.1, 6.2);
    c.closePath();
  }
  function drawKnob(c, x, y, ang, shadowOnly){
    c.save();
    c.translate(x, y); c.rotate(ang - Math.PI / 2); c.scale(knobS, knobS);
    if (shadowOnly){
      knobPath(c); c.fill();
      c.fillRect(-3.4, -.5, 6.8, 7.5);
      c.restore(); return;
    }
    // brass ferrule where the cord is crimped
    const fg = c.createLinearGradient(-3.6, 0, 3.6, 0);
    fg.addColorStop(0, '#5b4a2c'); fg.addColorStop(.3, '#e8d59e'); fg.addColorStop(.55, '#b0924f'); fg.addColorStop(1, '#4a3a1f');
    c.fillStyle = fg;
    c.beginPath(); c.roundRect ? c.roundRect(-3.5, -.6, 7, 7.6, 1.2) : c.rect(-3.5, -.6, 7, 7.6); c.fill();
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-3.5, 2.6, 7, .7); c.fillRect(-3.5, 4.4, 7, .6);
    // turned walnut body
    knobPath(c);
    const bg = c.createLinearGradient(-9.6, 0, 9.6, 0);
    bg.addColorStop(0, '#24150c'); bg.addColorStop(.22, '#6b3f22'); bg.addColorStop(.4, '#a8693d');
    bg.addColorStop(.58, '#7c4828'); bg.addColorStop(.85, '#3b2213'); bg.addColorStop(1, '#1d110a');
    c.fillStyle = bg; c.fill();
    c.save(); knobPath(c); c.clip();
    // grain
    c.strokeStyle = 'rgba(30,14,6,.28)'; c.lineWidth = .55;
    for (let k = -3; k <= 3; k++){
      c.beginPath(); c.moveTo(k * 2.4 - .6, 8); c.bezierCurveTo(k * 2.9 + 1, 16, k * 2.2 - 1, 26, k * 1.6, 35); c.stroke();
    }
    // soft top-left key light + bottom occlusion
    const hl = c.createRadialGradient(-3.6, 17, .5, -3.6, 17, 9);
    hl.addColorStop(0, 'rgba(255,226,190,.42)'); hl.addColorStop(1, 'rgba(255,226,190,0)');
    c.fillStyle = hl; c.fillRect(-10, 6, 20, 30);
    const bo = c.createLinearGradient(0, 24, 0, 35.5);
    bo.addColorStop(0, 'rgba(0,0,0,0)'); bo.addColorStop(1, 'rgba(0,0,0,.35)');
    c.fillStyle = bo; c.fillRect(-10, 6, 20, 30);
    c.restore();
    // crisp specular streak
    c.fillStyle = 'rgba(255,240,220,.38)';
    c.beginPath(); c.ellipse(-4.4, 20.5, 1.1, 5.2, -.08, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  function draw(){
    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const ps = pts;
    const last = ps[N], prev = ps[N - 1];
    const ang = Math.atan2(last.y - prev.y, last.x - prev.x);

    // cast shadow on the wall behind
    const sa = parseFloat(getComputedStyle(root).getPropertyValue('--cord-shadow')) || .2;
    c.save();
    c.translate(7, 11);
    if ('filter' in c) c.filter = 'blur(3px)';
    c.strokeStyle = `rgba(0,0,0,${sa * .8})`; c.lineWidth = thick + 1; c.lineCap = 'round';
    pathThrough(c, ps); c.stroke();
    c.fillStyle = `rgba(0,0,0,${sa})`;
    drawKnob(c, last.x, last.y, ang, true);
    c.restore();

    // braided cotton cord: dark edge, body, light side, twist
    c.lineCap = 'round'; c.lineJoin = 'round';
    pathThrough(c, ps);
    c.strokeStyle = '#6f6455'; c.lineWidth = thick + 1.3; c.stroke();
    c.strokeStyle = '#d6ccba'; c.lineWidth = thick; c.stroke();
    const sm = samples(ps, thick * 1.05);
    c.lineWidth = Math.max(.6, thick * .24);
    c.strokeStyle = 'rgba(96,82,64,.55)';
    c.beginPath();
    for (const q of sm){
      if (q.y < -2) continue;
      const nx = -q.ty, ny = q.tx, h = thick * .5;
      c.moveTo(q.x - nx * h - q.tx * h * .7, q.y - ny * h - q.ty * h * .7);
      c.lineTo(q.x + nx * h + q.tx * h * .7, q.y + ny * h + q.ty * h * .7);
    }
    c.stroke();
    // highlight along the lit side
    c.save();
    c.translate(-thick * .2, -thick * .05);
    pathThrough(c, ps);
    c.strokeStyle = 'rgba(255,252,244,.55)'; c.lineWidth = thick * .28; c.stroke();
    c.restore();

    drawKnob(c, last.x, last.y, ang, false);

    // keep the hit target on the knob
    const kx = last.x + Math.cos(ang) * 20 * knobS, ky = last.y + Math.sin(ang) * 20 * knobS;
    hit.style.transform = `translate(${kx}px, ${ky}px)`;
  }

  // the rope sleeps once it hangs still, so it costs nothing while you scroll; touching, pulling or resizing wakes it
  let sleeping = false, still = 0;
  let touchedAt = 0;
  function wake(){ still = 0; touchedAt = performance.now(); if (!sleeping) return; sleeping = false; lastT = 0; acc = 0; requestAnimationFrame(loop); }
  window.__cordWake = wake;
  function loop(now){
    if (!lastT) lastT = now;
    let dt = Math.min((now - lastT) / 1000, 1 / 20); lastT = now;
    updateDrag();
    acc += dt;
    while (acc >= STEP){ step(STEP); acc -= STEP; }
    // left alone, the swing calms a little faster so the rope comes to rest (and stops costing anything) sooner
    if (dropped && live && grab < 0 && now - touchedAt > 2500) for (const q of pts){ q.px += (q.x - q.px) * .06; q.py += (q.y - q.py) * .06; }
    draw();
    let motion = Math.abs(extV) + Math.abs(ext);
    for (const q of pts) motion = Math.max(motion, Math.abs(q.x - q.px) + Math.abs(q.y - q.py));
    if (dropped && live && grab < 0 && motion < .06){ if (++still > 30){ for (const q of pts){ q.px = q.x; q.py = q.y; } sleeping = true; return; } } else still = 0;
    requestAnimationFrame(loop);
  }

  layout();
  // start pulled up out of view; it drops in once the intro has finished
  // folded up above the switch, out of view: it drops and swings into place after the intro
  pts.forEach((p, i) => { p.y = p.py = -HIDDEN - i * seg * .98; p.x = p.px = ax + Math.sin(i * .5) * 1.5; });
  const drop = () => {
    dropped = true;
    for (const p of pts){ p.px = p.x - .45; }       // a slight sideways swing as it falls
    setTimeout(() => { live = true; }, 900);
  };
  if (document.body.classList.contains('ready')) drop();
  else addEventListener('intro:ready', () => setTimeout(drop, 650), { once: true });
  addEventListener('resize', () => { wake(); clearTimeout(layout._t); layout._t = setTimeout(() => { layout(); wake(); }, 100); });
  new MutationObserver(wake).observe(root, { attributes: true, attributeFilter: ['data-mode'] });
  requestAnimationFrame(loop);
})();

/* ---------- Doors: hover cracks a door open; click swings it open and carries you through it ---------- */
(function doors(){
  // each door is its own page (/photographer etc.)
  const ROUTES = ['seo-content/', 'website-copy/', 'social-ad-copy/', 'email-scripts/', 'creative-writing/'];
  const SLUGS = ['seo-content', 'website-copy', 'social-ad-copy', 'email-scripts', 'creative-writing'];
  // a link like …#photographer lands at the doors and walks straight through that one
  const HASH_DOOR = SLUGS.indexOf(decodeURIComponent(location.hash.slice(1)));
  if (HASH_DOOR >= 0){
    try { history.replaceState(null, '', location.pathname + location.search + '#works'); } catch (e) {}
    addEventListener('intro:ready', () => { warm(HASH_DOOR); setTimeout(() => window.openDoor(HASH_DOOR), 650); }, { once: true });
  }
  const sec = $('#works'); if (!sec) return;
  const units = [...sec.querySelectorAll('.unit')];
  const veil = $('#veil');
  const ANG = 70, ANG_WALK = 70;                       // fully open, swung into the room
  let busy = false;

  const doorsState = units.map((u, i) => {
    const door = $('.door', u);
    const s = spring({ tension: 120, friction: 14 }, o => {
      door.style.transform = `rotateY(${Math.max(0, o) * ANG}deg)`;   // the frame's door stop: never swings outward
      u.style.setProperty('--o', Math.max(0, o).toFixed(4));
    });
    return { u, door, s, way: $('.doorway', u) };
  });

  // reveal the doors once the wall scrolls into view
  if ('IntersectionObserver' in window && !reduced){
    sec.classList.add('pre');
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)){
        sec.classList.add('in');
        requestAnimationFrame(() => sec.classList.remove('pre'));
        io.disconnect();
      }
    }, { threshold: .18 });
    io.observe(sec);
  }

  // cursor badge: sits exactly on the pointer (no easing, no travel); only its opacity fades
  const badge = $('#doorCursor');
  let over = false;
  const place = e => { badge.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`; };
  const showBadge = on => { over = on; badge.classList.toggle('on', on); };
  if (canHover){
    addEventListener('pointermove', e => { if (over) place(e); }, { passive: true });
    units.forEach(u => {
      const w = $('.doorway', u);
      w.addEventListener('pointerenter', e => { place(e); if (!busy) showBadge(true); });
      w.addEventListener('pointerleave', () => showBadge(false));
    });
  }

  // fetch the page behind a door as soon as someone shows interest in it
  const warmed = new Set();
  const warm = i => {
    if (warmed.has(i)) return; warmed.add(i);
    loadRoom(i);
  };

  /* The photo wall is loaded, fully painted, inside this page while you stand at the doors.
     Opening the door reveals that same live wall, so there is no page swap to glitch. */
  const wallv = $('#wallv');
  // every door has its own room, loaded inside this page, so stepping in and coming back never reloads anything
  const frames = [], ready = [], TITLES = ['SEO Content', 'Website Copy', 'Social & Ad Copy', 'Email & Scripts', 'Creative Writing'];
  let frame = null, frameReady = false, cur = 0, inWall = false, pushed = false, savedGap = null;
  function loadRoom(i){
    if (frames[i]) return;
    const f = document.createElement('iframe');
    f.src = ROUTES[i] + '?embed';
    f.title = TITLES[i];
    f.tabIndex = -1;
    f.addEventListener('load', () => { ready[i] = true; if (i === cur) frameReady = true; f.contentWindow?.postMessage({ wall: 'mode', mode: root.dataset.mode === 'dark' ? 'dark' : 'light' }, location.origin === 'null' ? '*' : location.origin); }, { once: true });
    frames[i] = f; wallv.appendChild(f);
  }
  const pick = i => { cur = i; frame = frames[i]; frameReady = !!ready[i]; frames.forEach((f, k) => f && f.classList.toggle('cur', k === i)); };
  const toWall = msg => { try { frame?.contentWindow?.postMessage(msg, location.origin === 'null' ? '*' : location.origin); } catch (e) {} };
  // start fetching the wall once the doors are near, so a click never waits
  if ('IntersectionObserver' in window){
    const near = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)){ near.disconnect(); setTimeout(() => { warm(4); setTimeout(() => [0, 1, 2, 3].forEach(warm), 1500); }, 600); } }, { rootMargin: '200px' });
    near.observe(sec);
  }

  // hovering the doors: promote them to a GPU layer and pre-render them at the zoom the walk-through will use,
  // so clicking has nothing heavy left to do (a paused animation makes the browser raster at its peak scale)
  let warmZoom = null;
  const lift = () => {
    if (sec.classList.contains('lift')) return;
    sec.classList.add('lift');
  };
  sec.addEventListener('pointerenter', lift);
  doorsState.forEach((d, i) => {
    d.way.addEventListener('focus', lift);
    d.way.addEventListener('pointerenter', () => warm(i));
    d.way.addEventListener('focus', () => warm(i));
    if (canHover){
      d.way.addEventListener('mouseenter', () => { if (!busy) d.s.set(.1); });
      d.way.addEventListener('mouseleave', () => { if (!busy) d.s.set(0); });
    }
    d.way.addEventListener('click', () => enter(i));
  });

  // from the nav or a link: go down to the doors, face the right one, then open it and walk in
  // what each door holds: shown beside the door on hover (desktop), under the swipe hint on phones
  const INFO = [["SEO Content", "Research that earns attention. Content that answers.", ["Keyword research & content strategy", "Research-driven blogs & articles", "SEO & Answer Engine Optimization", "Content audits & refreshes"]], ["Website Copy", "Make your next visitor understand. Then act.", ["Website & landing page writing", "Product messaging & positioning", "Conversion-focused copy", "Sales decks & brand collateral"]], ["Social & Ad Copy", "A good story starts a conversation.", ["LinkedIn & organic social strategy", "Google & Meta ad copywriting", "Reddit community marketing", "Editorial & social calendars"]], ["Email & Scripts", "Words that keep the conversation going.", ["Email campaign sequences", "WhatsApp marketing copy", "Shorts, reels & video ad scripts", "Campaign planning & editing"]], ["Creative Writing", "There\u2019s a story behind everything.", ["Creative writing & storytelling", "Novel editing", "Thought leadership", "Independent publishing"]]];
  const dinfo = $('#dinfo'), wallEl = $('.doors__wall', sec), MOB = matchMedia('(max-width: 639.98px)');
  units.forEach((u, i) => $('.doorway', u).setAttribute('aria-description', INFO[i][1] + ': ' + INFO[i][2].join(', ')));
  const setInfo = i => { dinfo.querySelector('.dinfo__h').textContent = INFO[i][0]; dinfo.querySelector('.dinfo__t').textContent = INFO[i][1]; dinfo.querySelector('.dinfo__p').innerHTML = INFO[i][2].map(s => `<li>${s}</li>`).join(''); };
  if (canHover){
    // one source of truth: whichever door is under the pointer right now (re-checked on every move and scroll),
    // so the description can never be left behind however fast the cursor travels
    let active = -1, token = 0, px = -1, py = -1;
    const show = i => {
      const my = ++token;
      units.forEach((u, k) => u.classList.toggle('on', k === i));
      sec.classList.add('focus');
      const visible = units.filter(u => getComputedStyle(u).visibility !== 'hidden');
      const vi = visible.indexOf(units[i]); if (vi < 0) return;
      const wr = wallEl.getBoundingClientRect(), r = units[i].getBoundingClientRect();
      const toRight = vi < 2 && visible[vi + 2];
      const a = toRight ? visible[vi + 1].getBoundingClientRect() : (visible[vi - 2] || visible[vi - 1]).getBoundingClientRect();
      const b = toRight ? visible[vi + 2].getBoundingClientRect() : visible[vi - 1].getBoundingClientRect();
      const left = Math.min(a.left, b.left), right = Math.max(a.right, b.right);
      const place = () => {
        if (my !== token || active !== i) return;          // something newer happened: do nothing
        setInfo(i);
        const w = Math.min(right - left, 22 * 16);
        dinfo.style.width = w + 'px';
        dinfo.style.left = (left - wr.left + (right - left - w) / 2) + 'px';        // centred in the space of the faded doors
        dinfo.style.top = (r.top - wr.top + r.height * .5 - dinfo.offsetHeight / 2) + 'px';
        dinfo.classList.add('on');
      };
      if (dinfo.classList.contains('on')){ dinfo.classList.remove('on'); setTimeout(place, 130); } else place();
    };
    const hide = () => { token++; sec.classList.remove('focus'); units.forEach(u => u.classList.remove('on')); dinfo.classList.remove('on'); };
    const set = i => { if (busy) i = -1; if (i === active) return; active = i; if (i < 0) hide(); else show(i); };
    const under = el => { const w = el && el.closest ? el.closest('.doorway') : null; return w ? units.findIndex(u => u.contains(w)) : -1; };
    addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; set(under(e.target)); }, { passive: true });
    addEventListener('scroll', () => { if (px >= 0) set(under(document.elementFromPoint(px, py))); }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => set(-1));
    addEventListener('blur', () => set(-1));
    units.forEach((u, i) => {
      const w = $('.doorway', u);
      w.addEventListener('focus', () => { if (w.matches(':focus-visible')) set(i); });
      w.addEventListener('blur', () => { if (px < 0 || under(document.elementFromPoint(px, py)) !== i) set(-1); });
    });
    window.__doorHover = set;
  } else if (!MOB.matches) dinfo.style.display = 'none';

  // phones: the wall stays pinned while you scroll; each stretch of scrolling (or a sideways swipe) moves one door along
  const mRow = $('.doors__row', sec);
  let mIdx = 0, mForce = -1, mShown = -1;
  const mSpan = () => Math.max(1, sec.offsetHeight - innerHeight);
  const mobY = i => sec.getBoundingClientRect().top + pageYOffset + (Math.min(3, Math.max(0, i)) / 3) * mSpan();
  const mDots = $('.doors__dots', sec);
  let mCur = 0, mRaf = 0, mLast = 0, mSettle = 0, swipeLock = 0;
  // scroll progress across the pinned wall → a door position that rests on each door and glides between them
  const mDwell = f => { const i = Math.floor(f), t = f - i, u = Math.min(1, Math.max(0, (t - .2) / .6)); return i + u * u * (3 - 2 * u); };
  const mProgress = () => Math.min(1, Math.max(0, -sec.getBoundingClientRect().top / mSpan()));
  const mTarget = () => mForce >= 0 ? mForce : mDwell(mProgress() * 3);
  function mShow(i){
    if (i === mShown) return;
    mShown = i; setInfo(i);
    mDots?.querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k === Math.min(3, i)));
    dinfo.getAnimations().forEach(a => a.cancel());
    if (!reduced) dinfo.animate([{ opacity: 0, transform: 'translateY(.4rem)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: 'cubic-bezier(.16,1,.3,1)' });
  }
  function mFrame(now){
    mRaf = 0;
    if (!MOB.matches){ mRow.style.transform = ''; return; }
    const dt = Math.min(64, now - (mLast || now)); mLast = now;
    const t = mTarget();
    mCur = reduced ? t : mCur + (t - mCur) * Math.min(1, dt / 1000 * 10);
    mCur = Math.max(t - 1, Math.min(t + 1, mCur));
    if (Math.abs(t - mCur) < .001) mCur = t;
    const step = units[1].offsetLeft - units[0].offsetLeft;
    mRow.style.transform = `translate3d(${(-mCur * step).toFixed(2)}px,0,0)`;
    mIdx = Math.round(t); mShow(mForce >= 0 ? mForce : mIdx);
    if (mCur !== t) mRaf = requestAnimationFrame(mFrame);
  }
  function mApply(){ if (!mRaf) mRaf = requestAnimationFrame(mFrame); }
  // the door takes exactly the height left under the text; on short screens the checklist steps aside for it
  const mPin = $('.doors__pin', sec);
  function mSize(){
    if (!MOB.matches){ mPin.style.removeProperty('--uw'); sec.classList.remove('compact'); return; }
    const fit = () => {
      const pr = mPin.getBoundingClientRect(), rr = mRow.getBoundingClientRect();
      const avail = pr.bottom - rr.top - parseFloat(getComputedStyle(mRow).paddingTop) - 2;
      return Math.min(innerWidth * .6, avail / 2.25);
    };
    sec.classList.remove('compact');
    let w = fit();
    if (w < 150){ sec.classList.add('compact'); w = fit(); }
    mPin.style.setProperty('--uw', Math.max(110, w).toFixed(1) + 'px');
    mApply();
  }
  mSize(); addEventListener('resize', mSize); document.fonts?.ready.then(mSize);
  // when scrolling stops part-way between two doors, ease the page onto the nearest one
  const mGo = top => window.__snapTo(top);
  function mFromScroll(){
    if (!MOB.matches || busy) return;
    mApply();
    clearTimeout(mSettle);
    mSettle = setTimeout(function settle(){
      if (window.__touching){ mSettle = setTimeout(settle, 120); return; }
      if (busy || mForce >= 0 || performance.now() < swipeLock) return;
      const r = sec.getBoundingClientRect(); if (r.top > 0 || r.bottom < innerHeight) return;   // only while the wall is pinned
      const want = mobY(Math.round(mProgress() * 3));
      if (Math.abs(pageYOffset - want) > 2) mGo(want);
    }, 220);
  }
  addEventListener('scroll', mFromScroll, { passive: true });
  addEventListener('resize', () => { mFromScroll(); mApply(); });
  // a sideways swipe steps exactly one door from where the finger landed, however much the page moved meanwhile
  let tx0 = 0, ty0 = 0, i0 = 0;
  sec.addEventListener('touchstart', e => { tx0 = e.touches[0].clientX; ty0 = e.touches[0].clientY; i0 = Math.round(mProgress() * 3); }, { passive: true });
  sec.addEventListener('touchend', e => {
    if (!MOB.matches || busy || mForce >= 0) return;
    const dx = e.changedTouches[0].clientX - tx0, dy = e.changedTouches[0].clientY - ty0;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    const to = Math.min(3, Math.max(0, i0 + (dx < 0 ? 1 : -1)));
    swipeLock = performance.now() + 700;
    mGo(mobY(to));
  }, { passive: true });
  if (MOB.matches){ mShown = -1; mShow(0); dinfo.classList.add('on'); mCur = mTarget(); mApply(); }
  MOB.addEventListener?.('change', () => { mForce = -1; mShown = -1; mFromScroll(); mApply(); if (MOB.matches) dinfo.classList.add('on'); });

  // the Creative Writing door sits just past the end of the wall: only the menu (or its link) slides the wall along to it
  const SECRET = 4, secretUnit = units[SECRET];
  function reveal(on){
    sec.classList.toggle('reveal', on);
    if (on) secretUnit.removeAttribute('inert'); else secretUnit.setAttribute('inert', '');
  }
  window.openDoor = i => {
    if (busy || inWall) return;
    const top = MOB.matches ? mobY(Math.min(i, 3)) : sec.getBoundingClientRect().top + pageYOffset;
    const far = Math.abs(pageYOffset - top) > 4;
    if (far){ if (lenis) lenis.scrollTo(top, { duration: .9, easing: x => 1 - Math.pow(1 - x, 3) }); else scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' }); }
    const t0 = performance.now();
    warm(i);
    const settle = () => {
      if (Math.abs(pageYOffset - top) > 24 && performance.now() - t0 < 1500) return requestAnimationFrame(settle);   // open as the scroll lands, not after its tail
      if (!ready[i] && performance.now() - t0 < 4000) return requestAnimationFrame(settle);   // the room is still loading
      const row = $('.doors__row', sec), u = doorsState[i].u;
      let wait = 0;
      if (MOB.matches){
        const want = i === SECRET ? SECRET : i, before = mForce >= 0 ? mForce : mIdx;
        if (i === SECRET){ reveal(true); mForce = SECRET; } else mIdx = i;
        mApply();
        if (want !== before) wait = reduced ? 0 : 560;
      } else if (i === SECRET && !sec.classList.contains('reveal')){ reveal(true); wait = reduced ? 0 : 850; }
      setTimeout(() => enter(i), wait);
    };
    requestAnimationFrame(settle);
  };
  function enter(i){
    if (busy) return;
    busy = true; warm(i); lift();
    showBadge(false);
    window.__doorHover?.(-1); sec.classList.remove('focus'); units.forEach(u => u.classList.remove('on')); dinfo.classList.remove('on');
    const d = doorsState[i];
    doorsState.forEach((o, k) => { if (k !== i) o.s.set(0); });
    d.u.classList.add('press');
    setTimeout(() => d.u.classList.remove('press'), 380);
    setTimeout(() => d.s.set(ANG_WALK / ANG), reduced ? 0 : 170);
    setTimeout(() => through(i), reduced ? 0 : 760);
  }

  // walk through: the whole wall scales up around the lit gap beside the open door until
  // the room behind fills the screen, then the room's own page takes over from the same picture
  // walking through: one GPU-only move. The wall of doors scales up around the dark gap beside the
  // open door until that darkness fills the screen; then the room's photos float in out of it.
  let zoom = null, darkAnim = null, walk = null, walkRaf = 0, walkT = null;
  const dark = $('#passage'), shade = $('#shade');
  // freezes scrolling without touching layout (a layout change here is what caused a stall)
  const swallow = e => e.preventDefault();
  const keysStop = e => { if (['ArrowDown','ArrowUp','PageDown','PageUp',' ','Home','End'].includes(e.key) && !inWall) e.preventDefault(); };
  function holdScroll(on){
    if (on){ lenis?.stop(); addEventListener('wheel', swallow, { passive: false }); addEventListener('touchmove', swallow, { passive: false }); addEventListener('keydown', keysStop); }
    else { lenis?.start(); removeEventListener('wheel', swallow); removeEventListener('touchmove', swallow); removeEventListener('keydown', keysStop); }
  }
  function through(i){
    const u = units[i];
    const r = $('.opening', u).getBoundingClientRect();
    const dr = $('.door', u).getBoundingClientRect();
    const gapL = Math.min(Math.max(dr.right, r.left), r.right - 6);
    const gw = Math.max(r.right - gapL, 10), gh = r.height;
    const cx = (gapL + r.right) / 2, cy = r.top + gh * .5;
    const s = Math.min(60, Math.max(innerWidth / gw, innerHeight / gh) * 1.25);
    holdScroll(true);
    $('#cord')?.classList.add('away'); $('.hdr')?.classList.add('away');
    const ox = cx - gapL, oy = cy - r.top;
    const cover = Math.max(cx / ox, (innerWidth - cx) / (r.right - cx), cy / oy, (innerHeight - cy) / (r.bottom - cy)) * 1.08;
    const timing = { duration: reduced ? 1 : 1600, easing: 'cubic-bezier(.5,0,.75,1)', fill: 'forwards' };
    const sr = sec.getBoundingClientRect();
    sec.style.transformOrigin = `${cx - sr.left}px ${cy - sr.top}px`;
    sec.classList.add('through');
    const tx = innerWidth / 2 - cx, ty = innerHeight / 2 - cy;
    // walk straight through the doorway: the whole scene scales up around the gap, so the frame and door
    // slide out past the left and right edges and the room's own darkness is all that's left.
    // Driven per frame (not as a CSS animation) so the browser scales the existing layer instead of
    // re-rendering the scene at its final zoom first, which is what used to stall.
    const sEnd = Math.max(innerWidth / gw, innerHeight / gh) * 1.15;
    const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    const zoomOf = e => Math.exp(Math.log(sEnd) * e);                        // even speed of approach
    const t0 = performance.now(), D = reduced ? 1 : 1500;
    let handed = false;
    const step = now => {
      const p = Math.min(1, (now - t0) / D), e = ease(p), sc = zoomOf(e);
      const f = Math.min(1, e * 1.6);                                            // drift the door to the centre early on
      sec.style.transform = `translate(${tx * f}px, ${ty * f}px) scale(${sc})`;
      // the moment the dark covers the whole screen, the room takes over: no waiting in the blank
      if (!handed && (sc >= sEnd / 1.15 || p >= 1)){ handed = true; handoff(); }
      if (p < 1) walkRaf = requestAnimationFrame(step);
    };
    walkRaf = requestAnimationFrame(step);
    // as the dark fills the screen, the room takes over (same black, so it's invisible) and the photos start to float in
    function handoff(){
      pick(i);
      if (frameReady){
        wallv.classList.add('on');
        setTimeout(() => {
          inWall = true;
          wallv.classList.add('live');
          try { history.pushState({ wall: 1 }, '', ROUTES[i]); pushed = true; } catch (e) { pushed = false; }
          document.title = TITLES[i] + ' — Aniket';
          toWall({ wall: 'enter' });
          try { frame.contentWindow.focus(); } catch (e) {}
        }, 0);
      } else {
        veil.innerHTML = ''; veil.className = 'veil veil--glow'; veil.style.clipPath = 'none'; veil.style.transition = 'none'; veil.hidden = false;
        requestAnimationFrame(() => { location.href = ROUTES[i]; });
      }
    }
  }

  // leaving the room: photos sink back into the dark, you back out of the doorway, the door swings shut
  function leaveWall(){
    if (!inWall) return;
    inWall = false;
    wallv.classList.remove('live');
    document.title = DOC_TITLE;
    const d = doorsState[cur];
    toWall({ wall: 'exit' });
    setTimeout(() => {
      wallv.classList.remove('on');
      setTimeout(() => {
        cancelAnimationFrame(walkRaf);
        const from = sec.style.transform, back = { finished: new Promise(res => {
          const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/.exec(from) || [0, 0, 0, 1];
          const X = +m[1], Y = +m[2], S = +m[3], t0 = performance.now(), D = reduced ? 1 : 1300;
          const ease = x => 1 - Math.pow(1 - x, 3);
          const step = now => {
            const p = Math.min(1, (now - t0) / D), e = ease(p);
            const sc = Math.exp(Math.log(S) * (1 - e));
            sec.style.transform = `translate(${X * (1 - e)}px, ${Y * (1 - e)}px) scale(${sc})`;
            if (p < 1) requestAnimationFrame(step); else { sec.style.transform = ''; res(); }
          };
          requestAnimationFrame(step);
        }) };
        back.finished.then(() => {
          cancelAnimationFrame(walkRaf); sec.style.transform = ''; dark.hidden = true; shade.hidden = true;
          sec.classList.remove('through', 'lift'); sec.style.transformOrigin = '';
          d.s.set(0);
          $('#cord')?.classList.remove('away'); $('.hdr')?.classList.remove('away');
          busy = false;
          holdScroll(false);
          toWall({ wall: 'reset' });
          if (afterLeave){ const f = afterLeave; afterLeave = null; setTimeout(f, 60); }
          if (cur === SECRET){
            // back out, then the wall slides back and the Creative Writing door is hidden again
            if (MOB.matches){ mForce = -1; mFromScroll(); mApply(); setTimeout(() => reveal(false), reduced ? 0 : 580); }
            else setTimeout(() => reveal(false), reduced ? 0 : 500);
            units[SECRET - 1].querySelector('.doorway').focus({ preventScroll: true });
          } else d.way.focus({ preventScroll: true });
        });
      }, reduced ? 0 : 360);
    }, reduced ? 0 : 520);
  }
  const DOC_TITLE = document.title;
  let afterLeave = null;
  addEventListener('message', e => {
    if (e.source !== frame?.contentWindow || !e.data) return;
    if (e.data.wall === 'go'){
      // a link in the room's navbar or footer
      const to = String(e.data.to || '');
      if (to === 'contact'){ openModal(); return; }                         // the request form opens right over the room
      const n = to.startsWith('door:') ? +to.slice(5) : -1;
      if (n === cur) return;
      afterLeave = () => { if (n >= 0) window.openDoor(n); else scrollToId(to === 'about' ? 'about' : 'home'); };
    } else if (e.data.wall !== 'close') return;
    if (pushed){ pushed = false; history.back(); } else leaveWall();
  });
  addEventListener('popstate', () => { if (inWall && !(history.state && history.state.wall)){ pushed = false; leaveWall(); } });
  addEventListener('keydown', e => { if (e.key === 'Escape' && inWall && $('#modal').hidden && $('#navm').hidden){ if (pushed){ pushed = false; history.back(); } else leaveWall(); } });
  // keep the room's light/dark in step with the cord
  new MutationObserver(() => frames.forEach(f => { try { f?.contentWindow?.postMessage({ wall: "mode", mode: root.dataset.mode === "dark" ? "dark" : "light" }, location.origin === 'null' ? '*' : location.origin); } catch (e) {} }))
    .observe(root, { attributes: true, attributeFilter: ['data-mode'] });

  // coming back with the browser's Back button: put the wall and the door back as they were
  addEventListener('pageshow', e => {
    if (!busy && !e.persisted) return;
    cancelAnimationFrame(walkRaf); dark.hidden = true; shade.hidden = true;
    sec.classList.remove('through'); sec.style.transform = ''; sec.style.transformOrigin = ''; reveal(false);
    veil.classList.remove('on'); veil.hidden = true; veil.style.clipPath = ''; veil.innerHTML = '';
    wallv.classList.remove('on','live'); wallv.style.clipPath = '';
    $('#cord')?.classList.remove('away'); $('.hdr')?.classList.remove('away');
    doorsState.forEach(d => d.s.set(0));
    if (busy){ busy = false; startScroll(); }
  });
})();

/* ---------- PageLoader: the doors' colours stack up as the page loads, then slides apart to open it ---------- */
const loader = $('#loader');
// back from a door's page (#works): skip the intro and stand in front of the doors again
// (#about and #contact come from the links in a room's navbar and footer)
if (['#works', '#about', '#contact'].includes(location.hash)){
  loader.remove();
  document.body.classList.add('ready');
  const wantContact = location.hash === '#contact';
  requestAnimationFrame(() => {
    if (wantContact) setTimeout(() => openModal(), 400);
    const el = $(location.hash === '#about' ? '#about' : '#works');
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + pageYOffset);
    dispatchEvent(new Event('intro:ready'));
  });
} else {
  stopScroll();
  // whatever happens in the intro, the site always opens: any error, or an intro that hasn't finished in 9 s, lets you straight in
  let introDone = false;
  const bailOut = () => {
    if (introDone) return; introDone = true;
    try { loader.remove(); } catch (e) {}
    document.body.classList.add('ready'); startScroll(); dispatchEvent(new Event('intro:ready'));
  };
  window.__introBail = bailOut;
  setTimeout(bailOut, 9000);
  try {
  const num = $('#ldCount'), pills = [...loader.querySelectorAll('.ld__pill')];
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  // real progress: fonts first, then the page's images; the counter never runs ahead of what has actually loaded
  let ready = .55;
  document.fonts?.ready.then(() => { ready = Math.max(ready, .85); });
  const loaded = () => { ready = 1; };
  if (document.readyState === 'complete') loaded(); else addEventListener('load', loaded, { once: true });
  setTimeout(loaded, 5000);                               // never keep anyone waiting long
  // one colour joins the stack for each sixth of the way
  const paint = p => { loader.style.setProperty('--p', p.toFixed(3)); pills.forEach((el, k) => el.classList.toggle('on', p >= k / 6 + .02 || p >= 1)); };
  const FILL = 1600;
  let t0 = null, shown = 0;
  function loadTick(now){
    if (t0 === null) t0 = now;
    const want = Math.min(ease(Math.min(1, (now - t0) / FILL)), ready);
    shown += (want - shown) * .18; if (want - shown < .002) shown = want;
    paint(shown);
    num.textContent = String(Math.round(shown * 100)).padStart(3, '0');
    if (shown < 1) requestAnimationFrame(t => { try { loadTick(t); } catch (e) { bailOut(); } }); else setTimeout(finish, 520);   // the last colour lands, then it opens
  }
  function finish(){
    loader.classList.add('out');                             // the colours slide away and the curtain lifts
    setTimeout(() => document.body.classList.add('ready'), 260);   // the hero plays its entrance as it is uncovered
    setTimeout(bailOut, 1250);
  }
  if (reduced){ num.textContent = '100'; paint(1); setTimeout(finish, 500); }
  else requestAnimationFrame(t => { try { loadTick(t); } catch (e) { bailOut(); } });
  } catch (e) { bailOut(); }
}

/* ---------- Clean routes: the address bar reads /home, /work or /my-story as you move through the page ---------- */
(() => {
  if (!true || location.protocol === 'file:') return;
  const dir = new URL(document.baseURI).pathname;
  const ROUTE = { home: 'home', works: 'work', about: 'my-story', certificates: 'certificates', tools: 'tools', novel: 'novel' };
  let cur = '';
  const set = name => {
    if (name === cur || (history.state && history.state.wall)) return;   // never while a door's page is open
    cur = name;
    try { history.replaceState(history.state, '', dir + ROUTE[name]); } catch (e) {}
  };
  const sectionRoute = location.pathname.match(/\/(home|work|my-story|certificates|tools|novel)\/?$/)?.[1];
  const first = location.hash === '#novel' || sectionRoute === 'novel' ? 'novel' : location.hash === '#tools' || sectionRoute === 'tools' ? 'tools' : location.hash === '#certificates' || sectionRoute === 'certificates' ? 'certificates' : location.hash === '#about' ? 'about' : location.hash === '#works' ? 'works'
    : sectionRoute === 'my-story' ? 'about' : sectionRoute === 'work' ? 'works' : 'home';
  addEventListener('intro:ready', () => {
    if (first !== 'home') {
      const section = document.getElementById(first);
      if (section) {
        if (lenis) lenis.scrollTo(section, { immediate: true });
        else window.scrollTo(0, section.getBoundingClientRect().top + window.pageYOffset);
      }
    }
    set(first);
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) set(e.target.id); }),
      { rootMargin: '-45% 0px -45% 0px' });
    ['home', 'works', 'about', 'novel', 'tools', 'certificates'].forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
  }, { once: true });
})();

/* ---------- Lenis smooth scroll ---------- */
try {
  if (matchMedia('(hover: none), (pointer: coarse)').matches || root.classList.contains('lite')) throw 0;   // phones and modest devices keep native momentum scrolling
  const { default: Lenis } = await import('lenis');
  lenis = new Lenis({ smoothWheel: true }); window.__lenis = lenis;
  if (!scrollEnabled) lenis.stop();
  const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
} catch (err) { /* native scrolling as fallback */ }
