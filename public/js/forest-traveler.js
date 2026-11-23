import { cartFootprint } from './forest-cart-motion.js';
import { DEFAULT_CART_DESIGN } from './forest-construction-design.js';
import { WILD_LANTERNBELL } from './forest-garden-rules.js';
import { paintStudyCart, paintStudyCartSupport, studyCartDepthItems } from './forest-homestead-paint.js';
import { createForestHumanoidMotion, FOREST_HUMANOID_PROFILES, paintForestHumanoid } from './forest-humanoid.js';

const TALK_RADIUS = 52;
const RECOGNITION_RADIUS = 120;
const CAMP_ANGLES = [0, 1, -1, 2, -2, 3, -3, 4].map(step => step * Math.PI / 4);
const CART_DESIGN = { ...DEFAULT_CART_DESIGN, cloth: 'ochre', wood: 'sage' };
const distance = (a, b) => Math.hypot(a.worldX - b.worldX, a.worldY - b.worldY);

export function travelerBlocksMovement(site, to, from = to) {
  if (!site) return false;
  const dx = to.worldX - from.worldX, dy = to.worldY - from.worldY;
  const stepSquared = dx * dx + dy * dy;
  return site.footprint.some(part => {
    const x = part.worldX - from.worldX, y = part.worldY - from.worldY;
    const projection = stepSquared ? (x * dx + y * dy) / stepSquared : 0;
    // A character already overlapping after a position change can still move out.
    if (stepSquared && projection <= 0) return false;
    const progress = Math.min(1, projection);
    return Math.hypot(x - dx * progress, y - dy * progress) < part.radius + to.radius;
  });
}

export function findTravelerRestSite(spawn, clear, approachClear) {
  for (const range of [150, 220]) {
    for (const angle of CAMP_ANGLES) {
      const tansy = { worldX: Math.round(spawn.worldX + Math.cos(angle) * range),
        worldY: Math.round(spawn.worldY + Math.sin(angle) * range), radius: 12 };
      const cart = { worldX: tansy.worldX + 43, worldY: tansy.worldY - 23, heading: -.3, design: CART_DESIGN };
      const footprint = [tansy, ...cartFootprint(cart, { animal: false })];
      const site = { tansy, cart, footprint };
      if (footprint.every(clear) && approachClear(tansy, site)) return site;
    }
  }
  return null;
}

