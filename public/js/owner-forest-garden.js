import { gardenIntersects, WILD_LANTERNBELL } from './forest-garden-rules.js';
import { ownerForestMarkerPreview, createOwnerForestMarkerObjectId } from './owner-forest-scene.js';
import { paintLanternbell, paintLanternbellCutting } from './forest-lanternbell.js';
const messages = {
  GARDEN_CONFLICT: 'Your garden changed in another tab. Refresh before choosing again.',
  GARDEN_SATCHEL_FULL: 'Your eight cutting spaces are full. Plant one before harvesting or packing up.',
  GARDEN_FULL: 'All 24 planting spaces are in use. Pack up a plant to free a space.',
  GARDEN_COLLISION: 'Choose a little more space from trees, markers, plants, water, bridges or rocks.',
  GARDEN_GROWING: 'This lanternbell is still growing. It will wait safely for you.',
  GARDEN_TERRAIN_CHANGED: 'Terrain changed. Reload the forest before gardening.',
  GARDEN_MIGRATION_REQUIRED: 'This garden needs a newer reader. Your saved plants are preserved.'
};
export function createOwnerForestGarden({ terrainToken, state, terrain, requestRender, focusViewport }) {
  const root = document.querySelector('[data-forest-garden]');
  if (!root) return { update() {}, depthItems: () => [], paint() {}, intersects: () => false };
  const find = name => document.querySelector(`[data-garden-${name}]`);
  const open = find('open'), toolbar = find('toolbar');
  function panel(visible) {
    root.hidden = !visible; open.setAttribute('aria-expanded', String(visible));
    if (visible) {
      carrying = false; collected = null; requestRender();
      if (!stale && data) status.textContent = data.plants.length >= 24 ? 'Garden full · pack up a plant to free a space.'
        : data.cuttings ? 'Ready to plant.' : 'Collect a cutting from a lanternbell.';
      find('close').focus({ preventScroll: true });
    }
    else focusViewport();
    update(performance.now(), true);
  }
  open.addEventListener('click', () => panel(root.hidden));
  find('close').addEventListener('click', () => panel(false));
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { panel(false); event.preventDefault(); event.stopPropagation(); }
  });
  const status = find('status'), count = find('count'), list = find('plants');
  const quickPlant = find('plant');
  const acquire = find('acquire'), start = find('start'), save = find('save'), cancel = find('cancel');
  const refresh = find('refresh'), previewCopy = find('preview'), guide = find('guide');
  const near = find('near'), harvest = find('harvest'), move = find('move'), lift = find('lift');
  const confirm = find('confirm'), confirmLift = find('confirm-lift'), keep = find('keep');
  let data = null, busy = false, stale = true, preview = null, mode = null, selected = null;
  let carrying = false;
  let nearby = null, collected = null, guideId = null, lastUpdate = 0, lastRead = 0, pending = null;
  const notice = find('notice');
  const navigation = find('navigation'), navigationCopy = find('navigation-copy');
  const navigationArrow = find('navigation-arrow');
  find('navigation-stop')?.addEventListener('click', () => {
    guideId = null; update(performance.now(), true); focusViewport();
  });
  let noticeUntil = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cuttingCanvas = find('cutting');
  paintLanternbellCutting(cuttingCanvas.getContext('2d'), 20, 32, 2);
  const say = (message, showNotice = true) => {
    status.textContent = message;
    if (showNotice) {
      notice.textContent = message; notice.hidden = false;
      noticeUntil = stale ? Infinity : performance.now() + 4500;
    }
  };
  const distance = (a, b) => Math.hypot(a.worldX - b.worldX, a.worldY - b.worldY);
  function direction(target, player) {
    const angle = Math.atan2(target.worldY - player.worldY, target.worldX - player.worldX);
    const names = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'];
    return `${Math.round(distance(target, player))} steps ${names[(Math.round(angle / (Math.PI / 4)) + 8) % 8]}`;
  }
  function rebuild() {
    count.textContent = `${data.cuttings} / 8 cuttings · ${data.plants.length} / 24 planted`;
    cuttingCanvas.dataset.empty = String(data.cuttings === 0);
    open.textContent = `Satchel · ${data.cuttings}`;
    const focusedId = list.contains(document.activeElement) ? document.activeElement.dataset.plantId : null;
    list.replaceChildren();
    data.plants.forEach((p, index) => {
      const li = document.createElement('li');
      const button = document.createElement('button'); button.type = 'button';
      button.dataset.plantId = p.plantId;
      button.textContent = `Lanternbell ${index + 1} · ${p.stage}${p.ready ? ' · cutting ready' : ''} — guide me`;
      button.addEventListener('click', () => { guideId = p.plantId; panel(false); update(performance.now(), true); focusViewport(); });
      li.append(button); list.append(li);
      if (focusedId === p.plantId) button.focus({ preventScroll: true });
    });
    requestRender(); update(performance.now(), true);
  }
  async function read() {
    if (busy) return;
    busy = true; update(performance.now(), true);
    try {
      const response = await fetch('/api/v1/forest/garden', { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || result.version !== 1) throw new Error(result.code);
      data = result; stale = false; pending = null;
      notice.textContent = ''; noticeUntil = 0;
      if (!data.cuttings) carrying = false;
      rebuild();
      say(data.acquired ? 'Garden saved.' : 'Find a cutting on the wild lanternbell.', false);
    } catch { stale = true; say('Garden unavailable. Your saved work is preserved. Refresh to try again.'); }
    finally { busy = false; lastRead = performance.now(); update(performance.now(), true); }
  }
  async function command(action, extra = {}) {
    if (busy || stale || !data) return;
    // Retain the exact command through an uncertain response. Refresh resolves durable state.
    pending ||= { action, expectedRevision: data.revision, terrainToken, ...extra };
    const source = action === 'acquire' ? WILD_LANTERNBELL : data.plants.find(p => p.plantId === extra.plantId);
    busy = true; say('Saving…'); update(performance.now(), true);
    try {
      const response = await fetch('/api/v1/forest/garden', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.code || 'GARDEN_UNAVAILABLE');
      data = result; pending = null; mode = null; preview = null; confirm.hidden = true;
      carrying = ['acquire', 'harvest'].includes(action);
      collected = source && ['acquire', 'harvest', 'lift'].includes(action)
        ? { source: { ...source }, destination: action === 'lift' ? 'satchel' : 'hand', startedAt: performance.now() } : null;
      rebuild(); say(action === 'acquire' ? 'Cutting collected · +1'
        : action === 'harvest' ? 'Cutting collected · +1'
          : action === 'lift' ? 'Plant packed up · one cutting in your satchel.'
            : action === 'move' ? 'Plant moved · growth preserved.'
              : 'Cutting planted · flowers in 20 minutes.');
      focusViewport();
    } catch (error) {
      stale = true; mode = null; preview = null; carrying = false; collected = null;
      say(messages[error.message] || 'The save could not be confirmed. Refresh to see what reached your garden before trying again.');
    } finally { busy = false; update(performance.now(), true); requestRender(); }
  }
  function begin(plant = null) {
    if (!data || busy || stale) return;
    mode = plant ? 'move' : 'plant'; selected = plant; confirm.hidden = true;
    carrying = !plant; collected = null;
    panel(false);
    say(plant ? 'Choose a spot for this lanternbell.' : 'Choose a home for your cutting.', false); focusViewport(); update(performance.now(), true); requestRender();
  }
  function stop() { mode = null; preview = null; carrying = false; say('Placement cancelled.'); focusViewport(); requestRender(); update(performance.now(), true); }
  acquire.addEventListener('click', () => command('acquire'));
  start.addEventListener('click', () => begin());
  quickPlant.addEventListener('click', () => { if (!start.disabled) begin(); });
  refresh.addEventListener('click', read);
  save.addEventListener('click', () => {
    if (!preview?.valid) return;
    command(mode, { plantId: selected?.plantId || createOwnerForestMarkerObjectId(),
      worldX: preview.worldX, worldY: preview.worldY });
  });
  cancel.addEventListener('click', stop);
  harvest.addEventListener('click', () => nearby && command('harvest', { plantId: nearby.plantId }));
  move.addEventListener('click', () => nearby && begin(nearby));
  lift.addEventListener('click', () => { selected = nearby; confirm.hidden = false; find('near-actions').hidden = true; confirmLift.focus(); });
  keep.addEventListener('click', () => { confirm.hidden = true; find('near-actions').hidden = false; lift.focus(); });
  confirmLift.addEventListener('click', () => selected && command('lift', { plantId: selected.plantId }));
  const viewport = document.querySelector('[data-owner-forest-viewport]');
  function interact() {
    if (!nearby || busy || stale || !state().available) return;
    if (nearby.wild && !data.acquired) acquire.click();
    else if (!nearby.wild && nearby.ready) harvest.click();
    else say(find('near-copy').textContent);
  }
  let tap = null;
  viewport.addEventListener('pointerdown', event => {
    tap = event.target.tagName === 'CANVAS' || event.target === viewport
      ? { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 } : null;
  });
  viewport.addEventListener('pointermove', event => {
    if (tap?.id === event.pointerId) tap.moved = Math.max(tap.moved, Math.hypot(event.clientX - tap.x, event.clientY - tap.y));
  });
  viewport.addEventListener('pointercancel', () => { tap = null; });
  viewport.addEventListener('pointerup', event => {
    const isTap = tap?.id === event.pointerId && tap.moved < 8; tap = null;
    if (!isTap) return;
    if (event.target !== viewport && event.target.tagName !== 'CANVAS' || mode || !nearby) return;
    const bounds = viewport.getBoundingClientRect(), { player } = state();
    const point = { worldX: player.worldX + event.clientX - bounds.left - bounds.width / 2,
      worldY: player.worldY + event.clientY - bounds.top - bounds.height / 2 };
    if (distance(point, nearby) < 25) interact();
  });
  viewport.addEventListener('keydown', event => {
    if (event.target !== viewport) return;
    if (!mode && event.key === 'Escape' && carrying) {
      carrying = false; collected = null; say('Cutting put away.'); requestRender();
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (!mode && ['p', 'P'].includes(event.key) && !start.disabled) {
      begin(); event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (!root.hidden && event.key === 'Escape') { panel(false); event.preventDefault(); return; }
    if (!mode && nearby && state().available && ['e', 'E', 'Enter', ' '].includes(event.key)) {
      interact(); event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (!mode) return;
    if (event.key === 'Escape') { stop(); event.preventDefault(); event.stopImmediatePropagation(); }
    if (['Enter', ' '].includes(event.key)) { save.click(); event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  function update(time, force = false) {
    if (!force && time - lastUpdate < 150) return;
    lastUpdate = time;
    const { player, placements, markers, facingRadians, available } = state();
    if (mode && !available) { mode = null; preview = null; carrying = false; }
    if (mode) {
      preview = ownerForestMarkerPreview({ player, facingRadians, placements, markers, cellSize: 720 });
      let reason = preview.reason;
      if (!terrain.ready(preview)) reason = 'terrain-loading';
      else {
        const surface = terrain.sample({ ...preview, radius: 17 });
        if (!surface.placeable) reason = 'terrain-collision';
      }
      if (gardenIntersects(data.plants, preview.worldX, preview.worldY, 9, selected?.plantId)) reason = 'plant-collision';
      preview.valid = !reason;
      const text = busy ? mode === 'move' ? 'Moving…' : 'Planting…' : reason ? 'Needs more space. Try another spot.'
        : mode === 'move' ? 'Move here?' : 'Room to grow. Plant here?';
      if (previewCopy.textContent !== text) previewCopy.textContent = text;
    }
    const wild = { ...WILD_LANTERNBELL, plantId: '~wild-lanternbell', wild: true };
    const candidates = [...(data?.plants || []), wild].filter(p => distance(p, player) <= 64);
    // A collected wild shrub remains inspectable, but give nearby garden plants priority.
    nearby = candidates.sort((a, b) => (data?.acquired ? Number(a.wild || false) - Number(b.wild || false) : 0)
      || distance(a, player) - distance(b, player))[0] || null;
    const otherDistance = Math.min(...placements.map(p => distance(p, player)), ...markers.map(p => distance(p, player)));
    if (nearby && otherDistance < distance(nearby, player)) nearby = null;
    const plantId = nearby?.plantId || '';
    const plantChanged = near.dataset.plantId !== plantId;
    near.dataset.plantId = plantId;
    near.hidden = !nearby || Boolean(nearby.wild && data?.acquired) || Boolean(mode) || !root.hidden || !available;
    if (nearby) {
      const minutes = Math.max(1, Math.ceil((new Date(nearby.readyAt) - new Date(data?.serverNow)) / 60000));
      const nearbyText = nearby.wild
        ? data?.acquired ? 'Wild lanternbell · cutting already taken' : 'Wild lanternbell · a cutting to grow your own'
        : nearby.ready ? data?.cuttings >= 8 ? 'Lanternbell · satchel full' : 'Lanternbell · cutting ready' : `${nearby.stage === 'rooted' ? 'New cutting' : 'Lanternbell'} · next cutting in ${minutes < 60 ? `${minutes}m` : `${Math.ceil(minutes / 60)}h`}`;
      if (find('near-copy').textContent !== nearbyText) find('near-copy').textContent = nearbyText;
    }
    acquire.hidden = !nearby?.wild || Boolean(data?.acquired);
    harvest.hidden = Boolean(nearby?.wild) || !nearby?.ready;
    move.hidden = lift.hidden = Boolean(nearby?.wild);
    if (plantChanged) confirm.hidden = true;
    find('near-actions').hidden = !confirm.hidden;
    find('action-help').hidden = !nearby || Boolean(nearby.wild) || !confirm.hidden;
    const target = guideId ? data?.plants.find(p => p.plantId === guideId) : !data?.acquired ? WILD_LANTERNBELL : null;
    guide.textContent = target ? `${guideId ? 'Your lanternbell' : 'Wild lanternbell'}: ${direction(target, player)}.` : '';
    if (navigation) {
      const guiding = guideId && target;
      const label = guiding ? `Lanternbell ${data.plants.findIndex(p => p.plantId === guideId) + 1}` : '';
      const arrived = guiding && nearby?.plantId === guideId && !near.hidden;
      if (arrived) say(`${label} reached.`);
      if (guideId && (!target || arrived)) guideId = null;
      navigation.hidden = !guideId || Boolean(mode) || !root.hidden || !available;
      if (guideId) {
        const text = `${label} · ${direction(target, player)}`;
        if (navigationCopy.textContent !== text) navigationCopy.textContent = text;
        const degrees = Math.atan2(target.worldY - player.worldY, target.worldX - player.worldX) * 180 / Math.PI + 90;
        navigationArrow.style.transform = `rotate(${degrees}deg)`;
      }
    }
    const blocked = busy || stale || !available;
    acquire.disabled = blocked || distance(player, WILD_LANTERNBELL) > 72;
    start.disabled = blocked || !data?.cuttings || data?.plants.length >= 24 || Boolean(mode);
    quickPlant.hidden = !data?.cuttings || Boolean(mode) || !root.hidden;
    quickPlant.disabled = start.disabled;
    toolbar.hidden = !mode;
    open.hidden = Boolean(mode) || !root.hidden;
    viewport.dataset.hudGardenPlacing = String(Boolean(mode));
    viewport.dataset.hudGardenOpen = String(!root.hidden);
    viewport.dataset.hudGardenNearby = String(!near.hidden);
    notice.hidden = Boolean(mode) || !root.hidden || !available || !notice.textContent || time >= noticeUntil;
    save.disabled = blocked || !preview?.valid;
    cancel.disabled = busy;
    harvest.disabled = blocked || !nearby?.ready || data?.cuttings >= 8;
    move.disabled = lift.disabled = blocked;
    confirmLift.disabled = blocked || data?.cuttings >= 8;
    find('lift-copy').textContent = data?.cuttings >= 8 ? 'Satchel full. Plant a cutting before packing up.'
      : 'Pack this plant as one cutting? Planting it again starts growth over.';
    refresh.disabled = busy;
    previewCopy.hidden = !mode;
    if (collected && time - collected.startedAt < 900 && !reducedMotion.matches) requestRender();
    if (time - lastRead > 20000 && !busy && !mode && !stale && document.visibilityState === 'visible') {
      lastRead = time; read();
    }
  }
  read();
  return { update,
    intersects: p => gardenIntersects(data?.plants || [], p.worldX, p.worldY),
    depthItems(camera) {
      const { player } = state();
      const plants = data?.plants || [];
      return [
        { ...WILD_LANTERNBELL, plantId: '~wild-lanternbell', stage: 'flowering', wild: true, spent: Boolean(data?.acquired), focused: nearby?.wild && !near.hidden },
        ...plants.map(p => ({ ...p, focused: p.plantId === nearby?.plantId && !near.hidden })).filter(p => Math.abs(Math.floor(p.worldX / 720) - Math.floor(player.worldX / 720)) <= 1
          && Math.abs(Math.floor(p.worldY / 720) - Math.floor(player.worldY / 720)) <= 1),
        ...(preview ? [{ ...preview, plantId: '~garden-preview', stage: mode === 'move' ? selected.stage : 'flowering',
          ready: mode === 'move' ? selected.ready : true, preserveAppearance: mode === 'move', preview: true }] : [])
      ].filter(p => p.worldX >= camera.x - 40 && p.worldX <= camera.x + camera.width + 40
        && p.worldY >= camera.y - 40 && p.worldY <= camera.y + camera.height + 40)
        .map(p => ({ kind: 'garden', id: p.plantId, plant: p, worldY: p.worldY }))
        .concat(carrying && data?.cuttings > 0 ? [{ kind: 'garden', id: '~carried-cutting', cutting: true,
          worldX: player.worldX + 10, worldY: player.worldY + 2, drawY: player.worldY - 10 }] : [])
        .concat(collected && !reducedMotion.matches && performance.now() - collected.startedAt < 900
          ? (() => { const t = Math.min(1, (performance.now() - collected.startedAt) / 900);
            const target = collected.destination === 'satchel'
              ? { worldX: camera.x + camera.width - 55, worldY: camera.y + 78 }
              : { worldX: player.worldX, worldY: player.worldY - 10 };
            return [{ kind: 'garden', id: '~collected-cutting', cutting: true,
              worldX: collected.source.worldX * (1 - t) + target.worldX * t,
              worldY: player.worldY + 100,
              drawY: collected.source.worldY * (1 - t) + target.worldY * t - Math.sin(t * Math.PI) * 20 }]; })() : []);
    },
    paint: (ctx, item, camera) => item.cutting
      ? paintLanternbellCutting(ctx, item.worldX - camera.x, item.drawY - camera.y)
      : paintLanternbell(ctx, item.plant, camera, item.plant)
  };
}
