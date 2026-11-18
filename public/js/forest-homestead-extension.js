import { homePlacementAllowed } from '/js/forest-home-reservations.js';
import { createHomesteadClient } from '/js/forest-homestead-client.js';
import { advanceCompanionEncounter } from '/js/forest-companion.js';
import { createCompanionEncounter } from '/js/forest-companion-encounter.js';
import { createCompanionActor } from '/js/forest-companion-actor.js';
import { companionHarnessPose } from '/js/forest-companion-motion.js';
import { paintForestCompanion } from '/js/forest-companion-paint.js';
/* global performance */
import { ownerForestCamera } from '/js/owner-forest-scene.js';
import { cartDefinition, cartFootprint, cartPoseClear, cartDismount, stepForestCart,
  discIntersectsRectangle } from '/js/forest-cart-motion.js';
import { paintStudyHome, paintStudyCart, studyCartDepthItems, paintStudyCartSupport, paintStudyCartRiderRow, paintStudyDestination, paintStudyPaths } from '/js/forest-homestead-paint.js';
import { createConstructionEditor } from '/js/forest-construction-editor.js';
import { DEFAULT_HOME_DESIGN, studyCartDesign, constructionHomeFootprint,
  validateConstructionDesign, advanceCartPresentation } from '/js/forest-construction-design.js';