export function createForestTraveler(api) {
  const talk = document.querySelector('[data-forest-traveler-talk]');
  const dialog = document.querySelector('[data-forest-traveler-dialog]');
  const line = dialog.querySelector('[data-forest-traveler-line]');
  const status = dialog.querySelector('[data-forest-traveler-status]');
  const ask = dialog.querySelector('[data-forest-traveler-ask]');
  const road = dialog.querySelector('[data-forest-traveler-road]');
  const orchard = dialog.querySelector('[data-forest-traveler-orchard]');
  const mapOrchard = dialog.querySelector('[data-forest-traveler-map-orchard]');
  const remember = dialog.querySelector('[data-forest-traveler-remember]');
  const back = dialog.querySelector('[data-forest-traveler-back]');
  const accept = dialog.querySelector('[data-forest-traveler-accept]');
  const finish = dialog.querySelector('[data-forest-traveler-finish]');
  const leave = dialog.querySelector('[data-forest-traveler-leave]');
  const memory = api.memory;
  let site = null, saving = false, showingClue = false, lookingAt = null, lastSiteCheck = -Infinity;
  const idleMotion = createForestHumanoidMotion('down');
  api.navigation.register('traveler', () => site ? [{ ...site.tansy, id: 'tansy',
    label: memory.introduced ? 'Tansy Rook' : 'Covered cart', nearbyRadius: TALK_RADIUS }] : []);

  function update(time) {
    const { player, busy, terrain, placements } = api.state();
    if (!busy && distance(player, api.spawn) < 350 && time - lastSiteCheck >= 500) {
      lastSiteCheck = time;
      const treeClear = p => placements.every(tree => distance(p, tree) > p.radius + tree.collisionRadius);
      const clear = p => api.regionLoaded(p) && terrain.sample(p).placeable && api.canRest(p)
        && !api.occupied(p) && distance(p, WILD_LANTERNBELL) > p.radius + 16 && treeClear(p);
      const approachClear = (point, candidate) => {
        const range = distance(point, api.spawn);
        const approach = (range - TALK_RADIUS + 4) / range;
        const steps = Math.ceil(range * approach / 8);
        let before = api.spawn;
        for (let i = 1; i <= steps; i++) {
          const next = { ...api.spawn,
            worldX: api.spawn.worldX + (point.worldX - api.spawn.worldX) * i / steps * approach,
            worldY: api.spawn.worldY + (point.worldY - api.spawn.worldY) * i / steps * approach };
          if (!treeClear(next) || !terrain.canMove(before, next)
            || travelerBlocksMovement(candidate, next, before)) return false;
          before = next;
        }
        return true;
      };
      if (!site || !site.footprint.every(clear)) {
        site = findTravelerRestSite(api.spawn, p => clear(p) && distance(player, p) >= player.radius + p.radius,
          approachClear);
        api.requestRender();
      }
    }
    talk.hidden = !site || busy || !api.canTalk() || distance(player, site.tansy) > TALK_RADIUS;
  }

  function showAnswer() {
    line.textContent = '“I patched it myself. Every patch is from a different coat. I leave the corners loose so I don’t become a kite again. I’ve got a spare ridge frame. Want it for your cart?”';
    lookingAt = site.cart;
    ask.hidden = road.hidden = true;
    if (orchard) orchard.hidden = true;
    accept.hidden = finish.hidden = saving;
    leave.hidden = !saving;
    (saving ? leave : accept).focus({ preventScroll: true });
    api.requestRender();
  }

  function showGreeting() {
    showingClue = false;
    status.hidden = !saving;
    road.hidden = saving;
    if (orchard) orchard.hidden = saving;
    if (mapOrchard) mapOrchard.hidden = true;
    remember.hidden = back.hidden = true;
    ask.hidden = memory.introduced || saving;
    finish.hidden = true;
    accept.hidden = !memory.introduced || memory.frameOwned || saving;
    leave.hidden = false;
    leave.textContent = accept.hidden ? 'Leave' : 'Maybe later';
    const fitted = api.fittedCart();
    lookingAt = fitted && distance(site.tansy, fitted) <= RECOGNITION_RADIUS ? fitted : null;
    if (lookingAt) line.textContent = '“You fitted the ridge frame! Look at that peak. Your cart wears it well.”';
    else if (memory.frameOwned) line.textContent = '“The patches are still holding. Good to see you again.”';
    else if (memory.introduced) line.textContent = '“Well, there’s my canopy inspector. That spare ridge frame is still yours if you want it.”';
    else line.textContent = '“Name’s Tansy Rook. I’ve buried more boots than kin. That cart’s outlasted every pair.”';
    if (saving) showAnswer();
    else (!ask.hidden ? ask : !accept.hidden ? accept : leave).focus({ preventScroll: true });
    api.requestRender();
  }

  function showClue() {
    showingClue = true;
    lookingAt = null;
    ask.hidden = road.hidden = accept.hidden = finish.hidden = true;
    if (orchard) orchard.hidden = true;
    leave.hidden = !saving;
    remember.hidden = memory.amberClearingClue === true;
    back.hidden = false;
    status.hidden = !saving && !memory.amberClearingClue;
    if (memory.amberClearingClue) status.textContent = 'Look for Amber Clearing in Navigate once you have a home clearing.';
    line.textContent = '“I rest at Amber Clearing when the road’s been long. Follow the pale trail from your home clearing to the split stone with the amber reeds. Get down and listen when the wind eases. You can hear the stems tapping the stone.”';
    (saving ? leave : remember.hidden ? back : remember).focus({ preventScroll: true });
    api.requestRender();
  }

  function showOrchard() {
    showingClue = false;
    lookingAt = null;
    ask.hidden = road.hidden = orchard.hidden = remember.hidden = accept.hidden = finish.hidden = leave.hidden = true;
    back.hidden = false;
    const mapStatus = api.orchardStatus();
    mapOrchard.hidden = !['ready', 'mapped'].includes(mapStatus);
    mapOrchard.textContent = mapStatus === 'mapped' ? 'Guide me to Orchard Fork' : 'Mark the orchard fork';
    status.hidden = !mapOrchard.hidden;
    status.textContent = mapStatus === 'blocked' ? 'Finish the pending forest save before marking the fork.'
      : 'Claim a home clearing first, then come back and I’ll point you there.';
    line.textContent = '“Keep going past the split stone till you see a low cairn. Take the left branch as you come up the road. The quince tree is beyond a worn patch where you can leave the cart. Bring a seed home. Quince makes a fine cloth dye.”';
    (mapOrchard.hidden ? back : mapOrchard).focus({ preventScroll: true });
    api.requestRender();
  }

  function startConversation() {
    const { player, busy } = api.state();
    if (!site || distance(player, site.tansy) > TALK_RADIUS || busy || !api.canTalk() || dialog.open) return false;
    dialog.show();
    if (saving && showingClue) showClue();
    else showGreeting();
    return true;
  }
  talk.addEventListener('click', startConversation);
  ask.addEventListener('click', showAnswer);
  road.addEventListener('click', showClue);
  orchard?.addEventListener('click', showOrchard);
  mapOrchard?.addEventListener('click', () => {
    if (mapOrchard.hidden || !['ready', 'mapped'].includes(api.orchardStatus())) return;
    dialog.close();
    api.surveyOrchard();
  });
  back.addEventListener('click', showGreeting);
  leave.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
    }
  });
  dialog.addEventListener('close', () => {
    api.focus();
    api.requestRender();
  });
  const dialogSize = new window.ResizeObserver(api.requestRender);
  dialogSize.observe(dialog);
  async function save(action) {
    const acceptingFrame = action === 'accept-frame';
    const savingClue = action === 'remember-amber-clearing';
    if (saving || (savingClue ? memory.amberClearingClue : acceptingFrame ? memory.frameOwned : memory.introduced)) return;
    saving = true;
    accept.disabled = finish.disabled = remember.disabled = back.disabled = true;
    leave.hidden = false;
    leave.textContent = 'Leave';
    leave.focus({ preventScroll: true });
    status.hidden = false;
    status.textContent = savingClue ? 'Saving the clearing…' : acceptingFrame ? 'Saving your frame…' : 'Saving your introduction…';
    try {
      const response = await fetch('/api/v1/forest/traveler', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forestId: memory.forestId, ...(action ? { action } : {}) }),
        signal: window.AbortSignal.timeout(10000)
      });
      const result = await response.json();
      if (!response.ok || (savingClue ? result.amberClearingClue !== true
        : result.introduced !== true || acceptingFrame && result.frameOwned !== true)) {
        throw new Error('Traveler save failed');
      }
      if (savingClue) {
        memory.amberClearingClue = true;
        return;
      }
      memory.introduced = true;
      if (acceptingFrame) {
        memory.frameOwned = true;
        if (dialog.open) {
          line.textContent = '“It’s yours. Try it under Supports at the workshop and see how it looks on your cart.”';
          lookingAt = null;
          accept.hidden = finish.hidden = status.hidden = true;
        }
      } else if (dialog.open) dialog.close();
    } catch {
      status.hidden = false;
      status.textContent = 'Could not confirm the save. Try again, or come back later.';
      if (savingClue) leave.hidden = true;
      else {
        accept.hidden = false;
        finish.hidden = memory.introduced;
        leave.hidden = !memory.introduced;
        leave.textContent = 'Maybe later';
      }
    } finally {
      saving = false;
      accept.disabled = finish.disabled = remember.disabled = back.disabled = false;
      if (dialog.open && savingClue && memory.amberClearingClue) showClue();
      else if (dialog.open && !status.hidden) (savingClue ? remember : acceptingFrame ? accept : finish).focus({ preventScroll: true });
      api.requestRender();
    }
  }
  accept.addEventListener('click', () => save('accept-frame'));
  finish.addEventListener('click', () => save());
  remember.addEventListener('click', () => save('remember-amber-clearing'));

  return {
    update,
    startConversation,
    blocksMovement: (to, from) => travelerBlocksMovement(site, to, from),
    open: () => dialog.open,
    close: () => { if (dialog.open) dialog.close(); },
    frameConversation(camera, player) {
      if (!dialog.open) return camera;
      const { tansy, cart } = site;
      // Fit the player and both subjects into the scene above the dialogue, including the cart's roof.
      const left = Math.min(player.worldX - 12, tansy.worldX - 12, cart.worldX - 36);
      const right = Math.max(player.worldX + 12, tansy.worldX + 12, cart.worldX + 65);
      const top = Math.min(player.worldY - 45, tansy.worldY - 45, cart.worldY - 85);
      const bottom = Math.max(player.worldY + 8, tansy.worldY + 8, cart.worldY + 30);
      return { ...camera, x: Math.round((left + right - camera.width) / 2),
        y: Math.round((top + bottom - (camera.height - dialog.offsetHeight - 10)) / 2) };
    },
    depthItems(camera) {
      if (!site) return [];
      const { tansy, cart } = site;
      if (tansy.worldX < camera.x - 130 || tansy.worldX > camera.x + camera.width + 130
        || tansy.worldY < camera.y - 100 || tansy.worldY > camera.y + camera.height + 100) return [];
      return [{ kind: 'traveler', id: 'tansy-rook', worldY: tansy.worldY, type: 'tansy' },
        ...studyCartDepthItems(cart).map(item => ({ ...item, kind: 'traveler', id: `tansy-${item.id}` }))];
    },
    paint(ctx, item, camera, reducedMotion) {
      const { tansy, cart } = site;
      if (item.type === 'tansy') {
        const { player } = api.state();
        const nearby = distance(player, tansy) <= TALK_RADIUS;
        const facing = dialog.open && lookingAt ? lookingAt : player;
        const motion = nearby ? { ...idleMotion,
          facingRadians: Math.atan2(facing.worldY - tansy.worldY, facing.worldX - tansy.worldX) } : idleMotion;
        paintForestHumanoid(ctx, Math.round(tansy.worldX - camera.x), Math.round(tansy.worldY - camera.y),
          { profile: FOREST_HUMANOID_PROFILES.visitor, motion, reducedMotion, resting: true });
      } else if (item.type === 'cart-support') {
        paintStudyCartSupport(ctx, item, camera);
      } else {
        paintStudyCart(ctx, cart, camera, false, 0, { detached: true, wheel: 0 },
          item.type === 'cart-roof' ? 'roof' : 'body');
      }
    }
  };
}
