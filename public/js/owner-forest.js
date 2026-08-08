import {
  focusedForestPlacement,
  forestTouchGestureIntent,
  forestFoliageMotionGroupDisplacement,
  forestPlacementWindParameters,
  normalizedMovement,
  touchMovement,
  visibleForestPlacements
} from './forest-scene-math.js';
import {
  advanceForestHumanoidMotion,
  createForestHumanoidMotion,
  FOREST_HUMANOID_PROFILES,
  paintForestHumanoid
} from './forest-humanoid.js';
import { sampleOwnerForestEnvironment } from './owner-forest-environment.js';
import {
  decodeOwnerForestRaster,
  moveOwnerForestPlayer,
  OWNER_FOREST_COORDINATE_LIMIT,
  ownerForestAssetBatches,
  ownerForestCamera,
  ownerForestCellId,
  ownerForestCellsAround,
  ownerForestJoystickOffset,
  ownerForestMovementDirection,
  ownerForestPlacementAtPoint
} from './owner-forest-scene.js';

const payload = document.getElementById('owner-forest-bootstrap');
const copyPayload = document.getElementById('owner-forest-copy');
const viewport = document.querySelector('[data-owner-forest-viewport]');
const canvas = document.querySelector('[data-owner-forest-canvas]');

if (payload && copyPayload && viewport && canvas) {
  const bootstrap = JSON.parse(payload.textContent);
  const copy = JSON.parse(copyPayload.textContent);
  const context = canvas.getContext('2d');
  const placementsById = new Map();
  const assetsByKey = new Map();
  const spritesByKey = new Map();
  const loadedCells = new Set();
  const pendingCells = new Set();
  const groundSamples = new Map();
  const keys = { left: false, right: false, up: false, down: false };
  const pointer = {
    id: null,
    type: null,
    originX: 0,
    originY: 0,
    x: 0,
    y: 0,
    maximumDistance: 0
  };
  const camera = { x: 0, y: 0, width: 0, height: 0 };
  let player = { ...bootstrap.spawn };
  let playerMotion = createForestHumanoidMotion('down');
  let focusedTree = null;
  let frame = null;
  let lastTime = null;
  let loading = false;
  let loadFailure = false;
  let inspectedTreeId = null;
  let inspectionRequest = 0;
  let translationCursor = null;
  let translationsLoading = false;
  const translationPaths = new Set();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const status = document.querySelector('[data-owner-forest-status]');
  const joystick = document.querySelector('[data-owner-forest-joystick]');
  const joystickStick = document.querySelector('[data-owner-forest-joystick-stick]');
  const nearby = document.querySelector('[data-owner-forest-nearby]');
  const inspectButton = document.querySelector('[data-owner-forest-inspect]');
  const reset = document.querySelector('[data-owner-forest-reset]');
  const inspection = document.querySelector('[data-owner-forest-inspection]');
  const inspectionBackdrop = document.querySelector('[data-owner-forest-inspection-backdrop]');
  const inspectionClose = document.querySelector('[data-owner-forest-inspection-close]');
  const inspectionStatus = document.querySelector('[data-owner-forest-inspection-status]');
  const inspectionContent = document.querySelector('[data-owner-forest-inspection-content]');
  const inspectionTitle = document.querySelector('[data-owner-forest-inspection-title]');
  const inspectionSpecies = document.querySelector('[data-owner-forest-inspection-species]');
  const inspectionDate = document.querySelector('[data-owner-forest-inspection-date]');
  const inspectionLanguage = document.querySelector('[data-owner-forest-inspection-language]');
  const inspectionLink = document.querySelector('[data-owner-forest-inspection-link]');
  const translationsWrap = document.querySelector('[data-owner-forest-translations-wrap]');
  const translationsList = document.querySelector('[data-owner-forest-translations]');
  const translationsMore = document.querySelector('[data-owner-forest-translations-more]');

  function cellQuery(cells) {
    return cells.map(ownerForestCellId).join(',');
  }

  function setStatus(message, failed = false) {
    status.textContent = message;
    status.dataset.failed = failed ? 'true' : 'false';
  }

  function clearPointer() {
    pointer.id = null;
    pointer.type = null;
    pointer.x = 0;
    pointer.y = 0;
    pointer.maximumDistance = 0;
    joystick.hidden = true;
    joystickStick.style.transform = '';
  }

  function updatePointer(event) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const deltaX = pointer.x - pointer.originX;
    const deltaY = pointer.y - pointer.originY;
    pointer.maximumDistance = Math.max(
      pointer.maximumDistance,
      Math.hypot(deltaX, deltaY)
    );
    if (pointer.type !== 'mouse') {
      const offset = ownerForestJoystickOffset(deltaX, deltaY);
      joystickStick.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
    }
  }

  function localizedPath(path) {
    const base = String(document.body.dataset.uiBase || '').replace(/\/$/, '');
    return `${base}${path}` || path;
  }

  function languageName(lang) {
    try {
      return new Intl.DisplayNames([document.documentElement.lang || 'en'], {
        type: 'language'
      }).of(lang) || lang;
    } catch {
      return lang;
    }
  }

  function setInspectionStatus(message) {
    inspectionStatus.textContent = message;
    inspectionStatus.hidden = !message;
  }

  function closeInspection({ restoreFocus = true } = {}) {
    inspectedTreeId = null;
    inspectionRequest += 1;
    translationCursor = null;
    translationsLoading = false;
    translationPaths.clear();
    inspection.hidden = true;
    inspectionBackdrop.hidden = true;
    viewport.dataset.inspecting = 'false';
    updateFocus();
    resize();
    requestRender();
    if (restoreFocus) viewport.focus({ preventScroll: true });
  }

  function resetTranslations() {
    translationPaths.clear();
    translationsList.replaceChildren();
    translationsWrap.hidden = true;
    translationsMore.hidden = true;
  }

  function appendTranslations(translations) {
    for (const item of translations) {
      if (translationPaths.has(item.path)) continue;
      translationPaths.add(item.path);
      const entry = document.createElement('li');
      const link = document.createElement('a');
      link.href = localizedPath(item.path);
      link.textContent = `${languageName(item.lang)} — ${item.title}`;
      entry.append(link);
      translationsList.append(entry);
    }
  }

  async function requestInspection(placement, { append = false } = {}) {
    const treeId = placement.id;
    if (!append) {
      inspectedTreeId = treeId;
      inspectionRequest += 1;
      translationCursor = null;
      Object.keys(keys).forEach((key) => { keys[key] = false; });
      clearPointer();
      resetTranslations();
      inspection.hidden = false;
      inspectionBackdrop.hidden = false;
      viewport.dataset.inspecting = 'true';
      nearby.hidden = true;
      inspectionContent.hidden = true;
      setInspectionStatus(copy.inspectionLoading);
      resize();
      inspectionClose.focus({ preventScroll: true });
    } else if (translationsLoading || treeId !== inspectedTreeId || !translationCursor) {
      return;
    }
    const requestId = inspectionRequest;
    translationsLoading = true;
    translationsMore.disabled = true;
    try {
      const query = new URLSearchParams();
      if (append) query.set('cursor', translationCursor);
      const suffix = query.size ? `?${query}` : '';
      const path = `${bootstrap.delivery.inspectionPath}/${encodeURIComponent(treeId)}/inspection`;
      const response = await window.fetch(`${path}${suffix}`);
      if (!response.ok) throw new Error('inspection request failed');
      const result = await response.json();
      if (requestId !== inspectionRequest || treeId !== inspectedTreeId) return;
      if (result.status === 'reconciling') {
        inspectionContent.hidden = true;
        setInspectionStatus(copy.inspectionReconciling);
        return;
      }
      if (result.status !== 'ready' || result.tree?.id !== treeId || !result.writing) {
        throw new Error('inspection unavailable');
      }
      if (!append) {
        inspectionTitle.textContent = result.writing.title;
        const treeType = copy.treeTypes[result.tree.phenotypeId] || copy.unknownTreeType;
        const season = copy.seasons[result.tree.creationSeason] || copy.seasons.unknown;
        inspectionSpecies.textContent = `${treeType}, ${season}`;
        inspectionDate.dateTime = result.writing.createdAt;
        inspectionDate.textContent = new Intl.DateTimeFormat(
          document.documentElement.lang || 'en', { dateStyle: 'medium' }
        ).format(new Date(result.writing.createdAt));
        inspectionLanguage.textContent = languageName(result.writing.lang);
        inspectionLink.href = localizedPath(result.writing.path);
        inspectionContent.hidden = false;
        setInspectionStatus('');
      }
      appendTranslations(result.translations || []);
      translationCursor = result.page?.nextCursor || null;
      translationsWrap.hidden = translationPaths.size === 0 && !translationCursor;
      translationsMore.hidden = !translationCursor;
    } catch {
      if (requestId === inspectionRequest && treeId === inspectedTreeId) {
        if (!append) inspectionContent.hidden = true;
        setInspectionStatus(copy.inspectionUnavailable);
      }
    } finally {
      if (requestId === inspectionRequest) {
        translationsLoading = false;
        translationsMore.disabled = false;
      }
    }
  }

  function rasterSource(layer) {
    const binary = window.atob(layer.data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: layer.mediaType });
  }

  async function prepareLayer(layer, dimensions) {
    if (layer.runs) {
      const sprite = document.createElement('canvas');
      sprite.width = dimensions.width;
      sprite.height = dimensions.height;
      const spriteContext = sprite.getContext('2d');
      for (const run of layer.runs) {
        spriteContext.fillStyle = run.color;
        spriteContext.fillRect(run.x, run.y, run.width, 1);
      }
      return sprite;
    }
    const source = rasterSource(layer);
    return decodeOwnerForestRaster(source);
  }

  async function prepareAsset(asset) {
    if (spritesByKey.has(asset.cacheKey)) return;
    const layers = [];
    for (const layer of asset.layers) {
      if (layer.motionGroups) {
        const groups = [];
        for (const group of layer.motionGroups) {
          groups.push({ ...group, sprite: await prepareLayer(group, asset.dimensions) });
        }
        layers.push({ id: layer.id, motionGroups: groups });
      } else {
        layers.push({ id: layer.id, sprite: await prepareLayer(layer, asset.dimensions) });
      }
    }
    assetsByKey.set(asset.cacheKey, asset);
    spritesByKey.set(asset.cacheKey, layers);
  }

  async function requestAssets(cells, cursor, assetKeys) {
    const missing = assetKeys.filter(key => !spritesByKey.has(key));
    for (const batch of ownerForestAssetBatches(missing, bootstrap.delivery.assetBatchSize)) {
      const query = new URLSearchParams({
        cells: cellQuery(cells),
        assetKeys: batch.join(','),
        transport: bootstrap.delivery.transport
      });
      if (cursor) query.set('cursor', cursor);
      const response = await window.fetch(`${bootstrap.delivery.assetPath}?${query}`);
      if (!response.ok) throw new Error('asset request failed');
      const delivery = await response.json();
      if (delivery.status !== 'ready') throw new Error('asset delivery not ready');
      for (const asset of delivery.assets) {
        await prepareAsset(asset);
        await new Promise(resolve => window.setTimeout(resolve, 0));
      }
    }
  }

  async function requestCells(cells) {
    let cursor = null;
    do {
      const pageCursor = cursor;
      const query = new URLSearchParams({
        cells: cellQuery(cells),
        limit: String(bootstrap.delivery.placementPageSize)
      });
      if (pageCursor) query.set('cursor', pageCursor);
      const response = await window.fetch(`${bootstrap.delivery.regionPath}?${query}`);
      if (!response.ok) throw new Error('region request failed');
      const manifest = await response.json();
      if (manifest.status !== 'ready') throw new Error('region not ready');
      manifest.placements.forEach(placement => placementsById.set(placement.id, placement));
      await requestAssets(cells, pageCursor, manifest.placements.map(item => item.assetKey));
      cursor = manifest.page.nextCursor;
    } while (cursor);
  }

  async function loadNearbyCells() {
    if (loading) return;
    const cells = ownerForestCellsAround(player, bootstrap.spatialIndex.cellSize);
    const missing = cells.filter(cell => !loadedCells.has(ownerForestCellId(cell))
      && !pendingCells.has(ownerForestCellId(cell)));
    if (!missing.length) return;
    loading = true;
    missing.forEach(cell => pendingCells.add(ownerForestCellId(cell)));
    setStatus('Growing the nearby grove…');
    try {
      await requestCells(missing);
      missing.forEach(cell => loadedCells.add(ownerForestCellId(cell)));
      loadFailure = false;
      setStatus(`${placementsById.size} writing trees discovered nearby.`);
      updateFocus();
      requestRender();
    } catch (error) {
      loadFailure = true;
      console.error('Owner forest nearby load failed:', error?.name || 'Error');
      setStatus('The nearby grove could not be loaded. Move or reload to try again.', true);
    } finally {
      missing.forEach(cell => pendingCells.delete(ownerForestCellId(cell)));
      loading = false;
    }
  }

  function groundSample(column, row) {
    const id = `${column}:${row}`;
    if (!groundSamples.has(id)) {
      groundSamples.set(id, sampleOwnerForestEnvironment({
        worldSeed: bootstrap.environment.seed,
        worldX: Math.max(-OWNER_FOREST_COORDINATE_LIMIT, Math.min(
          OWNER_FOREST_COORDINATE_LIMIT, column * 64
        )),
        worldY: Math.max(-OWNER_FOREST_COORDINATE_LIMIT, Math.min(
          OWNER_FOREST_COORDINATE_LIMIT, row * 64
        ))
      }));
    }
    return groundSamples.get(id);
  }

  function paintGround() {
    const cell = 64;
    const firstX = Math.floor(camera.x / cell);
    const lastX = Math.ceil((camera.x + camera.width) / cell);
    const firstY = Math.floor(camera.y / cell);
    const lastY = Math.ceil((camera.y + camera.height) / cell);
    for (let row = firstY; row <= lastY; row += 1) {
      for (let column = firstX; column <= lastX; column += 1) {
        const sample = groundSample(column, row);
        const rocky = sample.rockinessPermille / 1000;
        const red = Math.round(91 + (rocky * 22));
        const green = Math.round(126 - (rocky * 16));
        const blue = Math.round(76 + (rocky * 2));
        context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        context.fillRect((column * cell) - camera.x, (row * cell) - camera.y, cell + 1, cell + 1);
        if ((column + row) % 3 === 0) {
          context.fillStyle = rocky > 0.56 ? 'rgba(112, 111, 94, 0.34)'
            : 'rgba(180, 171, 102, 0.18)';
          context.fillRect((column * cell) - camera.x + 18,
            (row * cell) - camera.y + 24, rocky > 0.56 ? 9 : 5, 2);
        }
      }
    }
  }

  function paintTree(placement, elapsed) {
    const asset = assetsByKey.get(placement.assetKey);
    const sprites = spritesByKey.get(placement.assetKey);
    if (!asset || !sprites) return;
    const x = Math.round(placement.worldX - camera.x - (asset.anchor.x * placement.scale));
    const y = Math.round(placement.worldY - camera.y - (asset.anchor.y * placement.scale));
    if (focusedTree?.id === placement.id) {
      context.fillStyle = 'rgba(255, 239, 164, 0.38)';
      context.beginPath();
      context.ellipse(placement.worldX - camera.x, placement.worldY - camera.y,
        placement.collisionRadius + 10, 8, 0, 0, Math.PI * 2);
      context.fill();
    }
    const wind = forestPlacementWindParameters(placement);
    for (const layer of sprites) {
      if (layer.motionGroups) {
        for (const group of layer.motionGroups) {
          const offset = forestFoliageMotionGroupDisplacement(
            wind, group, elapsed, !reducedMotion.matches
          );
          context.drawImage(group.sprite, x + offset, y,
            asset.dimensions.width * placement.scale, asset.dimensions.height * placement.scale);
        }
      } else {
        context.drawImage(layer.sprite, x, y,
          asset.dimensions.width * placement.scale, asset.dimensions.height * placement.scale);
      }
    }
  }

  function updateFocus() {
    focusedTree = focusedForestPlacement(player, [...placementsById.values()].filter(
      placement => assetsByKey.has(placement.assetKey)
    ), bootstrap.spawn.interactionRadius);
    nearby.hidden = !focusedTree || Boolean(inspectedTreeId);
  }

  function render(time = window.performance.now()) {
    frame = null;
    context.imageSmoothingEnabled = false;
    paintGround();
    const placements = [...placementsById.values()];
    const visible = visibleForestPlacements(placements, assetsByKey, camera, 32);
    const depth = [...visible.map(placement => ({ placement, worldY: placement.worldY })),
      { player: true, worldY: player.worldY }].sort((a, b) => a.worldY - b.worldY);
    for (const item of depth) {
      if (item.player) {
        paintForestHumanoid(context, Math.round(player.worldX - camera.x),
          Math.round(player.worldY - camera.y), {
            profile: FOREST_HUMANOID_PROFILES.player,
            motion: playerMotion,
            reducedMotion: reducedMotion.matches
          });
      } else paintTree(item.placement, time / 1000);
    }
  }

  function requestRender() {
    if (!frame) frame = window.requestAnimationFrame(render);
  }

  function resize() {
    const bounds = viewport.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(bounds.width * ratio));
    canvas.height = Math.max(1, Math.round(bounds.height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    camera.width = Math.round(bounds.width);
    camera.height = Math.round(bounds.height);
    Object.assign(camera, ownerForestCamera(player, camera));
    requestRender();
  }

  function tick(time) {
    const elapsed = lastTime === null ? 0 : Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;
    const keyboardDirection = normalizedMovement(keys);
    const pointerDirection = pointer.id === null ? { x: 0, y: 0 } : touchMovement(
      pointer.x - pointer.originX,
      pointer.y - pointer.originY
    );
    const direction = ownerForestMovementDirection({
      inspectionOpen: Boolean(inspectedTreeId),
      keyboardDirection,
      pointerDirection
    });
    if (direction.x || direction.y) {
      const before = player;
      player = moveOwnerForestPlayer(player, direction, elapsed, [...placementsById.values()]);
      playerMotion = advanceForestHumanoidMotion(playerMotion, {
        from: before, to: player, direction, elapsedSeconds: elapsed,
        reducedMotion: reducedMotion.matches
      });
      Object.assign(camera, ownerForestCamera(player, camera));
      updateFocus();
      loadNearbyCells();
    } else {
      playerMotion = advanceForestHumanoidMotion(playerMotion, {
        from: player, to: player, elapsedSeconds: elapsed,
        reducedMotion: reducedMotion.matches
      });
    }
    if (direction.x || direction.y || (!reducedMotion.matches && !document.hidden)) render(time);
    window.requestAnimationFrame(tick);
  }

  const keyFor = key => ({ ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right',
    d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down',
    s: 'down', S: 'down' })[key];
  viewport.addEventListener('keydown', (event) => {
    if (event.target !== viewport) return;
    if (['Enter', ' ', 'e', 'E'].includes(event.key) && focusedTree) {
      requestInspection(focusedTree);
      event.preventDefault();
      return;
    }
    if (event.key === 'Escape' && inspectedTreeId) {
      closeInspection();
      event.preventDefault();
      return;
    }
    const key = keyFor(event.key);
    if (key) { keys[key] = true; event.preventDefault(); }
  });
  viewport.addEventListener('keyup', (event) => {
    const key = keyFor(event.key);
    if (key) { keys[key] = false; event.preventDefault(); }
  });
  viewport.addEventListener('blur', () => {
    Object.keys(keys).forEach(key => { keys[key] = false; });
    clearPointer();
  });
  viewport.addEventListener('pointerdown', (event) => {
    if (pointer.id !== null
      || inspectedTreeId
      || (event.target !== canvas && event.target !== viewport)) return;
    viewport.focus({ preventScroll: true });
    pointer.id = event.pointerId;
    pointer.type = event.pointerType;
    pointer.originX = event.clientX;
    pointer.originY = event.clientY;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.maximumDistance = 0;
    if (event.pointerType !== 'mouse') {
      const bounds = viewport.getBoundingClientRect();
      joystick.style.left = `${event.clientX - bounds.left}px`;
      joystick.style.top = `${event.clientY - bounds.top}px`;
      joystick.hidden = false;
    }
    viewport.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  viewport.addEventListener('pointermove', (event) => {
    if (pointer.id !== event.pointerId) return;
    updatePointer(event);
    event.preventDefault();
  });
  const stopPointer = (event) => {
    if (pointer.id !== event.pointerId) return;
    updatePointer(event);
    const wasTap = forestTouchGestureIntent(pointer.maximumDistance) === 'tap';
    clearPointer();
    if (wasTap) {
      const bounds = viewport.getBoundingClientRect();
      const selected = ownerForestPlacementAtPoint({
        point: {
          worldX: event.clientX - bounds.left + camera.x,
          worldY: event.clientY - bounds.top + camera.y
        },
        player,
        placements: [...placementsById.values()],
        assetsByKey,
        interactionRadius: bootstrap.spawn.interactionRadius
      });
      if (selected) {
        focusedTree = selected;
        nearby.hidden = false;
        requestInspection(selected);
        requestRender();
      }
    }
    event.preventDefault();
  };
  viewport.addEventListener('pointerup', stopPointer);
  viewport.addEventListener('pointercancel', (event) => {
    if (pointer.id !== event.pointerId) return;
    clearPointer();
    event.preventDefault();
  });
  inspectButton.addEventListener('click', () => {
    if (focusedTree) requestInspection(focusedTree);
  });
  inspectionClose.addEventListener('click', () => closeInspection());
  inspectionBackdrop.addEventListener('click', () => closeInspection());
  inspection.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeInspection();
    event.preventDefault();
  });
  translationsMore.addEventListener('click', () => {
    const placement = placementsById.get(inspectedTreeId);
    if (placement) requestInspection(placement, { append: true });
  });
  reset.addEventListener('click', () => {
    clearPointer();
    player = { ...bootstrap.spawn };
    playerMotion = createForestHumanoidMotion('down');
    Object.assign(camera, ownerForestCamera(player, camera));
    updateFocus();
    loadNearbyCells();
    viewport.focus();
  });
  window.addEventListener('resize', resize);
  window.addEventListener('blur', clearPointer);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearPointer();
  });
  reducedMotion.addEventListener?.('change', requestRender);

  resize();
  loadNearbyCells();
  window.requestAnimationFrame(tick);
  if (loadFailure) setStatus('The forest could not be loaded.', true);
}
