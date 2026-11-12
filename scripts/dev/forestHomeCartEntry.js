/* global performance, document, window */
import { startOwnerForest } from '/js/owner-forest-runtime.js';
import { cartFootprint, cartPoseClear, cartDismount, stepForestCart,
  discIntersectsRectangle } from '/js/forest-cart-motion.js';
import { paintStudyHome, paintStudyCart, paintStudyDestination, paintStudyPaths } from '/__study/paint.js';
import { createConstructionEditor } from '/__study/editor.js';
import { DEFAULT_HOME_DESIGN, studyCartDesign, constructionHomeFootprint,
  validateConstructionDesign, advanceCartPresentation } from '/js/forest-construction-design.js';

const study = JSON.parse(document.getElementById('home-cart-study').textContent);
const { plan } = study;
const main = document.querySelector('main.owner-forest');
const note = document.createElement('section'); note.className = 'home-study-note';
note.innerHTML = `<strong>A home of your own · construction & travel study</strong>
  <p>At home, choose <b>Shape house</b> or <b>Build cart</b> to try parts and finishes. Then take your cart along the pale trail to Amber clearing, step out, and drive home. Touch and drag to travel.<span class="owner-forest__key-hint"> Arrow keys / WASD also work; C enters or leaves the cart and R toggles reversing.</span></p>
  <details><summary>Study options & recovery · temporary state, no account data</summary>
    <div class="home-study-controls">
      <label>Reset cart example<select data-study-cart><option value="canopy">Large canopy cart</option><option value="compact">Compact open cart</option></select></label>
      <label>Reset house example<select data-study-house><option value="large">Wide house</option><option value="compact">Small house</option></select></label>
      <label>Region delivery<select data-study-network><option value="normal">Normal</option><option value="slow">1.2 second delay</option><option value="failed">Unavailable</option></select></label>
      <button type="button" data-study-recover>Recover at home</button>
    </div><p data-home-study-state></p><a href="/__study/report">Placement report</a>
  </details>`;
main.prepend(note);
document.querySelector('[data-owner-forest-reset]').textContent = 'Return to home';

let network = 'normal';
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, options) => {
  const url = typeof input === 'string' ? input : input.url;
  if (/\/api\/v1\/forest\/(regions|authored-regions|terrain-regions)\?/.test(url)) {
    const mode = network;
    if (mode === 'slow') await new Promise(resolve => setTimeout(resolve, 1200));
    if (mode === 'failed') throw new Error('Simulated study region failure');
  }
  return originalFetch(input, options);
};

