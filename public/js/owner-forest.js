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
import {
  FOREST_OWNER_GROUND_PRESENTATION_CONFIG,
  sampleOwnerForestGroundPresentation
} from './owner-forest-environment.js';
import {
  decodeOwnerForestRaster,
  createOwnerForestMarkerObjectId,
  moveOwnerForestPlayer,
  OWNER_FOREST_COORDINATE_LIMIT,
  ownerForestAssetBatches,
  ownerForestCamera,
  ownerForestCellId,
  ownerForestCellsAround,
  ownerForestFocusedMarker,
  ownerForestJoystickOffset,
  ownerForestMarkerAtPoint,
  ownerForestMarkerPreview,
  ownerForestMovementDirection,
  ownerForestPlacementAtPoint,
  replaceOwnerForestAuthoredRegion
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
  const markersById = new Map();
  const assetsByKey = new Map();
  const spritesByKey = new Map();
  const loadedCells = new Set();
  const pendingCells = new Set();
  const loadedAuthoredCells = new Set();
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
  let focusedMarker = null;
  let frame = null;
  let lastTime = null;
  let loading = false;
  let loadFailure = false;
  let authoredLoading = false;
  let authoredState = 'loading';
  let inspectedTreeId = null;
  let inspectedMarkerId = null;
  let inspectionRequest = 0;
  let inspectedTreeRevision = null;
  let translationCursor = null;
  let translationsLoading = false;
  const translationPaths = new Set();
  const placement = {
    active: false,
    mode: null,
    movingObjectId: null,
    preview: null,
    request: null,
    saving: false
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const status = document.querySelector('[data-owner-forest-status]');
  const joystick = document.querySelector('[data-owner-forest-joystick]');
  const joystickStick = document.querySelector('[data-owner-forest-joystick-stick]');
  const nearby = document.querySelector('[data-owner-forest-nearby]');
  const inspectButton = document.querySelector('[data-owner-forest-inspect]');
  const reset = document.querySelector('[data-owner-forest-reset]');
  const placeMarker = document.querySelector('[data-owner-forest-place-marker]');
  const authoredStatus = document.querySelector('[data-owner-forest-authored-status]');
  const authoredStatusCopy = document.querySelector('[data-owner-forest-authored-status-copy]');
  const authoredRetry = document.querySelector('[data-owner-forest-authored-retry]');
  const placementPanel = document.querySelector('[data-owner-forest-placement]');
  const placementStatus = document.querySelector('[data-owner-forest-placement-status]');
  const placementSave = document.querySelector('[data-owner-forest-placement-save]');
  const placementCancel = document.querySelector('[data-owner-forest-placement-cancel]');
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
  const hideTree = document.querySelector('[data-owner-forest-hide-tree]');
  const translationsWrap = document.querySelector('[data-owner-forest-translations-wrap]');
  const translationsList = document.querySelector('[data-owner-forest-translations]');
  const translationsMore = document.querySelector('[data-owner-forest-translations-more]');
  const nearbyCopy = document.querySelector('[data-owner-forest-nearby-copy]');
  const markerInspection = document.querySelector('[data-owner-forest-marker-inspection]');
  const markerClose = document.querySelector('[data-owner-forest-marker-close]');
  const markerStatus = document.querySelector('[data-owner-forest-marker-status]');
  const markerActions = document.querySelector('[data-owner-forest-marker-actions]');
  const markerMove = document.querySelector('[data-owner-forest-marker-move]');
  const markerRemove = document.querySelector('[data-owner-forest-marker-remove]');
  const markerConfirm = document.querySelector('[data-owner-forest-marker-confirm]');
  const markerRemoveConfirm = document.querySelector('[data-owner-forest-marker-remove-confirm]');
  const markerRemoveCancel = document.querySelector('[data-owner-forest-marker-remove-cancel]');

  function cellQuery(cells) {
    return cells.map(ownerForestCellId).join(',');
  }

  function setStatus(message, failed = false) {
    status.textContent = message;
    status.dataset.failed = failed ? 'true' : 'false';
  }

  function currentAuthoredCellsReady() {
    return ownerForestCellsAround(player, bootstrap.spatialIndex.cellSize)
      .every(cell => loadedAuthoredCells.has(ownerForestCellId(cell)));
  }

  function setAuthoredStatus(message, {
    state = 'notice', failed = false, retry = false
  } = {}) {
    authoredState = state;
    authoredStatusCopy.textContent = message;
    authoredStatus.dataset.state = state;
    authoredStatus.dataset.failed = failed ? 'true' : 'false';
    authoredRetry.hidden = !retry;
    placeMarker.disabled = placement.active || !currentAuthoredCellsReady()
      || !['ready', 'notice'].includes(authoredState);
  }

  function markerFromApi(object) {
    if (!object) return null;
    const worldX = object.worldX ?? object.placement?.worldX;
    const worldY = object.worldY ?? object.placement?.worldY;
    if (!Number.isSafeInteger(worldX) || !Number.isSafeInteger(worldY)
      || typeof object.objectId !== 'string'
      || !Number.isSafeInteger(object.recordRevision)) return null;
    return {
      objectId: object.objectId,
      kind: object.kind,
      worldX,
      worldY,
      appearance: object.appearance,
      recordRevision: object.recordRevision,
      changedAt: object.changedAt,
      regionId: object.regionId || ownerForestCellId({
        cellX: Math.floor(worldX / bootstrap.spatialIndex.cellSize),
        cellY: Math.floor(worldY / bootstrap.spatialIndex.cellSize)
      })
    };
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
    inspectedTreeRevision = null;
    inspectionRequest += 1;
    translationCursor = null;
    translationsLoading = false;
    translationPaths.clear();
    inspection.hidden = true;
    inspectionBackdrop.hidden = !inspectedMarkerId;
    viewport.dataset.inspecting = 'false';
    updateFocus();
    resize();
    requestRender();
    if (restoreFocus) viewport.focus({ preventScroll: true });
  }

  function closeMarkerInspection({ restoreFocus = true, force = false } = {}) {
    if (markerRemoveConfirm.disabled && !force) return;
    inspectedMarkerId = null;
    markerInspection.hidden = true;
    markerConfirm.hidden = true;
    markerActions.hidden = false;
    markerStatus.textContent = '';
    markerMove.disabled = false;
    markerRemove.disabled = false;
    markerRemoveConfirm.disabled = false;
    markerRemoveCancel.disabled = false;
    markerRemoveConfirm.textContent = copy.markers.confirmRemove;
    inspectionBackdrop.hidden = !inspectedTreeId;
    viewport.dataset.inspecting = inspectedTreeId ? 'true' : 'false';
    updateFocus();
    resize();
    requestRender();
    if (restoreFocus) viewport.focus({ preventScroll: true });
  }

  function openMarkerInspection(marker) {
    if (!marker || placement.active) return;
    Object.keys(keys).forEach((key) => { keys[key] = false; });
    clearPointer();
    inspectedMarkerId = marker.objectId;
    markerStatus.textContent = '';
    markerActions.hidden = false;
    markerConfirm.hidden = true;
    markerMove.disabled = false;
    markerRemove.disabled = false;
    markerInspection.hidden = false;
    inspectionBackdrop.hidden = false;
    viewport.dataset.inspecting = 'true';
    nearby.hidden = true;
    resize();
    requestRender();
    markerClose.focus({ preventScroll: true });
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
        inspectedTreeRevision = result.tree.recordRevision;
        hideTree.disabled = false;
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

  function authoredReadError(code) {
    return Object.assign(new Error('authored region request failed'), { code });
  }

  async function requestAuthoredCells(cells) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const objects = new Map();
      let cursor = null;
      try {
        do {
          const query = new URLSearchParams({
            cells: cellQuery(cells),
            limit: String(bootstrap.delivery.authoredPageSize)
          });
          if (cursor) query.set('cursor', cursor);
          const response = await window.fetch(
            `${bootstrap.delivery.authoredRegionPath}?${query}`,
            { credentials: 'same-origin' }
          );
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw authoredReadError(body.code || 'UNAVAILABLE');
          if (body.status !== 'ready') {
            throw authoredReadError(body.status === 'resetting'
              ? 'FOREST_AUTHORED_RESETTING' : 'UNAVAILABLE');
          }
          for (const object of body.objects) {
            const marker = markerFromApi(object);
            if (!marker) throw authoredReadError('FOREST_AUTHORED_MIGRATION_REQUIRED');
            objects.set(marker.objectId, marker);
          }
          cursor = body.page?.nextCursor || null;
        } while (cursor);
        return objects;
      } catch (error) {
        if (error.code === 'FOREST_AUTHORED_REGION_CHANGED' && attempt < 2) continue;
        throw error;
      }
    }
    throw authoredReadError('FOREST_AUTHORED_REGION_CHANGED');
  }

  async function loadNearbyAuthoredCells({ force = false } = {}) {
    if (authoredLoading) return;
    const cells = ownerForestCellsAround(player, bootstrap.spatialIndex.cellSize);
    const requested = force ? cells : cells.filter(
      cell => !loadedAuthoredCells.has(ownerForestCellId(cell))
    );
    if (!requested.length) {
      setAuthoredStatus(copy.markers.ready, { state: 'ready' });
      refreshPlacementAvailability();
      return;
    }
    authoredLoading = true;
    setAuthoredStatus(copy.markers.loading, { state: 'loading' });
    refreshPlacementAvailability();
    try {
      const objects = await requestAuthoredCells(requested);
      const requestedIds = new Set(requested.map(ownerForestCellId));
      replaceOwnerForestAuthoredRegion(markersById, requestedIds, objects.values());
      requestedIds.forEach(cellId => loadedAuthoredCells.add(cellId));
      setAuthoredStatus(copy.markers.ready, { state: 'ready' });
      updateFocus();
      requestRender();
    } catch (error) {
      const migration = error.code === 'FOREST_AUTHORED_MIGRATION_REQUIRED';
      const resetting = error.code === 'FOREST_AUTHORED_RESETTING';
      const hasKnownMarkers = markersById.size > 0;
      setAuthoredStatus(
        migration ? copy.markers.migrationRequired
          : resetting ? copy.markers.resetting
            : hasKnownMarkers ? copy.markers.stale : copy.markers.unavailable,
        {
          state: migration ? 'unsupported' : resetting ? 'resetting' : 'unavailable',
          failed: !resetting,
          retry: !migration
        }
      );
      console.error('Owner forest authored-region load failed:', error?.code || 'Error');
    } finally {
      authoredLoading = false;
      refreshPlacementAvailability();
      if (!currentAuthoredCellsReady() && authoredState === 'ready') {
        loadNearbyAuthoredCells();
      }
    }
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
      const cell = FOREST_OWNER_GROUND_PRESENTATION_CONFIG.tileSize;
      groundSamples.set(id, sampleOwnerForestGroundPresentation({
        worldSeed: bootstrap.environment.seed,
        worldX: Math.max(-OWNER_FOREST_COORDINATE_LIMIT, Math.min(
          OWNER_FOREST_COORDINATE_LIMIT, (column * cell) + (cell / 2)
        )),
        worldY: Math.max(-OWNER_FOREST_COORDINATE_LIMIT, Math.min(
          OWNER_FOREST_COORDINATE_LIMIT, (row * cell) + (cell / 2)
        ))
      }));
    }
    return groundSamples.get(id);
  }

  function paintGroundDetail(detail, x, y, cell) {
    if (!detail) return;
    const scale = detail.scalePermille / 1_000;
    const centerX = x + (cell / 2) + ((detail.offsetXPermille / 1_000) * cell);
    const centerY = y + (cell / 2) + ((detail.offsetYPermille / 1_000) * cell);
    if (detail.kind === 'grass') {
      context.strokeStyle = 'rgba(40, 78, 45, 0.42)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(centerX, centerY + (3 * scale));
      context.lineTo(centerX - (2 * scale), centerY - (3 * scale));
      context.moveTo(centerX, centerY + (3 * scale));
      context.lineTo(centerX + (1.5 * scale), centerY - (4 * scale));
      context.moveTo(centerX + (1.5 * scale), centerY + (3 * scale));
      context.lineTo(centerX + (4 * scale), centerY - (2 * scale));
      context.stroke();
      return;
    }
    if (detail.kind === 'moss') {
      context.fillStyle = 'rgba(151, 151, 75, 0.3)';
      context.fillRect(centerX - (3 * scale), centerY, 3 * scale, 1.5 * scale);
      context.fillRect(centerX + scale, centerY - (2 * scale), 2 * scale, 1.5 * scale);
      return;
    }
    if (detail.kind === 'pebbles') {
      context.fillStyle = 'rgba(102, 102, 83, 0.42)';
      context.beginPath();
      context.ellipse(centerX - (2 * scale), centerY, 2.5 * scale, 1.4 * scale,
        -0.15, 0, Math.PI * 2);
      context.ellipse(centerX + (2.5 * scale), centerY + scale, 1.8 * scale,
        1.1 * scale, 0.2, 0, Math.PI * 2);
      context.fill();
      return;
    }
    context.fillStyle = 'rgba(91, 92, 79, 0.5)';
    context.strokeStyle = 'rgba(59, 69, 58, 0.36)';
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(centerX, centerY, 5 * scale, 2.8 * scale, -0.12, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  function paintGround() {
    const cell = FOREST_OWNER_GROUND_PRESENTATION_CONFIG.tileSize;
    const firstX = Math.floor(camera.x / cell);
    const lastX = Math.ceil((camera.x + camera.width) / cell);
    const firstY = Math.floor(camera.y / cell);
    const lastY = Math.ceil((camera.y + camera.height) / cell);
    for (let row = firstY; row <= lastY; row += 1) {
      for (let column = firstX; column <= lastX; column += 1) {
        const sample = groundSample(column, row);
        const x = (column * cell) - camera.x;
        const y = (row * cell) - camera.y;
        const { red, green, blue } = sample.color;
        context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        context.fillRect(x, y, cell + 1, cell + 1);
        paintGroundDetail(sample.detail, x, y, cell);
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

  function paintMarker(marker, { preview = false, invalid = false, time = 0 } = {}) {
    const x = Math.round(marker.worldX - camera.x);
    const y = Math.round(marker.worldY - camera.y);
    const previousAlpha = context.globalAlpha;
    context.globalAlpha = preview
      ? (placement.saving && !reducedMotion.matches ? 0.48 + (Math.sin(time * 5) * 0.1) : 0.58)
      : 1;
    if (preview || focusedMarker?.objectId === marker.objectId) {
      context.beginPath();
      context.ellipse(x, y, 18, 8, 0, 0, Math.PI * 2);
      context.fillStyle = invalid ? 'rgba(173, 78, 62, 0.32)' : 'rgba(255, 239, 164, 0.34)';
      context.fill();
      context.strokeStyle = invalid ? '#b95547' : '#fff0ae';
      context.lineWidth = 2;
      context.setLineDash(preview ? [4, 3] : []);
      context.stroke();
      context.setLineDash([]);
      if (invalid) {
        context.beginPath();
        context.moveTo(x - 6, y - 5);
        context.lineTo(x + 6, y + 5);
        context.moveTo(x + 6, y - 5);
        context.lineTo(x - 6, y + 5);
        context.stroke();
      }
    }
    context.fillStyle = 'rgba(22, 35, 31, 0.25)';
    context.fillRect(x - 9, y - 3, 18, 5);
    context.fillStyle = '#554638';
    context.fillRect(x - 2, y - 23, 4, 22);
    context.fillStyle = '#c8a852';
    context.fillRect(x - 8, y - 28, 16, 9);
    context.fillStyle = '#6f4d32';
    context.fillRect(x - 5, y - 25, 10, 2);
    context.globalAlpha = previousAlpha;
  }

  function updateFocus() {
    const tree = focusedForestPlacement(player, [...placementsById.values()].filter(
      placement => assetsByKey.has(placement.assetKey)
    ), bootstrap.spawn.interactionRadius);
    const marker = ownerForestFocusedMarker(
      player, [...markersById.values()], bootstrap.spawn.interactionRadius
    );
    const treeDistance = tree ? Math.hypot(player.worldX - tree.worldX, player.worldY - tree.worldY)
      : Infinity;
    const markerDistance = marker
      ? Math.hypot(player.worldX - marker.worldX, player.worldY - marker.worldY) : Infinity;
    focusedMarker = markerDistance < treeDistance ? marker : null;
    focusedTree = focusedMarker ? null : tree;
    const unavailable = !focusedTree && !focusedMarker;
    nearby.hidden = unavailable || Boolean(inspectedTreeId) || Boolean(inspectedMarkerId)
      || placement.active;
    if (focusedMarker) {
      nearbyCopy.textContent = copy.markers.markerNearby;
      inspectButton.textContent = copy.markers.inspectMarker;
    } else {
      nearbyCopy.textContent = copy.markers.treeNearby;
      inspectButton.textContent = copy.markers.inspectTree;
    }
  }

  function render(time = window.performance.now()) {
    frame = null;
    context.imageSmoothingEnabled = false;
    paintGround();
    const placements = [...placementsById.values()];
    const visible = visibleForestPlacements(placements, assetsByKey, camera, 32);
    const visibleMarkers = [...markersById.values()].filter(marker => (
      marker.worldX >= camera.x - 32 && marker.worldX <= camera.x + camera.width + 32
      && marker.worldY >= camera.y - 40 && marker.worldY <= camera.y + camera.height + 32
    ));
    const depth = [
      ...visible.map(tree => ({ kind: 'tree', id: tree.id, placement: tree, worldY: tree.worldY })),
      ...visibleMarkers.map(marker => ({
        kind: 'marker', id: marker.objectId, marker, worldY: marker.worldY
      })),
      ...(placement.active && placement.preview ? [{
        kind: 'preview', id: '~preview', marker: placement.preview,
        worldY: placement.preview.worldY
      }] : []),
      { kind: 'player', id: '~player', player: true, worldY: player.worldY }
    ].sort((a, b) => a.worldY - b.worldY || a.kind.localeCompare(b.kind)
      || a.id.localeCompare(b.id));
    for (const item of depth) {
      if (item.player) {
        paintForestHumanoid(context, Math.round(player.worldX - camera.x),
          Math.round(player.worldY - camera.y), {
            profile: FOREST_HUMANOID_PROFILES.player,
            motion: playerMotion,
            reducedMotion: reducedMotion.matches
          });
      } else if (item.marker) {
        paintMarker(item.marker, {
          preview: item.kind === 'preview',
          invalid: item.kind === 'preview' && !placement.preview.valid,
          time: time / 1000
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

  function previewMessage(reason) {
    return {
      'tree-collision': copy.markers.previewTreeCollision,
      'marker-collision': copy.markers.previewMarkerCollision,
      'world-bounds': copy.markers.previewBounds,
      density: copy.markers.previewDensity
    }[reason] || copy.markers.previewClear;
  }

  function refreshPlacementAvailability() {
    const regionReady = currentAuthoredCellsReady()
      && ['ready', 'notice'].includes(authoredState);
    placeMarker.disabled = placement.active || !regionReady;
    if (!placement.active) return;
    placementSave.disabled = placement.saving || !regionReady || !placement.preview?.valid;
    placementCancel.disabled = placement.saving;
  }

  function updatePlacementPreview() {
    if (!placement.active || placement.saving) return;
    placement.preview = ownerForestMarkerPreview({
      player,
      facingRadians: playerMotion.targetFacingRadians,
      placements: [...placementsById.values()],
      markers: [...markersById.values()],
      cellSize: bootstrap.spatialIndex.cellSize,
      movingObjectId: placement.movingObjectId
    });
    placementStatus.textContent = previewMessage(placement.preview.reason);
    if (placement.request
      && (placement.request.worldX !== placement.preview.worldX
        || placement.request.worldY !== placement.preview.worldY)) {
      placement.request = null;
      placementSave.textContent = placement.mode === 'move'
        ? copy.markers.move : copy.markers.save;
    }
    refreshPlacementAvailability();
    requestRender();
  }

  function stopPlacement({ restoreFocus = true, force = false } = {}) {
    if (placement.saving && !force) return;
    placement.active = false;
    placement.mode = null;
    placement.movingObjectId = null;
    placement.preview = null;
    placement.request = null;
    placement.saving = false;
    placementPanel.hidden = true;
    viewport.dataset.placing = 'false';
    updateFocus();
    refreshPlacementAvailability();
    requestRender();
    if (restoreFocus) viewport.focus({ preventScroll: true });
  }

  function beginPlacement(mode, marker = null) {
    if (!currentAuthoredCellsReady() || !['ready', 'notice'].includes(authoredState)) return;
    if (inspectedMarkerId) closeMarkerInspection({ restoreFocus: false });
    if (inspectedTreeId) closeInspection({ restoreFocus: false });
    clearPointer();
    Object.keys(keys).forEach(key => { keys[key] = false; });
    placement.active = true;
    placement.mode = mode;
    placement.movingObjectId = marker?.objectId || null;
    placement.preview = null;
    placement.request = null;
    placement.saving = false;
    placementPanel.hidden = false;
    viewport.dataset.placing = 'true';
    placementSave.textContent = mode === 'move' ? copy.markers.move : copy.markers.save;
    updatePlacementPreview();
    updateFocus();
    viewport.focus({ preventScroll: true });
  }

  async function authoredMutation(path, method, body) {
    const response = await window.fetch(path, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error('authored mutation failed'), {
      code: result.code || 'FOREST_AUTHORED_MUTATION_UNAVAILABLE',
      object: result.object || null
    });
    return result;
  }

  function reconcileMutationObject(object) {
    const marker = markerFromApi(object);
    if (object?.state === 'removed' || !marker) {
      if (object?.objectId) markersById.delete(object.objectId);
      return null;
    }
    markersById.set(marker.objectId, marker);
    return marker;
  }

  function mutationFailureMessage(code) {
    if (code === 'FOREST_AUTHORED_PLACEMENT_COLLISION') return copy.markers.collision;
    if (code === 'FOREST_AUTHORED_PLACEMENT_DENSITY') return copy.markers.density;
    if (code === 'FOREST_AUTHORED_MUTATION_RATE_LIMITED') return copy.markers.rateLimited;
    return copy.markers.unavailableMutation;
  }

  async function savePlacement() {
    if (!placement.active || placement.saving || !placement.preview?.valid
      || !currentAuthoredCellsReady()) return;
    const { worldX, worldY } = placement.preview;
    if (!placement.request) {
      placement.request = placement.mode === 'create'
        ? { objectId: createOwnerForestMarkerObjectId(window.crypto), worldX, worldY }
        : {
            objectId: placement.movingObjectId,
            expectedRevision: markersById.get(placement.movingObjectId)?.recordRevision,
            worldX,
            worldY
          };
    }
    const request = placement.request;
    if (!request.objectId || (placement.mode === 'move'
      && !Number.isSafeInteger(request.expectedRevision))) return;
    placement.saving = true;
    placementStatus.textContent = placement.mode === 'move'
      ? copy.markers.moving : copy.markers.saving;
    refreshPlacementAvailability();
    requestRender();
    try {
      const path = `${bootstrap.delivery.authoredObjectPath}/${encodeURIComponent(
        request.objectId
      )}${placement.mode === 'move' ? '/placement' : ''}`;
      const body = placement.mode === 'move' ? {
        protocolVersion: bootstrap.delivery.authoredMutationProtocolVersion,
        expectedRevision: request.expectedRevision,
        worldX: request.worldX,
        worldY: request.worldY
      } : {
        protocolVersion: bootstrap.delivery.authoredMutationProtocolVersion,
        kind: 'personal-marker',
        worldX: request.worldX,
        worldY: request.worldY
      };
      const result = await authoredMutation(path, placement.mode === 'move' ? 'PATCH' : 'PUT', body);
      const marker = reconcileMutationObject(result.object);
      if (!marker) throw Object.assign(
        new Error('accepted authored mutation returned no active marker'),
        { code: 'FOREST_AUTHORED_OBJECT_UNAVAILABLE', object: result.object }
      );
      const message = placement.mode === 'move' ? copy.markers.moved : copy.markers.saved;
      stopPlacement({ restoreFocus: false, force: true });
      setAuthoredStatus(message, { state: 'notice' });
      updateFocus();
      viewport.focus({ preventScroll: true });
    } catch (error) {
      if (error.code === 'FOREST_AUTHORED_OBJECT_CONFLICT') {
        reconcileMutationObject(error.object);
        stopPlacement({ restoreFocus: false, force: true });
        setAuthoredStatus(copy.markers.conflict, { state: 'notice', failed: true });
        updateFocus();
        viewport.focus({ preventScroll: true });
        return;
      }
      if (error.code === 'FOREST_AUTHORED_OBJECT_UNAVAILABLE') {
        if (error.object) reconcileMutationObject(error.object);
        else if (placement.movingObjectId) markersById.delete(placement.movingObjectId);
        stopPlacement({ restoreFocus: false, force: true });
        setAuthoredStatus(copy.markers.removedElsewhere, { state: 'notice', failed: true });
        updateFocus();
        viewport.focus({ preventScroll: true });
        return;
      }
      if (error.code === 'FOREST_AUTHORED_MIGRATION_REQUIRED') {
        stopPlacement({ restoreFocus: false, force: true });
        setAuthoredStatus(copy.markers.migrationRequired, {
          state: 'unsupported', failed: true
        });
        viewport.focus({ preventScroll: true });
        return;
      }
      if (error.code === 'FOREST_AUTHORED_RESETTING') {
        stopPlacement({ restoreFocus: false, force: true });
        setAuthoredStatus(copy.markers.resetting, { state: 'resetting', retry: true });
        viewport.focus({ preventScroll: true });
        return;
      }
      placement.saving = false;
      placementStatus.textContent = mutationFailureMessage(error.code);
      placementSave.textContent = placement.mode === 'move'
        ? copy.markers.retryMove : copy.markers.retrySave;
      refreshPlacementAvailability();
      requestRender();
    }
  }

  async function removeInspectedMarker() {
    const marker = markersById.get(inspectedMarkerId);
    if (!marker || markerRemoveConfirm.disabled) return;
    markerRemoveConfirm.disabled = true;
    markerRemoveCancel.disabled = true;
    markerStatus.textContent = copy.markers.removeSaving;
    try {
      const result = await authoredMutation(
        `${bootstrap.delivery.authoredObjectPath}/${encodeURIComponent(
          marker.objectId
        )}/removal`,
        'POST',
        {
          protocolVersion: bootstrap.delivery.authoredMutationProtocolVersion,
          expectedRevision: marker.recordRevision
        }
      );
      if (!['removed', 'already-removed'].includes(result.outcome)
        || result.object?.state !== 'removed') {
        throw new Error('accepted authored removal returned an invalid state');
      }
      markersById.delete(marker.objectId);
      closeMarkerInspection({ restoreFocus: false, force: true });
      setAuthoredStatus(copy.markers.removed, { state: 'notice' });
      updateFocus();
      viewport.focus({ preventScroll: true });
    } catch (error) {
      markerRemoveConfirm.disabled = false;
      markerRemoveCancel.disabled = false;
      if (error.code === 'FOREST_AUTHORED_OBJECT_CONFLICT') {
        reconcileMutationObject(error.object);
        markerConfirm.hidden = true;
        markerActions.hidden = false;
        markerStatus.textContent = copy.markers.conflict;
        markerMove.focus({ preventScroll: true });
      } else if (error.code === 'FOREST_AUTHORED_OBJECT_UNAVAILABLE') {
        markersById.delete(marker.objectId);
        closeMarkerInspection({ restoreFocus: false });
        setAuthoredStatus(copy.markers.removedElsewhere, { state: 'notice', failed: true });
        updateFocus();
        viewport.focus({ preventScroll: true });
      } else if (error.code === 'FOREST_AUTHORED_MIGRATION_REQUIRED') {
        closeMarkerInspection({ restoreFocus: false });
        setAuthoredStatus(copy.markers.migrationRequired, {
          state: 'unsupported', failed: true
        });
        viewport.focus({ preventScroll: true });
      } else if (error.code === 'FOREST_AUTHORED_RESETTING') {
        closeMarkerInspection({ restoreFocus: false });
        setAuthoredStatus(copy.markers.resetting, { state: 'resetting', retry: true });
        viewport.focus({ preventScroll: true });
      } else {
        markerStatus.textContent = mutationFailureMessage(error.code);
        markerRemoveConfirm.textContent = copy.markers.retryRemove;
        markerRemoveConfirm.focus({ preventScroll: true });
      }
      requestRender();
    }
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
      inspectionOpen: Boolean(inspectedTreeId || inspectedMarkerId),
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
      loadNearbyAuthoredCells();
      updatePlacementPreview();
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
    if (event.key === 'Escape' && placement.active) {
      stopPlacement();
      event.preventDefault();
      return;
    }
    if (['Enter', ' '].includes(event.key) && placement.active) {
      savePlacement();
      event.preventDefault();
      return;
    }
    if (['Enter', ' ', 'e', 'E'].includes(event.key) && (focusedTree || focusedMarker)) {
      if (focusedMarker) openMarkerInspection(focusedMarker);
      else requestInspection(focusedTree);
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
      || inspectedMarkerId
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
    if (wasTap && !placement.active) {
      const bounds = viewport.getBoundingClientRect();
      const point = {
        worldX: event.clientX - bounds.left + camera.x,
        worldY: event.clientY - bounds.top + camera.y
      };
      const selectedMarker = ownerForestMarkerAtPoint({
        point,
        player,
        markers: [...markersById.values()],
        interactionRadius: bootstrap.spawn.interactionRadius
      });
      const selected = ownerForestPlacementAtPoint({
        point,
        player,
        placements: [...placementsById.values()],
        assetsByKey,
        interactionRadius: bootstrap.spawn.interactionRadius
      });
      if (selectedMarker) {
        focusedMarker = selectedMarker;
        focusedTree = null;
        nearby.hidden = false;
        openMarkerInspection(selectedMarker);
        requestRender();
      } else if (selected) {
        focusedTree = selected;
        focusedMarker = null;
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
    if (focusedMarker) openMarkerInspection(focusedMarker);
    else if (focusedTree) requestInspection(focusedTree);
  });
  inspectionClose.addEventListener('click', () => closeInspection());
  inspectionBackdrop.addEventListener('click', () => {
    if (inspectedMarkerId) closeMarkerInspection();
    else closeInspection();
  });
  inspection.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeInspection();
    event.preventDefault();
  });
  markerInspection.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeMarkerInspection();
    event.preventDefault();
  });
  translationsMore.addEventListener('click', () => {
    const placement = placementsById.get(inspectedTreeId);
    if (placement) requestInspection(placement, { append: true });
  });
  hideTree.addEventListener('click', async () => {
    const treeId = inspectedTreeId;
    const revision = inspectedTreeRevision;
    if (!treeId || !Number.isSafeInteger(revision) || hideTree.disabled) return;
    hideTree.disabled = true;
    setInspectionStatus(copy.inclusionSaving);
    try {
      const response = await window.fetch(
        `/api/v1/forest/trees/${encodeURIComponent(treeId)}/inclusion`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hidden: true, expectedRevision: revision })
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw Object.assign(new Error('inclusion failed'), { code: error.code });
      }
      placementsById.delete(treeId);
      closeInspection();
      setStatus(copy.treeHidden);
    } catch (error) {
      setInspectionStatus(error.code === 'FOREST_TREE_INCLUSION_CONFLICT'
        ? copy.inclusionConflict : copy.inclusionUnavailable);
      hideTree.disabled = false;
    }
  });
  placeMarker.addEventListener('click', () => beginPlacement('create'));
  authoredRetry.addEventListener('click', () => loadNearbyAuthoredCells({ force: true }));
  placementSave.addEventListener('click', savePlacement);
  placementCancel.addEventListener('click', () => stopPlacement());
  markerClose.addEventListener('click', () => closeMarkerInspection());
  markerMove.addEventListener('click', () => {
    const marker = markersById.get(inspectedMarkerId);
    if (marker) beginPlacement('move', marker);
  });
  markerRemove.addEventListener('click', () => {
    markerActions.hidden = true;
    markerConfirm.hidden = false;
    markerStatus.textContent = '';
    markerRemoveConfirm.textContent = copy.markers.confirmRemove;
    markerRemoveConfirm.disabled = false;
    markerRemoveCancel.disabled = false;
    markerRemoveConfirm.focus({ preventScroll: true });
  });
  markerRemoveCancel.addEventListener('click', () => {
    markerConfirm.hidden = true;
    markerActions.hidden = false;
    markerStatus.textContent = '';
    markerRemove.focus({ preventScroll: true });
  });
  markerRemoveConfirm.addEventListener('click', removeInspectedMarker);
  reset.addEventListener('click', () => {
    clearPointer();
    player = { ...bootstrap.spawn };
    playerMotion = createForestHumanoidMotion('down');
    Object.assign(camera, ownerForestCamera(player, camera));
    updateFocus();
    loadNearbyCells();
    loadNearbyAuthoredCells();
    updatePlacementPreview();
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
  loadNearbyAuthoredCells();
  window.requestAnimationFrame(tick);
  if (loadFailure) setStatus('The forest could not be loaded.', true);
}