// Shared by the ordinary forest and the isolated construction study.
export function createHomesteadExtension(api, study, { integrated = false } = {}) {
  const { plan } = study;
  const durable = Boolean(study.saved);
  const viewport = document.querySelector('[data-owner-forest-viewport]');
  const dock = document.querySelector('[data-owner-forest-dock]');
  // Reserve the touch dock's space without taking control away from the player.
  const dockObserver = new window.ResizeObserver(() => {
    const { camera, player } = api.state();
    camera.bottomInset = camera.width < 700 ? dock.offsetHeight + 20 : 0;
    Object.assign(camera, ownerForestCamera(player, camera)); api.requestRender();
  });
  dockObserver.observe(dock);
  const bar = document.createElement('section'); bar.className = 'home-study-bar';
  bar.innerHTML = '<p role="status" aria-live="polite" data-study-guide></p><button type="button" data-study-mount><span data-study-mount-copy>Enter cart</span><span class="owner-forest__key-hint"> · C</span></button><button type="button" data-study-reverse hidden aria-pressed="false">Reverse</button><div class="home-study-workshop"><button type="button" data-study-edit="home">Shape house</button><button type="button" data-study-edit="cart">Build cart</button><span data-study-workshop-help></span></div>';
  const careful = document.createElement('button');
  careful.type = 'button'; careful.dataset.studyCareful = ''; careful.hidden = true;
  careful.textContent = 'Careful driving'; careful.title = 'Slow manual steering for bridges and tight spaces'; careful.setAttribute('aria-pressed', 'false');
  const carefulHelp = document.createElement('p'); carefulHelp.hidden = true;
  carefulHelp.style.flexBasis = '100%'; carefulHelp.textContent = 'Careful driving: ↑/↓ or W/S roll forward/back; ←/→ or A/D steer. On touch, drag up/down to roll and left/right to steer. Align before entering a bridge.';
  bar.append(careful, carefulHelp);
  careful.addEventListener('click', () => {
    precision = !precision; careful.setAttribute('aria-pressed', String(precision));
    api.setPlayer(api.state().player); api.focus();
    say(precision ? 'Careful driving: steer left/right, roll forward/back.' : 'Normal driving: travel toward your input.');
  });
  dock.prepend(bar);
  const guide = bar.querySelector('[data-study-guide]'), mount = bar.querySelector('[data-study-mount]');
  const mountCopy = bar.querySelector('[data-study-mount-copy]');
  const reverseButton = bar.querySelector('[data-study-reverse]');
  const diagnostics = document.querySelector('[data-home-study-state]');
  api.navigation?.register('homestead', () => [
    { id: 'home', label: 'Home', worldX: plan.parking.x, worldY: plan.parking.y, nearbyRadius: 85 },
    { id: 'cart', label: 'Parked cart', worldX: cart.worldX, worldY: cart.worldY, nearbyRadius: 75 }
  ]);
  if (integrated) {
    const more = document.querySelector('[data-owner-forest-more-panel]');
    const recoverButton = document.createElement('button'); recoverButton.type = 'button';
    recoverButton.dataset.studyRecover = ''; recoverButton.textContent = 'Recover cart at home';
    more.append(recoverButton);
    const saveNotice = document.createElement('div'); saveNotice.className = 'forest-homestead-save';
    saveNotice.innerHTML = '<span role="status" aria-live="polite" data-save-status></span><button type="button" data-save-retry hidden>Retry save</button>';
    dock.prepend(saveNotice);
  }
  let mounted = false, reversing = false, precision = false, visited = false, completed = false;
  let homeDesign = { ...(study.saved?.homeDesign || DEFAULT_HOME_DESIGN) }, previewHome = null, previewCart = null;
  let presentation = { wheel: 0, gait: 0 };
  let lastTravelAt = 0;
  let companion = study.saved?.companion || null, encounter = null, actor = null;
  let mountRequested = false, lastActorTime = null, animalScene = null;
  let previousSaved = study.saved;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let blocked = false, unloaded = false, message = '', messageUntil = 0, lastUpdate = 0;
  const initialHeading = Math.atan2(plan.route[1].y - plan.route[0].y, plan.route[1].x - plan.route[0].x);
  let cart = { variant: 'canopy', design: studyCartDesign('canopy'), worldX: plan.parking.x, worldY: plan.parking.y, heading: initialHeading };
  if (durable) cart = { ...cart, ...study.saved.parking, design: study.saved.cartDesign };
  let appliedRevision = study.saved?.revision;
  const saves = durable ? createHomesteadClient({ initial: study.saved, onChange(state) {
    document.querySelector('[data-save-status]').textContent = integrated && state.status === 'saved' ? '' : state.message;
    const retry = document.querySelector('[data-save-retry]');
    retry.hidden = !state.pending && !['stale', 'reload'].includes(state.status); retry.disabled = state.busy; retry.textContent = state.status === 'reload' ? 'Reload forest' : state.status === 'stale' ? 'Retry loading' : 'Retry save';
    if (state.record.revision !== appliedRevision) {
      const spatialChange = ['parking', 'homeDesign', 'cartDesign'].some(key =>
        JSON.stringify(previousSaved[key]) !== JSON.stringify(state.record[key]));
      appliedRevision = state.record.revision;
      previousSaved = state.record;
      companion = state.record.companion || null;
      homeDesign = { ...state.record.homeDesign };
      if (spatialChange || state.record.recoveryRequired) {
        cart = { ...cart, ...state.record.parking, design: state.record.cartDesign };
        mounted = false; mountRequested = false; actor?.reset();
        if (state.record.arrival) api.setPlayer(state.record.arrival);
      }
      api.requestRender();
    }
    encounter?.refresh();
  } }) : null;
  if (saves) {
    document.querySelector('[data-save-status]').textContent = integrated && !saves.snapshot().pending ? '' : saves.snapshot().message;
    document.querySelector('[data-save-retry]').hidden = !saves.snapshot().pending;
    document.querySelector('[data-save-retry]').addEventListener('click', async () => {
      if (saves.snapshot().status === 'reload') { window.location.reload(); return; }
      if (saves.snapshot().pending) await saves.retry(); else await saves.refresh();
      editor.refresh();
    });
  }
  const saveBlocked = () => Boolean(saves && (saves.snapshot().busy || saves.snapshot().pending || ['stale', 'reload'].includes(saves.snapshot().status)));
  const durations = [], frameTimes = [], travel = { distance: 0, frames: 0, blockedFrames: 0 };
  let lastFrame = 0;
  const percentile = values => values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length * .95)] : 0;
  const house = () => constructionHomeFootprint(plan.home, homeDesign);
  const companionPosition = () => actor?.snapshot() || companionHarnessPose(cart);
  const nearCompanion = (player = api.state().player) => {
    const animal = companionPosition();
    return Math.hypot(player.worldX - animal.worldX, player.worldY - animal.worldY) < 120;
  };
  function companionMotion(reduce = reducedMotion.matches) {
    const { player, busy } = api.state(), animal = companionPosition();
    const attentive = !mounted && nearCompanion(player);
    const look = Math.atan2(player.worldY - animal.worldY, player.worldX - animal.worldX) - animal.heading;
    return { ...(reduce ? { wheel: 0, gait: 0 } : mounted ? presentation : { wheel: 0, gait: animal.gait }),
      walking: !reduce && !busy && (mounted ? performance.now() - lastTravelAt < 100 : animal.walking),
      detached: !mounted, attentive, resting: !mounted && !animal.walking && !attentive,
      look: attentive && !animal.walking ? Math.max(-.4, Math.min(.4, Math.atan2(Math.sin(look), Math.cos(look)))) : 0,
      greeting: !reduce && !mounted && animal.responding ? .5 + Math.sin(performance.now() / 180) * .5 : 0 };
  }
  const say = text => { message = text; messageUntil = performance.now() + 3500; };
  function clear(p) {
    if (!api.regionLoaded(p)) { unloaded = true; return false; }
    if (Math.abs(p.worldX) + p.radius > study.extent || Math.abs(p.worldY) + p.radius > study.extent) return false;
    if (discIntersectsRectangle(p, house()) || api.occupied(p)) return false;
    const { terrain, placements } = api.state();
    const sample = terrain.sample(p);
    if (!sample.walkable) { if (sample.surface === 'unloaded') unloaded = true; return false; }
    return !placements.some(t => Math.hypot(p.worldX - t.worldX, p.worldY - t.worldY) <= p.radius + t.collisionRadius);
  }
  function animalClear(p) {
    if (!api.regionLoaded(p) || Math.abs(p.worldX) + p.radius > study.extent || Math.abs(p.worldY) + p.radius > study.extent) return false;
    if (discIntersectsRectangle(p, house()) || api.occupied(p)) return false;
    const { terrain, placements } = animalScene || api.state();
    if (!terrain.sample(p).walkable || placements.some(t => Math.hypot(p.worldX - t.worldX, p.worldY - t.worldY) <= p.radius + t.collisionRadius)) return false;
    const d = cartDefinition(cart), dx = p.worldX - cart.worldX, dy = p.worldY - cart.worldY;
    const local = { worldX: Math.cos(cart.heading) * dx + Math.sin(cart.heading) * dy,
      worldY: -Math.sin(cart.heading) * dx + Math.cos(cart.heading) * dy, radius: p.radius };
    return !discIntersectsRectangle(local, { minX: -d.halfLength - 2, maxX: d.halfLength + 2,
      minY: -d.halfWidth - 2, maxY: d.halfWidth + 2 });
  }
  actor = createCompanionActor({ cart: () => cart, clear: animalClear,
    async save(event) {
      if (saves) return saves.save('companion', { encounter: event });
      companion = advanceCompanionEncounter(companion, event, () => window.crypto.randomUUID()); return true;
    }, notice: text => { encounter?.notice(text); api.requestRender(); }
  });
  function recover() {
    actor.cancel(); mountRequested = false;
    if (saves) {
      if (!editor.active && !saveBlocked()) saves.save('recover').then(done => {
        if (done) { mounted = false; cart = { ...cart, ...saves.snapshot().record.parking }; actor.reset();
          if (saves.snapshot().record.arrival) api.setPlayer(saves.snapshot().record.arrival); api.focus(); }
      });
      return true;
    }
    editor.cancel();
    mounted = false; reversing = false; blocked = false; unloaded = false; visited = false; completed = false;
    presentation = { wheel: 0, gait: 0 };
    lastTravelAt = 0;
    reverseButton.setAttribute('aria-pressed', 'false');
    cart = { ...cart, worldX: plan.parking.x, worldY: plan.parking.y, heading: initialHeading };
    actor.reset(); api.setPlayer({ worldX: plan.spawn.x, worldY: plan.spawn.y });
    say('Back at home. Study positions are temporary.'); api.focus();
  }
  async function toggleMount() {
    const { player, busy } = api.state();
    if (busy || editor.active || saveBlocked()) return;
    if (mounted) {
      const spot = cartDismount(cart, clear);
      if (!spot) { say('No clear place to step out. Move to open ground.'); return; }
      if (saves) {
        const parking = { worldX: cart.worldX, worldY: cart.worldY, heading: Math.atan2(Math.sin(cart.heading), Math.cos(cart.heading)) };
        if (!await saves.save('park', { parking })) return;
      }
      mounted = false; mountRequested = false; actor.reset(); api.setPlayer(spot); say(saves ? 'Parking saved. See you here next time.' : 'Cart parked. Walk around or enter again.');
    } else {
      if (Math.hypot(player.worldX - cart.worldX, player.worldY - cart.worldY) > 85) return;
      if (!cartPoseClear(cart, clear)) { say('Waiting for a clear, loaded place to enter.'); return; }
      if (mountRequested) { mountRequested = false; actor.stop(); }
      else { mountRequested = true; actor.hitch(); say('Mallow is coming to the cart.'); }
    }
    api.focus(); api.requestRender();
  }
  function reverse() { reversing = !reversing; reverseButton.setAttribute('aria-pressed', String(reversing)); api.focus(); }
  const nearHome = () => Math.hypot(api.state().player.worldX - plan.parking.x, api.state().player.worldY - plan.parking.y) < 210;
  const cartHome = () => Math.hypot(cart.worldX - plan.parking.x, cart.worldY - plan.parking.y) < 100;
  function designError(kind, design) {
    if (!validateConstructionDesign(kind, design)) return 'Choose supported parts and dimensions.';
    if (mounted || mountRequested || !nearHome() || (kind === 'cart' && !cartHome())) return 'Park at home and step out before building.';
    const player = api.state().player;
    if (kind === 'home') {
      const rect = constructionHomeFootprint(plan.home, design);
      if (discIntersectsRectangle(player, rect) || discIntersectsRectangle({ ...companionPosition(), radius: 22 }, rect) || cartFootprint(cart).some(p => discIntersectsRectangle(p, rect))) {
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
  const editor = createConstructionEditor({ viewport, saved: durable, saveState: () => saves?.snapshot(),
    retry: async () => {
      if (saves.snapshot().status === 'reload') { window.location.reload(); return false; }
      return saves.snapshot().pending ? saves.retry() : (await saves.refresh(), false);
    },
    preview(kind, design) {
      if (kind === 'home') previewHome = design; else previewCart = design;
      api.requestRender(); return designError(kind, design);
    },
    async apply(kind, design) {
      if (designError(kind, design)) return false;
      if (saves) return saves.save(kind, { design });
      if (kind === 'home') homeDesign = design; else { cart = { ...cart, design }; presentation = { wheel: 0, gait: 0 }; actor.reset(); }
      say(kind === 'home' ? 'Your house, your way. Kept for this visit.' : 'Your cart is ready to travel. Kept for this visit.');
      return true;
    },
    close() { previewHome = null; previewCart = null; api.setPlayer(api.state().player); api.requestRender(); }
  });
  const companionAction = kind => {
    if (mounted || mountRequested || editor.active || api.state().busy || saveBlocked() || !nearCompanion()) return;
    api.setPlayer(api.state().player);
    actor.act(kind, api.state().player, companion); api.requestRender();
  };
  encounter = createCompanionEncounter({ dock, read: () => ({ companion, actor: actor.snapshot(), save: saves?.snapshot(),
    available: !mounted && !mountRequested && !editor.active && !api.state().busy && nearCompanion(), blocked: saveBlocked() }),
    act: companionAction, focus: () => api.focus(),
    retry: async () => {
      if (saves.snapshot().status === 'reload') { window.location.reload(); return; }
      if (saves.snapshot().pending) await saves.retry(); else await saves.refresh();
    }
  });
  for (const button of bar.querySelectorAll('[data-study-edit]')) button.addEventListener('click', () => {
    const kind = button.dataset.studyEdit;
    if (mounted || mountRequested || api.state().busy || !nearHome() || (kind === 'cart' && !cartHome())) return;
    if (viewport.dataset.moreOpen === 'true') document.querySelector('[data-owner-forest-more]').click();
    api.setPlayer(api.state().player);
    actor.cancel(); editor.open(kind, kind === 'home' ? homeDesign : cart.design, button);
  });
  mount.addEventListener('click', toggleMount); reverseButton.addEventListener('click', reverse);
  document.querySelector('[data-study-recover]').addEventListener('click', recover);
  document.querySelector('[data-study-cart]')?.addEventListener('change', event => {
    editor.cancel(); cart.variant = event.target.value; cart.design = studyCartDesign(cart.variant); recover();
  });
  document.querySelector('[data-study-house]')?.addEventListener('change', event => {
    recover(); homeDesign = { ...DEFAULT_HOME_DESIGN, ...(event.target.value === 'compact' ? { width: 120, depth: 72 } : {}) };
    api.requestRender();
  });
  document.querySelector('[data-study-network]')?.addEventListener('change', () => {
    api.reloadRegions(); api.focus();
  });
  viewport.addEventListener('keydown', event => {
    if (event.target !== viewport || event.repeat) return;
    if (event.key.toLowerCase() === 'e') { companionAction(companion ? 'scratch' : 'meet'); event.preventDefault(); }
    if (event.key === 'Escape') { actor.cancel(); if (mountRequested) { mountRequested = false; actor.stop(); } api.requestRender(); }
    if (event.key.toLowerCase() === 'c') { toggleMount(); event.preventDefault(); }
    if (event.key.toLowerCase() === 'r' && mounted) { reverse(); event.preventDefault(); }
  });
  // Read-only diagnostic snapshot for the local walkthrough; no production entry point installs it.
  if (!integrated) window.homeCartStudy = { snapshot: () => ({ cart: { ...cart }, mounted, reversing, precision, blocked, unloaded,
    companion: companion ? { ...companion } : null, companionPosition: companionPosition(),
    companionMotion: companionMotion(), actor: actor.snapshot(), mountRequested, camera: { ...api.state().camera },
    save: saves?.snapshot(), homeDesign: { ...homeDesign }, editor: editor.snapshot(), presentation: { ...presentation },
    visited, completed, player: api.state().player, regionReady: api.regionLoaded(api.state().player),
    route: plan.route, travel: { ...travel },
    moveP95Ms: percentile(durations), frameP95Ms: percentile(frameTimes) }) };
  return {
    placementAllowed: (p, writer) => homePlacementAllowed(plan, { x: p.worldX, y: p.worldY, radius: 17, writer })
      && Math.hypot(p.worldX - cart.worldX, p.worldY - cart.worldY) > 110 + 17,
    hidePlayer: () => mounted,
    playerGesture: () => mounted ? null : actor.snapshot().gesture,
    reset: integrated ? () => { if (mounted || mountRequested) { say('Step out before returning to the entrance.'); return true; } actor.cancel(); return false; } : recover,
    move(player, direction, elapsed) {
      if (api.state().busy || document.hidden || editor.active || mounted && saveBlocked()) return player;
      if (!mounted) { actor.walkAway(); return null; }
      const started = performance.now(); unloaded = false;
      const result = stepForestCart(cart, { ...direction, reverse: reversing, precision }, elapsed, clear);
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
        if (!clear(p) || cartFootprint(cart, { animal: false }).some(c => Math.hypot(c.worldX - p.worldX,
          c.worldY - p.worldY) < c.radius + p.radius)) return false;
      }
      return true;
    },
    update(time) {
      const elapsed = lastActorTime === null ? 0 : Math.min(.05, (time - lastActorTime) / 1000);
      lastActorTime = time; animalScene = api.state();
      if (mountRequested && Math.hypot(animalScene.player.worldX - cart.worldX, animalScene.player.worldY - cart.worldY) > 90) {
        mountRequested = false; actor.stop();
      }
      const beforeAnimal = actor.snapshot();
      actor.update({ player: animalScene.player, companion, elapsed, time, mounted,
        paused: animalScene.busy || editor.active || !api.regionLoaded(beforeAnimal) });
      const afterAnimal = actor.snapshot();
      if (mountRequested && actor.ready && !saveBlocked() && !animalScene.busy && cartPoseClear(cart, clear)) {
        mounted = true; mountRequested = false;
        api.setPlayer({ worldX: cart.worldX, worldY: cart.worldY }); api.requestRender();
      }
      if (reducedMotion.matches && (beforeAnimal.worldX !== afterAnimal.worldX || beforeAnimal.worldY !== afterAnimal.worldY
        || beforeAnimal.heading !== afterAnimal.heading || beforeAnimal.gesture?.type !== afterAnimal.gesture?.type)) api.requestRender();
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
      encounter.refresh();
      const distance = Math.hypot(player.worldX - plan.destination.x, player.worldY - plan.destination.y);
      if (!mounted && distance < 100) visited = true;
      if (visited && Math.hypot(player.worldX - plan.parking.x, player.worldY - plan.parking.y) < 100) completed = true;
      const target = visited ? plan.parking : plan.destination;
      const bearing = Math.atan2(target.y - player.worldY, target.x - player.worldX);
      const arrow = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][(Math.round(bearing / (Math.PI / 4)) + 8) % 8];
      let text = time < messageUntil ? message : unloaded && blocked ? 'Waiting for the nearby forest to load.'
        : blocked ? precision ? 'Back up and straighten toward clear ground.' : 'Try careful driving to line up, or reverse.' : completed ? 'Home again. Try another cart or explore on foot.'
          : `${arrow} ${visited ? 'Home' : 'Amber clearing'} · ${Math.round(Math.hypot(target.x - player.worldX, target.y - player.worldY))} steps${distance < 100 && mounted ? ' · Step out to explore' : ''}`;
      if (time >= messageUntil && !blocked && (integrated || api.navigation)) text = '';
      guide.hidden = !text;
      if (guide.textContent !== text) guide.textContent = text;
      mountCopy.textContent = mounted ? 'Step out' : mountRequested ? 'Cancel boarding' : 'Enter cart';
      mount.disabled = saveBlocked() || busy || (!mounted && Math.hypot(player.worldX - cart.worldX, player.worldY - cart.worldY) > 85);
      if (integrated) {
        mount.hidden = !mounted && !mountRequested && Math.hypot(player.worldX - cart.worldX, player.worldY - cart.worldY) > 85;
        bar.querySelector('.home-study-workshop').hidden = mounted || !nearHome();
        bar.querySelector('[data-study-workshop-help]').hidden = true;
        const recovery = saves?.snapshot().record.recoveryRequired;
        if (recovery && !message) say('Your cart needs a clear parking spot. Choose Recover cart at home in More.');
      }
      careful.hidden = !mounted; careful.disabled = saveBlocked(); carefulHelp.hidden = !mounted || !precision;
      reverseButton.hidden = !mounted; reverseButton.textContent = reversing ? 'Reverse: on' : 'Reverse';
      for (const button of bar.querySelectorAll('[data-study-edit]')) {
        button.disabled = saveBlocked() || busy || mounted || mountRequested || !nearHome() || (button.dataset.studyEdit === 'cart' && !cartHome());
      }
      bar.querySelector('[data-study-workshop-help]').textContent = mounted ? 'Step out to build.'
        : !nearHome() || !cartHome() ? 'The workshop is at home.' : '';
      bar.hidden = busy; viewport.dataset.studyMounted = String(mounted);
      if (diagnostics) diagnostics.textContent = durable ? `Saved revision ${saves.snapshot().record.revision} · Materials: ${saves.snapshot().record.holdings.timber} timber, ${saves.snapshot().record.holdings.cloth} cloth available` : `Terrain ${study.generation || 'off'} · ${plan.metrics.homeAttempts} site attempts · ${plan.metrics.terrainSamples} samples · ${plan.metrics.elapsedMs}ms allocation · traveled ${Math.round(travel.distance)} · ${blocked ? 'blocked' : 'clear'}`;
    },
    paintGround: (ctx, camera) => { if (!integrated) paintStudyPaths(ctx, plan, camera); },
    depthItems: () => [
      { kind: 'extension', id: 'study-home', worldY: plan.home.y - 35, type: 'home' },
      ...studyCartDepthItems({ ...cart, design: previewCart || cart.design }, api.state().terrain.elevation({ ...cart, radius: 11 }), mounted),
      ...(!mounted ? [{ kind: 'extension', id: 'companion', type: 'companion',
        worldY: companionPosition().worldY + api.state().terrain.elevation({ ...companionPosition(), radius: 11 }) }] : []),
      ...(!integrated ? [{ kind: 'extension', id: 'study-destination', worldY: plan.destination.y - 20, type: 'destination' }] : [])
    ],
    paintDepth(ctx, item, camera, reduce) {
      if (item.type === 'home') paintStudyHome(ctx, plan.home, previewHome || homeDesign, camera);
      else if (item.type === 'companion') {
        const animal = companionPosition(), elevation = api.state().terrain.elevation({ ...animal, radius: 11 });
        const c = Math.cos(animal.heading), s = Math.sin(animal.heading);
        const project = (x, y, z = 0) => ({ x: Math.round(animal.worldX + c * x - s * y - camera.x),
          y: Math.round(animal.worldY + s * x + c * y - camera.y - z - elevation) });
        ctx.save(); ctx.fillStyle = 'rgba(18,30,22,.2)'; ctx.beginPath();
        const base = project(0, 0); ctx.ellipse(base.x, base.y, 22, 8, animal.heading, 0, Math.PI * 2); ctx.fill();
        paintForestCompanion(ctx, project, animal.heading, companionMotion(reduce)); ctx.restore();
      }
      else if (item.type === 'cart-rider') paintStudyCartRiderRow(ctx, item, camera);
      else if (item.type === 'cart-support') paintStudyCartSupport(ctx, item, camera);
      else if (item.type === 'cart' || item.type === 'cart-roof') {
        paintStudyCart(ctx, { ...cart, design: previewCart || cart.design }, camera, mounted,
          api.state().terrain.elevation({ ...cart, radius: 11 }), companionMotion(reduce), item.type === 'cart-roof' ? 'roof' : 'body');
      }
      else paintStudyDestination(ctx, plan.destination, camera);
    }
  };
}