startOwnerForest({ createExtension(api) {
  const viewport = document.querySelector('[data-owner-forest-viewport]');
  const dock = document.querySelector('[data-owner-forest-dock]');
  const bar = document.createElement('section'); bar.className = 'home-study-bar';
  bar.innerHTML = '<p role="status" aria-live="polite" data-study-guide></p><button type="button" data-study-mount><span data-study-mount-copy>Enter cart</span><span class="owner-forest__key-hint"> · C</span></button><button type="button" data-study-reverse hidden aria-pressed="false">Reverse</button><div class="home-study-workshop"><button type="button" data-study-edit="home">Shape house</button><button type="button" data-study-edit="cart">Build cart</button><span data-study-workshop-help></span></div>';
  dock.prepend(bar);
  const guide = bar.querySelector('[data-study-guide]'), mount = bar.querySelector('[data-study-mount]');
  const mountCopy = bar.querySelector('[data-study-mount-copy]');
  const reverseButton = bar.querySelector('[data-study-reverse]');
  const diagnostics = document.querySelector('[data-home-study-state]');
  let mounted = false, reversing = false, visited = false, completed = false;
  let homeDesign = { ...DEFAULT_HOME_DESIGN }, previewHome = null, previewCart = null;
  let presentation = { wheel: 0, gait: 0 };
  let lastTravelAt = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let blocked = false, unloaded = false, message = '', messageUntil = 0, lastUpdate = 0;
  const initialHeading = Math.atan2(plan.route[1].y - plan.route[0].y, plan.route[1].x - plan.route[0].x);
  let cart = { variant: 'canopy', design: studyCartDesign('canopy'), worldX: plan.parking.x, worldY: plan.parking.y, heading: initialHeading };
  const durations = [], frameTimes = [], travel = { distance: 0, frames: 0, blockedFrames: 0 };
  let lastFrame = 0;
  const percentile = values => values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length * .95)] : 0;
  const house = () => constructionHomeFootprint(plan.home, homeDesign);
  const say = text => { message = text; messageUntil = performance.now() + 3500; };
  function clear(p) {
    if (!api.regionLoaded(p)) { unloaded = true; return false; }
    if (Math.abs(p.worldX) + p.radius > study.extent || Math.abs(p.worldY) + p.radius > study.extent) return false;
    if (discIntersectsRectangle(p, house())) return false;
    const { terrain, placements } = api.state();
    const sample = terrain.sample(p);
    if (!sample.walkable) { if (sample.surface === 'unloaded') unloaded = true; return false; }
    return !placements.some(t => Math.hypot(p.worldX - t.worldX, p.worldY - t.worldY) <= p.radius + t.collisionRadius);
  }
  function recover() {
    editor.cancel();
    mounted = false; reversing = false; blocked = false; unloaded = false; visited = false; completed = false;
    presentation = { wheel: 0, gait: 0 };
    lastTravelAt = 0;
    reverseButton.setAttribute('aria-pressed', 'false');
    cart = { ...cart, worldX: plan.parking.x, worldY: plan.parking.y, heading: initialHeading };
    api.setPlayer({ worldX: plan.spawn.x, worldY: plan.spawn.y });
    say('Back at home. Study positions are temporary.'); api.focus();
  }
  function toggleMount() {
    const { player, busy } = api.state();
    if (busy || editor.active) return;
    if (mounted) {
      const spot = cartDismount(cart, clear);
      if (!spot) { say('No clear place to step out. Move to open ground.'); return; }
      mounted = false; api.setPlayer(spot); say('Cart parked. Walk around or enter again.');
    } else {
      if (Math.hypot(player.worldX - cart.worldX, player.worldY - cart.worldY) > 85) return;
      if (!cartPoseClear(cart, clear)) { say('Waiting for a clear, loaded place to enter.'); return; }
      mounted = true; api.setPlayer({ worldX: cart.worldX, worldY: cart.worldY });
      say('Follow the trail. Reverse helps you back up.');
    }
    api.focus(); api.requestRender();
  }
  function reverse() { reversing = !reversing; reverseButton.setAttribute('aria-pressed', String(reversing)); api.focus(); }
  const nearHome = () => Math.hypot(api.state().player.worldX - plan.parking.x, api.state().player.worldY - plan.parking.y) < 210;
  const cartHome = () => Math.hypot(cart.worldX - plan.parking.x, cart.worldY - plan.parking.y) < 100;
  function designError(kind, design) {
    if (!validateConstructionDesign(kind, design)) return 'Choose supported parts and dimensions.';
    if (mounted || !nearHome() || (kind === 'cart' && !cartHome())) return 'Park at home and step out before building.';
    const player = api.state().player;
    if (kind === 'home') {
      const rect = constructionHomeFootprint(plan.home, design);
      if (discIntersectsRectangle(player, rect) || cartFootprint(cart).some(p => discIntersectsRectangle(p, rect))) {
        return 'Someone is in this footprint. Cancel and move clear before enlarging the house.';
      }
    } else {
      const candidate = { ...cart, design };
      if (!cartPoseClear(candidate, clear)) return 'This cart needs more clear, loaded ground. Cancel and park farther from obstacles.';
      if (cartFootprint(candidate).some(p => Math.hypot(p.worldX - player.worldX, p.worldY - player.worldY) < p.radius + player.radius)) {
        return 'Stand a little farther from the cart before changing its size.';
      }
    }
    return '';
  }
  const editor = createConstructionEditor({ viewport,
    preview(kind, design) {
      if (kind === 'home') previewHome = design; else previewCart = design;
      api.requestRender(); return designError(kind, design);
    },
    apply(kind, design) {
      if (designError(kind, design)) return false;
      if (kind === 'home') homeDesign = design; else { cart = { ...cart, design }; presentation = { wheel: 0, gait: 0 }; }
      say(kind === 'home' ? 'Your house, your way. Kept for this visit.' : 'Your cart is ready to travel. Kept for this visit.');
      return true;
    },
    close() { previewHome = null; previewCart = null; api.setPlayer(api.state().player); api.requestRender(); }
  });
  for (const button of bar.querySelectorAll('[data-study-edit]')) button.addEventListener('click', () => {
    const kind = button.dataset.studyEdit;
    if (mounted || api.state().busy || !nearHome() || (kind === 'cart' && !cartHome())) return;
    if (viewport.dataset.moreOpen === 'true') document.querySelector('[data-owner-forest-more]').click();
    api.setPlayer(api.state().player);
    editor.open(kind, kind === 'home' ? homeDesign : cart.design, button);
  });
  mount.addEventListener('click', toggleMount); reverseButton.addEventListener('click', reverse);
  document.querySelector('[data-study-recover]').addEventListener('click', recover);
  document.querySelector('[data-study-cart]').addEventListener('change', event => {
    editor.cancel(); cart.variant = event.target.value; cart.design = studyCartDesign(cart.variant); recover();
  });
  document.querySelector('[data-study-house]').addEventListener('change', event => {
    recover(); homeDesign = { ...DEFAULT_HOME_DESIGN, ...(event.target.value === 'compact' ? { width: 120, depth: 72 } : {}) };
    api.requestRender();
  });
  document.querySelector('[data-study-network]').addEventListener('change', event => {
    network = event.target.value; api.reloadRegions(); api.focus();
  });
  viewport.addEventListener('keydown', event => {
    if (event.target !== viewport || event.repeat) return;
    if (event.key.toLowerCase() === 'c') { toggleMount(); event.preventDefault(); }
    if (event.key.toLowerCase() === 'r' && mounted) { reverse(); event.preventDefault(); }
  });
  // Read-only diagnostic snapshot for the local walkthrough; no production entry point installs it.
  window.homeCartStudy = { snapshot: () => ({ cart: { ...cart }, mounted, reversing, blocked, unloaded,
    homeDesign: { ...homeDesign }, editor: editor.snapshot(), presentation: { ...presentation },
    visited, completed, player: api.state().player, regionReady: api.regionLoaded(api.state().player),
    route: plan.route, travel: { ...travel },
    moveP95Ms: percentile(durations), frameP95Ms: percentile(frameTimes) }) };
  return {
    hidePlayer: () => mounted,
    reset: recover,
    move(player, direction, elapsed) {
      if (api.state().busy || document.hidden || editor.active) return player;
      if (!mounted) return null;
      const started = performance.now(); unloaded = false;
      const result = stepForestCart(cart, { ...direction, reverse: reversing }, elapsed, clear);
      durations.push(performance.now() - started); if (durations.length > 600) durations.shift();
      presentation = advanceCartPresentation(presentation, cart, result.cart, reducedMotion.matches);
      if (result.distance > .01) lastTravelAt = performance.now();
      cart = result.cart; blocked = result.blocked;
      travel.frames++; travel.distance += result.distance; if (blocked) travel.blockedFrames++;
      return { ...player, worldX: cart.worldX, worldY: cart.worldY };
    },
    canWalk(from, to) {
      const steps = Math.max(1, Math.ceil(Math.hypot(to.worldX - from.worldX, to.worldY - from.worldY) / 2));
      for (let i = 1; i <= steps; i++) {
        const p = { ...to, worldX: from.worldX + (to.worldX - from.worldX) * i / steps,
          worldY: from.worldY + (to.worldY - from.worldY) * i / steps };
        if (!clear(p) || cartFootprint(cart).some(c => Math.hypot(c.worldX - p.worldX,
          c.worldY - p.worldY) < c.radius + p.radius)) return false;
      }
      return true;
    },
    update(time) {
      if (editor.active) {
        const camera = api.state().camera, kind = editor.snapshot().kind;
        const narrow = camera.width < 700;
        const target = kind === 'home' ? { x: plan.home.x, y: plan.home.y - 112 }
          : { x: cart.worldX + Math.cos(cart.heading) * 25, y: cart.worldY - 22 };
        camera.x = target.x - (narrow ? camera.width / 2 : (camera.width - 320) / 2);
        camera.y = target.y - (narrow ? camera.height * .25 : camera.height / 2);
      }
      if (lastFrame && time - lastFrame < 1000) frameTimes.push(time - lastFrame);
      lastFrame = time; if (frameTimes.length > 600) frameTimes.shift();
      if (time - lastUpdate < 180) return; lastUpdate = time;
      const { player, busy } = api.state();
      const distance = Math.hypot(player.worldX - plan.destination.x, player.worldY - plan.destination.y);
      if (!mounted && distance < 100) visited = true;
      if (visited && Math.hypot(player.worldX - plan.parking.x, player.worldY - plan.parking.y) < 100) completed = true;
      const target = visited ? plan.parking : plan.destination;
      const bearing = Math.atan2(target.y - player.worldY, target.x - player.worldX);
      const arrow = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][(Math.round(bearing / (Math.PI / 4)) + 8) % 8];
      const text = time < messageUntil ? message : unloaded && blocked ? 'Waiting for the nearby forest to load.'
        : blocked ? 'Turn toward open ground, or reverse.' : completed ? 'Home again. Try another cart or explore on foot.'
          : `${arrow} ${visited ? 'Home' : 'Amber clearing'} · ${Math.round(Math.hypot(target.x - player.worldX, target.y - player.worldY))} steps${distance < 100 && mounted ? ' · Step out to explore' : ''}`;
      if (guide.textContent !== text) guide.textContent = text;
      mountCopy.textContent = mounted ? 'Step out' : 'Enter cart';
      mount.disabled = busy || (!mounted && Math.hypot(player.worldX - cart.worldX, player.worldY - cart.worldY) > 85);
      reverseButton.hidden = !mounted; reverseButton.textContent = reversing ? 'Reverse: on' : 'Reverse';
      for (const button of bar.querySelectorAll('[data-study-edit]')) {
        button.disabled = busy || mounted || !nearHome() || (button.dataset.studyEdit === 'cart' && !cartHome());
      }
      bar.querySelector('[data-study-workshop-help]').textContent = mounted ? 'Step out to build.'
        : !nearHome() || !cartHome() ? 'The workshop is at home.' : '';
      bar.hidden = busy; viewport.dataset.studyMounted = String(mounted);
      diagnostics.textContent = `Terrain ${study.generation || 'off'} · ${plan.metrics.homeAttempts} site attempts · ${plan.metrics.terrainSamples} samples · ${plan.metrics.elapsedMs}ms allocation · traveled ${Math.round(travel.distance)} · ${blocked ? 'blocked' : 'clear'}`;
    },
    paintGround: (ctx, camera) => paintStudyPaths(ctx, plan, camera),
    depthItems: () => [
      { kind: 'extension', id: 'study-home', worldY: plan.home.y - 35, type: 'home' },
      { kind: 'extension', id: 'study-cart', worldY: cart.worldY, type: 'cart' },
      { kind: 'extension', id: 'study-destination', worldY: plan.destination.y - 20, type: 'destination' }
    ],
    paintDepth(ctx, item, camera, reduce) {
      if (item.type === 'home') paintStudyHome(ctx, plan.home, previewHome || homeDesign, camera);
      else if (item.type === 'cart') paintStudyCart(ctx, { ...cart, design: previewCart || cart.design }, camera, mounted,
        api.state().terrain.elevation({ ...cart, radius: 11 }), reduce ? { wheel: 0, gait: 0 }
          : { ...presentation, walking: mounted && !api.state().busy && performance.now() - lastTravelAt < 100 });
      else paintStudyDestination(ctx, plan.destination, camera);
    }
  };
} });
