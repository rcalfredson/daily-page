import {
  cameraFollowingPlayer,
  createForestVisibilityCache,
  focusedForestSceneItem,
  forestAmbientMotionActive,
  forestSceneAssetKeysForCells,
  forestSceneCellIdsForViewport,
  forestFoliageMotionGroupDisplacement,
  forestTouchGestureIntent,
  forestLanternGlowIntensity,
  forestSolidClearingPlacements,
  forestPlacementWindParameters,
  moveForestPlayer,
  normalizedMovement,
  touchMovement
} from './forest-scene-math.js';
import { createForestDevOverlayPersistence } from './forest-overlay-persistence.js';
import { createForestDevDiscoveryPersistence } from './forest-discovery-persistence.js';
import {
  availableForestDiscoveries,
  FOREST_DISCOVERY_MATERIALS,
  FOREST_DISCOVERY_OFFERING_COUNT,
  FOREST_DISCOVERY_TYPE,
  forestDiscoveryMaterial,
  forestDiscoveryStateAfterPickup,
  generateForestDiscoveries,
  renewForestDiscoveryState
} from './forest-discoveries.js';
import {
  applyForestOverlay,
  createForestMarker,
  createForestTrailPlacementPreview,
  forestSteppingStoneJoins,
  FOREST_STONE_BENCH_TYPE,
  FOREST_STEPPING_STONE_TYPE,
  FOREST_TRAIL_SIGN_TYPE,
  nextForestSteppingStoneId,
  overlayWithForestSteppingStone,
  overlayWithoutForestSteppingStone,
  overlayWithForestMarker,
  validateForestObjectPlacement
} from './forest-world-overlay.js';
import {
  canAffordForestClearingObject,
  createForestClearingObject,
  createForestClearingPlacementPreview,
  FOREST_CLEARING_OBJECT_DEFINITIONS,
  FOREST_CLEARING_OBJECT_TYPES,
  forestClearingMaterialLedger,
  isForestClearingObject,
  nextForestClearingObjectId,
  normalizeForestSignText,
  overlayWithForestClearingObject,
  overlayWithoutForestClearingObject
} from './forest-clearing-objects.js';
import {
  nearbyForestWritingForBench,
  renderNearbyForestWritingCandidates
} from './forest-nearby-writing.js';
import {
  FOREST_BOULDER_TYPE,
  FOREST_GROUND_DETAIL_CELL_SIZE,
  forestBridgeElevationAt,
  forestBridgeWorldPosition,
  forestEnvironmentAt,
  forestGroundDetailAt,
  forestStreamCenterY,
  resolveForestRockPalette
} from './forest-environment.js';

const payload = document.getElementById('activity-forest-scene');
const viewportElement = document.querySelector('[data-forest-viewport]');
const canvas = document.querySelector('[data-forest-canvas]');

if (payload && viewportElement && canvas) {
  const scriptStartedAt = window.performance.now();
  const initialResponseDecodeStartedAt = window.performance.now();
  const scene = JSON.parse(payload.textContent);
  const crossings = scene.crossings || (scene.crossing ? [scene.crossing] : []);
  const initialResponseDecodeDuration = window.performance.now() - initialResponseDecodeStartedAt;
  const assetsByKey = new Map();
  const fixturesById = new Map(scene.exploration.fixtures.map((fixture) => [fixture.id, fixture]));
  const context = canvas.getContext('2d');
  const spritesByKey = new Map();
  const camera = { x: 0, y: 0, width: 0, height: 0 };
  const player = { ...scene.exploration.spawn };
  const overlayPersistence = createForestDevOverlayPersistence(window.localStorage);
  const persistedOverlay = overlayPersistence.load(scene.baseIdentity);
  let overlay = persistedOverlay.overlay;
  let overlayApplication = applyForestOverlay(scene, overlay);
  let placedObjects = overlayApplication.objects;
  const discoveryPersistence = createForestDevDiscoveryPersistence(window.localStorage);
  const persistedDiscoveries = discoveryPersistence.load(scene.baseIdentity);
  let discoveryState = persistedDiscoveries.state;
  let discoveryOffering = generateForestDiscoveries(
    scene, discoveryState.cycle, placedObjects
  );
  let availableDiscoveries = availableForestDiscoveries(discoveryOffering, discoveryState);
  const keys = { left: false, right: false, up: false, down: false };
  const touch = {
    pointerId: null, originX: 0, originY: 0, x: 0, y: 0, maximumDistance: 0
  };
  const dialog = document.querySelector('[data-forest-dialog]');
  const prompt = document.querySelector('[data-forest-prompt]');
  const joystick = document.querySelector('[data-forest-joystick]');
  const joystickStick = joystick.querySelector('[data-forest-joystick-stick]');
  const trailTools = document.querySelector('[data-forest-trail-tools]');
  const trailToggle = document.querySelector('[data-forest-toggle-trail]');
  const trailStatus = document.querySelector('[data-forest-trail-status]');
  const trailModeLabel = document.querySelector('[data-forest-trail-mode]');
  const trailEditor = { active: false, tool: 'place', preview: null, movingId: null };
  const clearingTools = document.querySelector('[data-forest-clearing-tools]');
  const clearingStatus = document.querySelector('[data-forest-clearing-status]');
  const clearingEditor = { active: false, type: null, preview: null, movingId: null };
  const forestMenuButton = document.querySelector('[data-forest-menu-button]');
  const forestMenu = document.querySelector('[data-forest-menu]');
  const objectDialog = document.querySelector('[data-forest-object-dialog]');
  let selectedClearingObjectId = null;
  let selectedBenchWriting = null;
  let lastClearingAction = persistedOverlay.error
    ? `overlay recovery: ${persistedOverlay.error}` : 'No clearing edit yet';
  const pickupFeedback = document.querySelector('[data-forest-pickup-feedback]');
  let pickupFeedbackTimer = null;
  let lastPickupResult = persistedDiscoveries.error
    ? `recovered: ${persistedDiscoveries.error}` : 'No pickup yet';
  const diagnostics = {
    visible: document.querySelector('[data-forest-visible]'),
    camera: document.querySelector('[data-forest-camera]'),
    player: document.querySelector('[data-forest-player]'),
    focus: document.querySelector('[data-forest-focus]'),
    duration: document.querySelector('[data-forest-duration]'),
    decodeDuration: document.querySelector('[data-forest-decode-duration]'),
    spriteDuration: document.querySelector('[data-forest-sprite-duration]'),
    prepared: document.querySelector('[data-forest-prepared]'),
    firstRender: document.querySelector('[data-forest-first-render]'),
    movementDuration: document.querySelector('[data-forest-movement-duration]'),
    ambientDuration: document.querySelector('[data-forest-ambient-duration]'),
    regionEntry: document.querySelector('[data-forest-region-entry]'),
    regionLoading: document.querySelector('[data-forest-region-loading]'),
    overlay: document.querySelector('[data-forest-overlay]'),
    trail: document.querySelector('[data-forest-trail-diagnostic]'),
    discoveries: document.querySelector('[data-forest-discoveries]'),
    inventory: document.querySelector('[data-forest-inventory]'),
    pickup: document.querySelector('[data-forest-last-pickup]'),
    clearing: document.querySelector('[data-forest-clearing-diagnostic]'),
    commitment: document.querySelector('[data-forest-commitment-diagnostic]'),
    clearingAction: document.querySelector('[data-forest-clearing-last-action]'),
    benchWriting: document.querySelector('[data-forest-bench-writing-diagnostic]'),
    benchResurfaced: document.querySelector('[data-forest-bench-resurfaced]'),
    environmentPlayer: document.querySelector('[data-forest-environment-player]'),
    environmentPaint: document.querySelector('[data-forest-environment-paint]')
  };
  const loadedCellIds = new Set(scene.assetLoading.initialCellIds);
  const pendingCellIds = new Set();
  const totalCellCount = forestSceneCellIdsForViewport({
    x: 0, y: 0, width: scene.world.width, height: scene.world.height
  }, scene.world, scene.assetLoading.cellSize).length;
  const seenPlacementIds = new Set();
  const seenAssetKeys = new Set();
  const movementRenders = { count: 0, total: 0, maximum: 0 };
  const ambientRenders = { count: 0, total: 0, maximum: 0 };
  const windByPlacementId = new Map(scene.placements.map((placement) => (
    [placement.id, forestPlacementWindParameters(placement)]
  )));
  const terrainFeatures = scene.terrainFeatures || [];
  const environmentGroundCells = new Map();
  const visibilityCache = createForestVisibilityCache(
    scene.placements, assetsByKey, 24,
    [...terrainFeatures, ...placedObjects, ...availableDiscoveries]
  );
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let focusedItem = null;
  let preparedSpriteCount = 0;
  let scheduledFrame = null;
  let lastFrameTime = null;
  let lastSeenVisibilityRevision = 0;
  let firstRenderRecorded = false;
  let regionRetryAfter = 0;
  let regionalRequestActive = false;
  let regionalRequestScheduled = false;
  let ambientMotionActive = forestAmbientMotionActive({
    documentHidden: document.hidden,
    reducedMotion: reducedMotionQuery.matches
  });

  function updateOverlayDiagnostic(status = persistedOverlay.status, error = persistedOverlay.error
    || overlayApplication.error) {
    const stoneCount = overlay.objects.filter(({ type }) => (
      type === FOREST_STEPPING_STONE_TYPE
    )).length;
    const clearingCount = overlay.objects.filter(isForestClearingObject).length;
    const markerCount = overlay.objects.length - stoneCount - clearingCount;
    diagnostics.overlay.textContent = `${markerCount} marker · ${stoneCount} stones · revision ${
      overlay.revision} · ${clearingCount} clearing objects · ${status}${error ? ` (${error})` : ''}`;
  }

  function updateDiscoverySurfaces() {
    const ledger = forestClearingMaterialLedger(discoveryState.inventory, placedObjects);
    const counts = Object.fromEntries(FOREST_DISCOVERY_MATERIALS.map(({ id }) => [
      id, discoveryOffering.filter(({ material }) => material === id).length
    ]));
    diagnostics.discoveries.textContent = `${availableDiscoveries.length} / ${
      discoveryOffering.length} remaining · cycle ${discoveryState.cycle} · ${
      FOREST_DISCOVERY_MATERIALS.map(({ id, shortLabel }) => `${shortLabel} ${counts[id]}`)
        .join(' · ')}`;
    diagnostics.inventory.textContent = FOREST_DISCOVERY_MATERIALS.map(({ id, shortLabel }) => (
      `${shortLabel} ${ledger.available[id]} available / ${discoveryState.inventory[id]} gathered`
    )).join(' · ');
    diagnostics.pickup.textContent = lastPickupResult;
    forestMenuButton.setAttribute('aria-label', `Forest menu: ${FOREST_DISCOVERY_MATERIALS.map(
      ({ id, shortLabel }) => `${ledger.available[id]} ${shortLabel.toLowerCase()} available`
    ).join(', ')}`);
    for (const { id } of FOREST_DISCOVERY_MATERIALS) {
      document.querySelector(`[data-forest-material-count="${id}"]`).textContent =
        `${ledger.available[id]} / ${discoveryState.inventory[id]}`;
    }
    const complete = availableDiscoveries.length === 0;
    const renewButton = document.querySelector('[data-forest-renew-discoveries]');
    renewButton.disabled = !complete;
    renewButton.textContent = complete ? 'Welcome another offering' : `${
      availableDiscoveries.length} discoveries remain`;
    const clearing = placedObjects.filter(isForestClearingObject);
    diagnostics.clearing.textContent = `${clearing.length} / 9 · ${FOREST_CLEARING_OBJECT_TYPES.map(
      (type) => `${FOREST_CLEARING_OBJECT_DEFINITIONS[type].label} ${
        clearing.filter((object) => object.type === type).length}`
    ).join(' · ')} · ${clearingEditor.active ? `placing ${clearingEditor.type}` : 'placement off'}`;
    diagnostics.commitment.textContent = `${FOREST_DISCOVERY_MATERIALS.map(({ id, shortLabel }) => (
      `${shortLabel} ${ledger.committed[id]}`
    )).join(' · ')}${ledger.valid ? '' : ` · ${ledger.reason}`}`;
    diagnostics.clearingAction.textContent = lastClearingAction;
    document.querySelectorAll('[data-forest-build]').forEach((button) => {
      button.disabled = !canAffordForestClearingObject(
        discoveryState.inventory, placedObjects, button.dataset.forestBuild
      ) || !nextForestClearingObjectId(overlay, button.dataset.forestBuild);
    });
    const resetButton = document.querySelector('[data-forest-reset-discoveries]');
    resetButton.disabled = clearing.length > 0;
    resetButton.textContent = clearing.length
      ? 'Remove clearing objects before resetting finds' : 'Reset satchel and finds';
  }

  function setDiscoveryObjects() {
    visibilityCache.setObjects([...terrainFeatures, ...placedObjects, ...availableDiscoveries]);
  }

  function regenerateDiscoveryOffering() {
    discoveryOffering = generateForestDiscoveries(scene, discoveryState.cycle, placedObjects);
    availableDiscoveries = availableForestDiscoveries(discoveryOffering, discoveryState);
    setDiscoveryObjects();
    updateDiscoverySurfaces();
  }

  updateOverlayDiagnostic();
  updateDiscoverySurfaces();

  function paintDiscoveryGlyph(targetContext, x, y, material) {
    targetContext.fillStyle = 'rgba(22, 35, 31, 0.24)';
    targetContext.beginPath();
    targetContext.ellipse(x, y + 3, 9, 4, 0, 0, Math.PI * 2);
    targetContext.fill();
    if (material === 'fallen-twigs') {
      targetContext.strokeStyle = '#6c4930';
      targetContext.lineWidth = 3;
      targetContext.beginPath();
      targetContext.moveTo(x - 7, y + 2);
      targetContext.lineTo(x + 6, y - 4);
      targetContext.moveTo(x - 2, y);
      targetContext.lineTo(x - 5, y - 5);
      targetContext.stroke();
    } else if (material === 'smooth-stones') {
      targetContext.fillStyle = '#c8c0a5';
      targetContext.strokeStyle = '#6f756c';
      targetContext.lineWidth = 1;
      targetContext.beginPath();
      targetContext.ellipse(x, y - 1, 7, 5, -0.12, 0, Math.PI * 2);
      targetContext.fill();
      targetContext.stroke();
    } else {
      targetContext.fillStyle = '#d4ad4f';
      targetContext.strokeStyle = '#715c2c';
      targetContext.lineWidth = 1;
      targetContext.beginPath();
      targetContext.ellipse(x - 3, y, 3, 5, -0.45, 0, Math.PI * 2);
      targetContext.ellipse(x + 3, y - 2, 3, 5, 0.45, 0, Math.PI * 2);
      targetContext.fill();
      targetContext.stroke();
    }
  }

  document.querySelectorAll('[data-forest-material-icon]').forEach((icon) => {
    const iconContext = icon.getContext('2d');
    iconContext.imageSmoothingEnabled = false;
    paintDiscoveryGlyph(iconContext, icon.width / 2, icon.height / 2,
      icon.dataset.forestMaterialIcon);
  });

  function rasterLayerSource(layer) {
    const binary = window.atob(layer.data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: layer.mediaType });
  }

  async function decodeRasterLayer(layer) {
    const source = rasterLayerSource(layer);
    if (window.createImageBitmap) return window.createImageBitmap(source);
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(source);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Lossless forest raster decoding failed.'));
      };
      image.src = url;
    });
  }

  async function prepareRuntimeSprite(source, dimensions) {
    if (source.runs) {
      const sprite = document.createElement('canvas');
      sprite.width = dimensions.width;
      sprite.height = dimensions.height;
      const spriteContext = sprite.getContext('2d');
      spriteContext.imageSmoothingEnabled = false;
      for (const run of source.runs) {
        spriteContext.fillStyle = run.color;
        spriteContext.fillRect(run.x, run.y, run.width, 1);
      }
      return { sprite, decodeDuration: 0 };
    }
    const decodeStartedAt = window.performance.now();
    const sprite = await decodeRasterLayer(source);
    return { sprite, decodeDuration: window.performance.now() - decodeStartedAt };
  }

  async function prepareRuntimeAsset(asset) {
    if (spritesByKey.has(asset.cacheKey)) return { preparedCount: 0, decodeDuration: 0 };
    let decodeDuration = 0;
    const layerSprites = [];
    for (const layer of asset.layers) {
      if (layer.motionGroups) {
        const motionGroups = [];
        for (const group of layer.motionGroups) {
          const prepared = await prepareRuntimeSprite(group, asset.dimensions);
          decodeDuration += prepared.decodeDuration;
          preparedSpriteCount += 1;
          motionGroups.push({
            id: group.id,
            index: group.index,
            attachment: group.attachment,
            windResponse: group.windResponse,
            sprite: prepared.sprite
          });
        }
        layerSprites.push({ id: layer.id, motionGroups });
      } else {
        const prepared = await prepareRuntimeSprite(layer, asset.dimensions);
        decodeDuration += prepared.decodeDuration;
        preparedSpriteCount += 1;
        layerSprites.push({ id: layer.id, sprite: prepared.sprite });
      }
    }
    assetsByKey.set(asset.cacheKey, asset);
    spritesByKey.set(asset.cacheKey, layerSprites);
    visibilityCache.invalidate();
    diagnostics.prepared.textContent = `${spritesByKey.size} / ${
      scene.assetLoading.totalAssetCount} assets · ${preparedSpriteCount} layer/group sprites`;
    return { preparedCount: 1, decodeDuration };
  }

  function waitForAssetPreparationTime() {
    return new Promise((resolve) => {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(resolve, { timeout: 50 });
      } else {
        window.setTimeout(resolve, 0);
      }
    });
  }

  async function prepareRegionalRuntimeAssets(assets) {
    let activeDuration = 0;
    let decodeDuration = 0;
    let batchDuration = 0;
    let preparedCount = 0;
    for (const [index, asset] of assets.entries()) {
      const assetStartedAt = window.performance.now();
      const prepared = await prepareRuntimeAsset(asset);
      preparedCount += prepared.preparedCount;
      decodeDuration += prepared.decodeDuration;
      const assetDuration = window.performance.now() - assetStartedAt;
      const preparationDuration = Math.max(0, assetDuration - prepared.decodeDuration);
      activeDuration += preparationDuration;
      batchDuration += preparationDuration;
      if (batchDuration >= 6 && index < assets.length - 1) {
        await waitForAssetPreparationTime();
        batchDuration = 0;
      }
    }
    return { activeDuration, decodeDuration, preparedCount };
  }

  const spritePreparationStartedAt = window.performance.now();
  const initialPreparation = await prepareRegionalRuntimeAssets(scene.assets);
  const initialPreparationElapsed = window.performance.now() - spritePreparationStartedAt;
  const spritePreparationDuration = initialPreparation.activeDuration;
  diagnostics.decodeDuration.textContent = `${initialResponseDecodeDuration.toFixed(1)} ms JSON + ${
    initialPreparation.decodeDuration.toFixed(1)} ms ${scene.assetLoading.transport} initial`;
  diagnostics.spriteDuration.textContent = `${spritePreparationDuration.toFixed(1)} ms active / ${
    initialPreparationElapsed.toFixed(1)} ms elapsed initial`;

  function updateRegionLoading(message = '') {
    diagnostics.regionLoading.textContent = `${loadedCellIds.size} / ${totalCellCount} cells loaded · ${
      pendingCellIds.size} pending${message ? ` · ${message}` : ''}`;
  }

  async function requestRequiredRegions() {
    if (!camera.width || !camera.height || regionalRequestActive
      || window.performance.now() < regionRetryAfter) return;
    const requiredCellIds = forestSceneCellIdsForViewport(
      camera,
      scene.world,
      scene.assetLoading.cellSize,
      scene.assetLoading.preloadCellCount
    );
    const missingCellIds = requiredCellIds.filter((cellId) => (
      !loadedCellIds.has(cellId) && !pendingCellIds.has(cellId)
    ));
    if (!missingCellIds.length) return;
    const missingAssetKeys = forestSceneAssetKeysForCells(
      scene.placements,
      missingCellIds,
      scene.assetLoading.cellSize,
      spritesByKey.keys()
    );
    if (!missingAssetKeys.length) {
      missingCellIds.forEach((cellId) => loadedCellIds.add(cellId));
      updateRegionLoading(`${missingCellIds.length} cells reused prepared assets`);
      return;
    }
    regionalRequestActive = true;
    missingCellIds.forEach((cellId) => pendingCellIds.add(cellId));
    updateRegionLoading('requesting nearby assets');
    const requestStartedAt = window.performance.now();
    let completionMessage = '';
    try {
      const query = new URLSearchParams({
        pressure: scene.assetLoading.profileId,
        transport: scene.assetLoading.transport,
        cells: missingCellIds.join(','),
        assetKeys: missingAssetKeys.join(',')
      });
      const response = await window.fetch(`/__dev/api/activity-forest/assets?${query}`);
      if (!response.ok) throw new Error(`Regional asset request failed (${response.status}).`);
      const responseDecodeStartedAt = window.performance.now();
      const region = await response.json();
      const responseDecodeDuration = window.performance.now() - responseDecodeStartedAt;
      const responseReceivedAt = window.performance.now();
      const {
        activeDuration: preparationDuration,
        decodeDuration,
        preparedCount
      } = await prepareRegionalRuntimeAssets(region.assets);
      region.cellIds.forEach((cellId) => loadedCellIds.add(cellId));
      diagnostics.spriteDuration.textContent = `${spritePreparationDuration.toFixed(1)} ms initial / ${
        preparationDuration.toFixed(1)} ms last regional`;
      diagnostics.decodeDuration.textContent = `${initialResponseDecodeDuration.toFixed(1)} ms JSON + ${
        initialPreparation.decodeDuration.toFixed(1)} ms image initial / ${
        responseDecodeDuration.toFixed(1)} ms JSON + ${decodeDuration.toFixed(1)} ms image regional`;
      completionMessage = `${preparedCount} new assets · ${
        region.serverPreparation.encodedPayloadBytes.toLocaleString()} bytes · ${
        (responseReceivedAt - requestStartedAt).toFixed(1)} ms fetch · ${
        region.serverPreparation.generationDurationMilliseconds.toFixed(1)} ms generate · ${
        region.serverPreparation.encodingDurationMilliseconds.toFixed(1)} ms encode`;
      updateFocus();
      requestRender();
    } catch (error) {
      completionMessage = error.message;
      regionRetryAfter = window.performance.now() + 1000;
    } finally {
      missingCellIds.forEach((cellId) => pendingCellIds.delete(cellId));
      regionalRequestActive = false;
      updateRegionLoading(completionMessage);
      requestRequiredRegions();
    }
  }

  function scheduleRequiredRegions() {
    if (regionalRequestScheduled) return;
    regionalRequestScheduled = true;
    window.setTimeout(() => {
      regionalRequestScheduled = false;
      requestRequiredRegions();
    }, 0);
  }

  updateRegionLoading();

  function corridorCenter(worldY) {
    return (scene.world.width / 2) + (Math.sin((worldY / 330) + 0.7) * 155);
  }

  function followPlayer() {
    Object.assign(camera, cameraFollowingPlayer(player, camera, scene.world));
    scheduleRequiredRegions();
  }

  function environmentGroundCell(column, row) {
    const key = `${column}:${row}`;
    if (!environmentGroundCells.has(key)) {
      const sampleX = Math.min(scene.world.width,
        (column * FOREST_GROUND_DETAIL_CELL_SIZE) + 24);
      const sampleY = Math.min(scene.world.height,
        (row * FOREST_GROUND_DETAIL_CELL_SIZE) + 24);
      environmentGroundCells.set(key, {
        environment: forestEnvironmentAt(scene.environment, { worldX: sampleX, worldY: sampleY }),
        detail: forestGroundDetailAt(scene.environment, { column, row })
      });
    }
    return environmentGroundCells.get(key);
  }

  function terrainColor(blend, variation) {
    const grove = [82, 132, 76];
    const rocky = [112, 128, 76];
    return `rgb(${grove.map((value, index) => Math.round(
      value + ((rocky[index] - value) * blend) + variation
    )).join(', ')})`;
  }

  function paintGroundDetail(detail) {
    if (!detail) return;
    const x = Math.round(detail.worldX - camera.x);
    const y = Math.round(detail.worldY - camera.y);
    const rocky = detail.rockyBlendPermille / 1000;
    const rockPalette = resolveForestRockPalette(detail.rockPaletteId)
      || resolveForestRockPalette('mossed-green');
    if (detail.type === 'grass-tuft') {
      context.fillStyle = rocky > 0.55 ? '#607d43' : '#3f8047';
      const spread = 2 + (detail.variant % 2);
      context.fillRect(x - spread - 2, y - 2, 2, 5);
      context.fillRect(x - 1, y - 5 - (detail.variant % 2), 2, 8 + (detail.variant % 2));
      context.fillRect(x + spread, y - 3, 2, 6);
      context.fillStyle = rocky > 0.55 ? '#9da95b' : '#82ad50';
      context.fillRect(x, y - 4, 1, 3);
    } else if (detail.type === 'gravel-patch') {
      context.fillStyle = rockPalette.colors.mid;
      context.fillRect(x - 11, y - 3, 7, 3);
      context.fillRect(x - 5, y - 5, 12, 5);
      context.fillRect(x + 5, y - 2, 8, 4);
      context.fillStyle = rockPalette.colors.light;
      context.fillRect(x - 8, y - 3, 3, 2);
      context.fillRect(x - 1, y - 5, 4, 2);
      context.fillRect(x + 7, y - 1, 3, 2);
      context.fillStyle = rockPalette.colors.dark;
      context.fillRect(x - 3, y, 4, 2);
      if (detail.variant > 1) context.fillRect(x + 11, y + 1, 3, 2);
    } else if (detail.type === 'small-stone') {
      context.fillStyle = 'rgba(43, 53, 45, 0.22)';
      context.fillRect(x - 7, y + 2, 15, 3);
      context.fillStyle = rockPalette.colors.dark;
      context.fillRect(x - 6, y - 2, 13, 5);
      context.fillRect(x - 3, y - 4, 8, 2);
      context.fillStyle = rockPalette.colors.light;
      context.fillRect(x - 3, y - 3, 7, 2);
      context.fillStyle = rockPalette.colors.highlight;
      context.fillRect(x - 2, y - 3, 4, 1);
    } else {
      context.fillStyle = rocky > 0.5 ? '#887b50' : '#66854f';
      context.fillRect(x - 10, y - 3, 9, 3);
      context.fillRect(x - 3, y - 4, 11, 5);
      context.fillRect(x + 7, y - 1, 5, 3);
      context.fillStyle = rocky > 0.5 ? '#a1955b' : '#82a45d';
      context.fillRect(x - 1, y - 3, 6, 2);
    }
  }

  function paintGround() {
    const groundStartedAt = window.performance.now();
    if (scene.environment) {
      const cellSize = FOREST_GROUND_DETAIL_CELL_SIZE;
      const firstColumn = Math.max(0, Math.floor(camera.x / cellSize));
      const lastColumn = Math.min(Math.ceil(scene.world.width / cellSize) - 1,
        Math.floor((camera.x + camera.width) / cellSize));
      const firstRow = Math.max(0, Math.floor(camera.y / cellSize));
      const lastRow = Math.min(Math.ceil(scene.world.height / cellSize) - 1,
        Math.floor((camera.y + camera.height) / cellSize));
      let queryCount = 0;
      let detailCount = 0;
      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          const cell = environmentGroundCell(column, row);
          queryCount += 1;
          const blend = cell.environment.transition.rockyBlendPermille / 1000;
          const variation = ((column * 3) + (row * 5)) % 3 - 1;
          context.fillStyle = terrainColor(blend, variation * 2);
          context.fillRect((column * cellSize) - camera.x, (row * cellSize) - camera.y,
            cellSize + 1, cellSize + 1);
          if (cell.detail) detailCount += 1;
        }
      }
      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          paintGroundDetail(environmentGroundCell(column, row).detail);
        }
      }
      if (diagnostics.environmentPaint) {
        diagnostics.environmentPaint.textContent = `${queryCount} visible cells · ${
          detailCount} terrain details · ${(
          window.performance.now() - groundStartedAt).toFixed(1)} ms last`;
      }
    } else {
      context.fillStyle = '#617858';
      context.fillRect(0, 0, camera.width, camera.height);
      const bandHeight = 320;
      const firstBandY = Math.floor(camera.y / bandHeight) * bandHeight;
      for (let worldY = firstBandY; worldY <= camera.y + camera.height;
        worldY += bandHeight) {
        context.fillStyle = Math.floor(worldY / bandHeight) % 2 === 0
          ? 'rgba(202, 211, 170, 0.045)' : 'rgba(31, 67, 48, 0.035)';
        context.fillRect(0, worldY - camera.y, camera.width, bandHeight);
      }
    }
    context.beginPath();
    for (let screenY = 0; screenY <= camera.height + 16; screenY += 16) {
      const screenX = corridorCenter(camera.y + screenY) - camera.x
        - scene.corridor.halfWidth;
      if (screenY === 0) context.moveTo(screenX, screenY);
      else context.lineTo(screenX, screenY);
    }
    for (let screenY = camera.height + 16; screenY >= 0; screenY -= 16) {
      context.lineTo(corridorCenter(camera.y + screenY) - camera.x
        + scene.corridor.halfWidth, screenY);
    }
    context.closePath();
    context.fillStyle = 'rgba(184, 170, 105, 0.36)';
    context.fill();
  }

  function paintStreamRibbon(halfWidth, fillStyle) {
    const firstX = Math.max(0, Math.floor(camera.x / 16) * 16);
    const lastX = Math.min(scene.world.width, Math.ceil(
      (camera.x + camera.width) / 16
    ) * 16);
    context.beginPath();
    for (let worldX = firstX; worldX <= lastX; worldX += 16) {
      const screenX = worldX - camera.x;
      const screenY = forestStreamCenterY(scene.environment, worldX) - camera.y - halfWidth;
      if (worldX === firstX) context.moveTo(screenX, screenY);
      else context.lineTo(screenX, screenY);
    }
    for (let worldX = lastX; worldX >= firstX; worldX -= 16) {
      context.lineTo(worldX - camera.x,
        forestStreamCenterY(scene.environment, worldX) - camera.y + halfWidth);
    }
    context.closePath();
    context.fillStyle = fillStyle;
    context.fill();
  }

  function streamFlowDeflection(worldX, worldY) {
    let deflection = 0;
    for (const boulder of terrainFeatures.filter(({ terrainRole }) => (
      terrainRole === 'stream-boulder'
    ))) {
      const distanceX = Math.abs(worldX - boulder.worldX);
      const distanceY = Math.abs(worldY - boulder.worldY);
      if (distanceX >= 62 || distanceY >= 25) continue;
      const side = worldY <= boulder.worldY ? -1 : 1;
      deflection += side * (1 - (distanceX / 62)) * (14 - (distanceY * 0.22));
    }
    return Math.round(deflection);
  }

  function streamFlowVariation(markIndex, lane, salt) {
    const value = Math.sin((markIndex * 91.73) + (lane * 17.19) + (salt * 43.11))
      * 43758.5453;
    return value - Math.floor(value);
  }

  function bridgePresentationVariation(bridge, decision, ordinal = 0, side = 0) {
    const value = Math.sin((bridge.worldX * 0.071)
      + (bridge.worldY * 0.037) + (decision * 47.31)
      + (ordinal * 91.73) + (side * 19.17)) * 43758.5453;
    return value - Math.floor(value);
  }

  function paintStreamColorBand(lane, halfWidth, fillStyle, wavelength, phase) {
    const firstX = Math.max(0, Math.floor(camera.x / 16) * 16);
    const lastX = Math.min(scene.world.width, Math.ceil(
      (camera.x + camera.width) / 16
    ) * 16);
    const edge = (worldX, side) => {
      const meander = Math.sin((worldX / wavelength) + phase) * 4;
      const widthVariation = Math.sin((worldX / (wavelength * 0.57)) + phase + 1.7) * 2;
      return forestStreamCenterY(scene.environment, worldX) + lane + meander
        + (side * (halfWidth + widthVariation));
    };
    context.beginPath();
    for (let worldX = firstX; worldX <= lastX; worldX += 16) {
      const pointX = worldX - camera.x;
      const pointY = edge(worldX, -1) - camera.y;
      if (worldX === firstX) context.moveTo(pointX, pointY);
      else context.lineTo(pointX, pointY);
    }
    for (let worldX = lastX; worldX >= firstX; worldX -= 16) {
      context.lineTo(worldX - camera.x, edge(worldX, 1) - camera.y);
    }
    context.closePath();
    context.fillStyle = fillStyle;
    context.fill();
  }

  function paintStreamSurfaceTexture(stream) {
    const textureSpacing = 18;
    const firstColumn = Math.floor((camera.x - textureSpacing) / textureSpacing);
    const lastColumn = Math.ceil((camera.x + camera.width + textureSpacing) / textureSpacing);
    const waterColors = ['#216b7b', '#2c7d88', '#3b8c91', '#267687', '#459594'];
    const laneCount = Math.floor((stream.halfWidth * 2 - 12) / 11);
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      for (let laneIndex = 0; laneIndex <= laneCount; laneIndex += 1) {
        const identity = column + (laneIndex * 1009);
        if (streamFlowVariation(identity, laneIndex, 11) < 0.34) continue;
        const worldX = (column * textureSpacing)
          + Math.floor(streamFlowVariation(identity, laneIndex, 12) * 9);
        const lane = -stream.halfWidth + 7 + (laneIndex * 11)
          + Math.floor((streamFlowVariation(identity, laneIndex, 13) - 0.5) * 5);
        if (Math.abs(lane) >= stream.halfWidth - 3) continue;
        const worldY = forestStreamCenterY(scene.environment, Math.max(0, Math.min(
          scene.world.width, Math.round(worldX)
        ))) + lane;
        const x = Math.round(worldX - camera.x);
        const y = Math.round(worldY - camera.y);
        const width = 2 + Math.floor(streamFlowVariation(identity, laneIndex, 14) * 7);
        const colorIndex = Math.floor(streamFlowVariation(identity, laneIndex, 15)
          * waterColors.length);
        context.fillStyle = waterColors[colorIndex];
        context.fillRect(x, y, width, 2);
        if (streamFlowVariation(identity, laneIndex, 16) > 0.72) {
          context.fillRect(x + (identity % 2 ? -2 : width), y + 2, 3, 1);
        }
      }
    }
  }

  function paintStreamEdgeTexture(stream) {
    const edgeSpacing = 14;
    const firstColumn = Math.floor((camera.x - edgeSpacing) / edgeSpacing);
    const lastColumn = Math.ceil((camera.x + camera.width + edgeSpacing) / edgeSpacing);
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const worldX = column * edgeSpacing;
      const queryX = Math.max(0, Math.min(scene.world.width, Math.round(worldX)));
      const centerY = forestStreamCenterY(scene.environment, queryX);
      for (const side of [-1, 1]) {
        const identity = column + (side * 401);
        const notch = Math.floor(streamFlowVariation(identity, side, 21) * 5);
        const width = 4 + Math.floor(streamFlowVariation(identity, side, 22) * 8);
        const waterY = centerY + (side * (stream.halfWidth - 2 + notch));
        context.fillStyle = side < 0 ? '#58a09a' : '#1d6577';
        context.fillRect(Math.round(worldX - camera.x), Math.round(waterY - camera.y), width, 2);
        if (streamFlowVariation(identity, side, 23) > 0.4) {
          const bankY = centerY + (side * (stream.halfWidth + 5 + notch));
          context.fillStyle = streamFlowVariation(identity, side, 24) > 0.5
            ? '#527342' : '#789054';
          context.fillRect(Math.round(worldX - camera.x) + 3,
            Math.round(bankY - camera.y), Math.max(3, width - 3), 2);
        }
      }
    }
  }

  function paintStream(elapsedSeconds) {
    const stream = scene.environment.stream;
    paintStreamRibbon(stream.halfWidth + stream.bankWidth, '#61794b');
    paintStreamRibbon(stream.halfWidth + 6, '#336d67');
    paintStreamRibbon(stream.halfWidth, '#247486');
    paintStreamColorBand(7, 20, '#2f8190', 176, 0.4);
    paintStreamColorBand(-22, 7, '#4b9b9b', 127, 2.1);
    paintStreamColorBand(27, 5, '#1d687d', 151, 4.6);
    paintStreamSurfaceTexture(stream);
    paintStreamEdgeTexture(stream);
    const spacing = 76;
    const firstMark = Math.floor((camera.x - spacing) / spacing);
    const lastMark = Math.ceil((camera.x + camera.width + spacing) / spacing);
    const flowFrame = ambientMotionActive ? Math.floor(elapsedSeconds * 6) : 0;
    const flowDistance = flowFrame * 5;
    const phase = flowDistance % spacing;
    const flowCycle = Math.floor(flowDistance / spacing);
    const lanes = [-27, -9, 11, 28].filter(offset => (
      Math.abs(offset) < stream.halfWidth - 4
    ));
    for (const lane of lanes) {
      for (let markIndex = firstMark; markIndex <= lastMark; markIndex += 1) {
        const flowIdentity = markIndex - flowCycle;
        if (streamFlowVariation(flowIdentity, lane, 0) < 0.28) continue;
        const jitter = (streamFlowVariation(flowIdentity, lane, 1) - 0.5) * 34;
        const startX = (markIndex * spacing) + phase + jitter;
        const length = 18 + Math.floor(streamFlowVariation(flowIdentity, lane, 2) * 25);
        const stepDirection = streamFlowVariation(flowIdentity, lane, 3) < 0.5 ? -1 : 1;
        const segmentCount = length > 32 ? 3 : 2;
        for (let segment = 0; segment < segmentCount; segment += 1) {
          const segmentX = startX + (segment * Math.floor(length / segmentCount));
          const worldX = Math.max(0, Math.min(scene.world.width, segmentX));
          const streamQueryX = Math.round(worldX);
          const laneStep = segment === 1 ? stepDirection * 2 : 0;
          const baseY = forestStreamCenterY(scene.environment, streamQueryX) + lane + laneStep;
          const worldY = baseY + streamFlowDeflection(worldX, baseY);
          const screenX = Math.round(worldX - camera.x);
          const screenY = Math.round(worldY - camera.y);
          const segmentWidth = Math.max(5,
            Math.ceil(length / segmentCount) + (segment === 1 ? 2 : 0));
          context.fillStyle = lane === -9 || lane === 28 ? '#a1d0bd' : '#79c3bb';
          context.fillRect(screenX - 2, screenY + 2, segmentWidth - 1, 1);
          context.fillRect(screenX, screenY, segmentWidth, 2);
          if (segment === 0 && streamFlowVariation(flowIdentity, lane, 4) > 0.66) {
            context.fillStyle = '#c5dfc5';
            context.fillRect(screenX + 3, screenY, Math.max(3, segmentWidth - 5), 1);
          }
          if (segment === segmentCount - 1) {
            context.fillStyle = '#4ca3a5';
            context.fillRect(screenX + segmentWidth, screenY + stepDirection, 3, 1);
          }
        }
      }
    }
  }

  function bridgeScreenPoint(bridge, longitudinal, lateral = 0, elevated = true) {
    const world = forestBridgeWorldPosition(bridge, longitudinal, lateral);
    const elevationPosition = forestBridgeWorldPosition(bridge, longitudinal, 0);
    const elevation = elevated
      ? forestBridgeElevationAt(bridge, elevationPosition) : 0;
    return {
      x: Math.round(world.worldX - camera.x),
      y: Math.round(world.worldY - camera.y - elevation)
    };
  }

  function bridgePolygon(points, fillStyle) {
    context.beginPath();
    points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.closePath();
    context.fillStyle = fillStyle;
    context.fill();
  }

  function paintBridgeDeck(bridge) {
    const sideDrop = 11;

    for (const endSign of [-1, 1]) {
      for (const side of [-1, 1]) {
        const inner = endSign * (bridge.halfLength - 8);
        const outer = endSign * (bridge.halfLength + 7);
        const nearSide = side * (bridge.halfWidth - 4);
        const farSide = side * (bridge.halfWidth + 10);
        bridgePolygon([
          bridgeScreenPoint(bridge, inner, nearSide, false),
          bridgeScreenPoint(bridge, inner, farSide, false),
          bridgeScreenPoint(bridge, outer, farSide, false),
          bridgeScreenPoint(bridge, outer, nearSide, false)
        ], '#555344');
        bridgePolygon([
          bridgeScreenPoint(bridge, inner + (endSign * 2), nearSide, false),
          bridgeScreenPoint(bridge, inner + (endSign * 2),
            side * (bridge.halfWidth + 6), false),
          bridgeScreenPoint(bridge, outer - (endSign * 2),
            side * (bridge.halfWidth + 6), false),
          bridgeScreenPoint(bridge, outer - (endSign * 2), nearSide, false)
        ], '#85806a');
      }
    }

    bridgePolygon([
      bridgeScreenPoint(bridge, -bridge.halfLength, -bridge.halfWidth - 6, false),
      bridgeScreenPoint(bridge, -bridge.halfLength, bridge.halfWidth + 6, false),
      bridgeScreenPoint(bridge, bridge.halfLength, bridge.halfWidth + 6, false),
      bridgeScreenPoint(bridge, bridge.halfLength, -bridge.halfWidth - 6, false)
    ].map(point => ({ x: point.x + 3, y: point.y + 7 })), 'rgba(27, 39, 37, 0.34)');

    for (const side of [-1, 1]) {
      const archEdge = [];
      for (let longitudinal = -bridge.halfLength; longitudinal < bridge.halfLength;
        longitudinal += 12) {
        const next = Math.min(bridge.halfLength, longitudinal + 12);
        const start = bridgeScreenPoint(bridge, longitudinal, side * (bridge.halfWidth + 1));
        const end = bridgeScreenPoint(bridge, next, side * (bridge.halfWidth + 1));
        if (!archEdge.length) archEdge.push(start);
        archEdge.push(end);
        bridgePolygon([start, end, { x: end.x, y: end.y + sideDrop },
          { x: start.x, y: start.y + sideDrop }], side < 0 ? '#493225' : '#392a22');
      }
      context.beginPath();
      archEdge.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y + sideDrop);
        else context.lineTo(point.x, point.y + sideDrop);
      });
      context.strokeStyle = '#2f2924';
      context.lineWidth = 3;
      context.lineJoin = 'round';
      context.stroke();
      context.beginPath();
      archEdge.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y + 2);
        else context.lineTo(point.x, point.y + 2);
      });
      context.strokeStyle = '#805536';
      context.lineWidth = 2;
      context.stroke();
    }

    bridgePolygon([
      bridgeScreenPoint(bridge, -bridge.halfLength, -bridge.halfWidth),
      bridgeScreenPoint(bridge, -bridge.halfLength, bridge.halfWidth),
      bridgeScreenPoint(bridge, bridge.halfLength, bridge.halfWidth),
      bridgeScreenPoint(bridge, bridge.halfLength, -bridge.halfWidth)
    ], '#563a29');

    let longitudinal = -bridge.halfLength;
    let plankOrdinal = 0;
    while (longitudinal < bridge.halfLength) {
      const plankWidth = 6 + Math.floor(bridgePresentationVariation(
        bridge, 1, plankOrdinal
      ) * 5);
      const next = Math.min(bridge.halfLength, longitudinal + plankWidth);
      const startLeftInset = Math.floor(bridgePresentationVariation(
        bridge, 2, plankOrdinal
      ) * 3);
      const startRightInset = Math.floor(bridgePresentationVariation(
        bridge, 3, plankOrdinal
      ) * 3);
      const endLeftInset = Math.floor(bridgePresentationVariation(
        bridge, 2, plankOrdinal + 1
      ) * 3);
      const endRightInset = Math.floor(bridgePresentationVariation(
        bridge, 3, plankOrdinal + 1
      ) * 3);
      const plank = [
        bridgeScreenPoint(bridge, longitudinal, -bridge.halfWidth + startLeftInset),
        bridgeScreenPoint(bridge, longitudinal, bridge.halfWidth - startRightInset),
        bridgeScreenPoint(bridge, next, bridge.halfWidth - endRightInset),
        bridgeScreenPoint(bridge, next, -bridge.halfWidth + endLeftInset)
      ];
      const plankCenter = forestBridgeWorldPosition(bridge,
        longitudinal + (plankWidth * 0.5), 0);
      const elevationRatio = forestBridgeElevationAt(bridge, plankCenter)
        / bridge.maximumElevationPixels;
      const plankColors = elevationRatio > 0.72
        ? ['#b87f49', '#c08a52', '#a87243', '#b7804c']
        : elevationRatio > 0.34
          ? ['#a66f42', '#b57d49', '#96613b', '#aa7243']
          : ['#925f3c', '#a36c41', '#835536', '#98623c'];
      const colorIndex = Math.floor(bridgePresentationVariation(bridge, 4, plankOrdinal)
        * plankColors.length);
      bridgePolygon(plank, plankColors[colorIndex]);
      context.beginPath();
      const seamStart = bridgeScreenPoint(bridge, longitudinal,
        -bridge.halfWidth + startLeftInset + 2);
      const seamEnd = bridgeScreenPoint(bridge, longitudinal,
        bridge.halfWidth - startRightInset - 2);
      context.moveTo(seamStart.x, seamStart.y);
      context.lineTo(seamEnd.x, seamEnd.y);
      context.strokeStyle = elevationRatio > 0.72 ? '#795033' : '#65452f';
      context.lineWidth = 1;
      context.stroke();
      const grainCenter = -bridge.halfWidth + 12
        + (bridgePresentationVariation(bridge, 5, plankOrdinal) * (bridge.halfWidth * 1.25));
      const grainLength = 5 + Math.floor(bridgePresentationVariation(
        bridge, 6, plankOrdinal
      ) * 7);
      bridgePolygon([
        bridgeScreenPoint(bridge, longitudinal + (plankWidth * 0.52),
          grainCenter - grainLength),
        bridgeScreenPoint(bridge, longitudinal + (plankWidth * 0.52),
          grainCenter + grainLength),
        bridgeScreenPoint(bridge, longitudinal + (plankWidth * 0.52) + 1,
          grainCenter + grainLength),
        bridgeScreenPoint(bridge, longitudinal + (plankWidth * 0.52) + 1,
          grainCenter - grainLength)
      ], bridgePresentationVariation(bridge, 6, plankOrdinal) > 0.72
        ? '#5b3b2a' : '#c0874f');
      if (plankOrdinal % 3 !== 1) {
        for (const side of [-1, 1]) {
          const nail = bridgeScreenPoint(bridge, longitudinal + 2,
            side * (bridge.halfWidth - 6));
          context.fillStyle = '#3d342d';
          context.fillRect(nail.x, nail.y, 2, 2);
        }
      }
      longitudinal = next;
      plankOrdinal += 1;
    }
  }

  function paintBridgeRails(bridge) {
    for (const side of [-1, 1]) {
      const railPoints = [];
      let longitudinal = -bridge.halfLength;
      let postOrdinal = 0;
      while (longitudinal <= bridge.halfLength) {
        const point = bridgeScreenPoint(bridge, longitudinal, side * (bridge.halfWidth + 2));
        const postHeight = 10 + Math.floor(bridgePresentationVariation(
          bridge, 7, postOrdinal, side
        ) * 5);
        railPoints.push({ x: point.x, y: point.y - postHeight + 2 });
        context.fillStyle = '#493325';
        context.fillRect(point.x - 3, point.y - postHeight, 6, postHeight + 5);
        context.fillStyle = '#9e6b40';
        context.fillRect(point.x - 1, point.y - postHeight + 1, 2, postHeight - 1);
        context.fillStyle = '#c08a55';
        context.fillRect(point.x - 1, point.y - postHeight - 1, 3, 2);
        longitudinal += 19 + Math.floor(bridgePresentationVariation(
          bridge, 8, postOrdinal, side
        ) * 7);
        postOrdinal += 1;
      }
      const end = bridgeScreenPoint(bridge, bridge.halfLength,
        side * (bridge.halfWidth + 2));
      railPoints.push({ x: end.x, y: end.y - 9 });
      context.beginPath();
      railPoints.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.strokeStyle = '#473126';
      context.lineWidth = 6;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.stroke();
      context.strokeStyle = '#9f6b3e';
      context.lineWidth = 2;
      context.stroke();
    }
  }

  function paintTree(placement, elapsedSeconds) {
    const asset = assetsByKey.get(placement.assetKey);
    const originX = Math.round(placement.worldX - camera.x - asset.anchor.x * placement.scale);
    const originY = Math.round(placement.worldY - camera.y - asset.anchor.y * placement.scale);
    const wind = windByPlacementId.get(placement.id);
    if (focusedItem?.kind === 'tree' && placement.id === focusedItem.id) {
      context.beginPath();
      context.ellipse(Math.round(placement.worldX - camera.x),
        Math.round(placement.worldY - camera.y), placement.collisionRadius + 10, 8, 0, 0,
        Math.PI * 2);
      context.fillStyle = 'rgba(255, 239, 164, 0.42)';
      context.fill();
      context.strokeStyle = '#fff0ae';
      context.lineWidth = 2;
      context.stroke();
    }
    for (const layer of spritesByKey.get(placement.assetKey)) {
      if (layer.motionGroups) {
        for (const group of layer.motionGroups) {
          const displacement = forestFoliageMotionGroupDisplacement(
            wind, group, elapsedSeconds, ambientMotionActive
          );
          context.drawImage(group.sprite, originX + displacement, originY,
            asset.dimensions.width * placement.scale, asset.dimensions.height * placement.scale);
        }
      } else {
        context.drawImage(layer.sprite, originX, originY,
          asset.dimensions.width * placement.scale, asset.dimensions.height * placement.scale);
      }
    }
  }

  function paintBoulder(boulder) {
    const x = Math.round(boulder.worldX - camera.x);
    const y = Math.round(boulder.worldY - camera.y);
    const width = boulder.width;
    const height = boulder.height;
    const left = x - Math.floor(width / 2);
    const palette = resolveForestRockPalette(boulder.rockPaletteId)
      || resolveForestRockPalette('mossed-green');
    context.fillStyle = 'rgba(34, 44, 38, 0.28)';
    context.beginPath();
    context.ellipse(x, y + 1, Math.floor(width * 0.55), Math.max(5, Math.floor(height * 0.2)),
      0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = palette.colors.dark;
    context.fillRect(left + 2, y - height + 10, width - 4, height - 10);
    context.fillRect(left + 7, y - height + 5, width - 15, 7);
    context.fillStyle = palette.colors.mid;
    context.fillRect(left + 4, y - height + 8, width - 10, height - 13);
    context.fillRect(left + 10, y - height + 3, width - 21, 8);
    context.fillStyle = palette.colors.light;
    context.fillRect(left + 11, y - height + 4, Math.max(9, width - 25), 5);
    context.fillRect(left + 6, y - height + 10, Math.max(8, Math.floor(width * 0.38)), 4);
    context.fillStyle = palette.colors.dark;
    context.fillRect(left + Math.floor(width * 0.58), y - height + 12, 3, height - 16);
    if (boulder.variantId !== 'low') {
      context.fillRect(left + Math.floor(width * 0.3), y - 8, Math.floor(width * 0.42), 3);
    }
    context.fillStyle = palette.colors.highlight;
    context.fillRect(left + 12, y - height + 4, Math.max(5, Math.floor(width * 0.2)), 2);
    if (boulder.variantId === 'mossy-outcrop') {
      context.fillStyle = palette.colors.accent;
      context.fillRect(left + 5, y - height + 8, 14, 4);
      context.fillRect(left + 9, y - height + 5, 11, 3);
      context.fillStyle = palette.colors.accentLight;
      context.fillRect(left + 11, y - height + 5, 7, 2);
    }
    if (boulder.terrainRole === 'stream-boulder') {
      context.fillStyle = 'rgba(184, 215, 197, 0.56)';
      context.fillRect(left + 3, y - 2, width - 6, 2);
      context.fillStyle = 'rgba(48, 91, 91, 0.48)';
      context.fillRect(left - 3, y + 1, width + 6, 2);
    } else if (boulder.terrainRole === 'bank-boulder') {
      context.fillStyle = 'rgba(52, 82, 66, 0.48)';
      context.fillRect(left + 2, y - 2, width - 4, 2);
      context.fillStyle = 'rgba(113, 143, 112, 0.34)';
      context.fillRect(left + 6, y - 4, Math.max(6, Math.floor(width * 0.38)), 2);
    }
  }

  function paintMarker(marker) {
    const x = Math.round(marker.worldX - camera.x);
    const y = Math.round(marker.worldY - camera.y);
    if (focusedItem?.kind === 'marker' && marker.id === focusedItem.id) {
      context.beginPath();
      context.ellipse(x, y, 19, 8, 0, 0, Math.PI * 2);
      context.fillStyle = 'rgba(255, 239, 164, 0.42)';
      context.fill();
      context.strokeStyle = '#fff0ae';
      context.lineWidth = 2;
      context.stroke();
    }
    context.fillStyle = 'rgba(22, 35, 31, 0.28)';
    context.fillRect(x - 10, y - 3, 20, 5);
    context.fillStyle = '#554638';
    context.fillRect(x - 2, y - 23, 4, 22);
    context.fillStyle = '#d8b45c';
    context.fillRect(x - 8, y - 27, 16, 8);
    context.fillStyle = '#6f4d32';
    context.fillRect(x - 5, y - 25, 10, 2);
  }

  function paintClearingObject(object, preview = false, elapsedSeconds = 0) {
    const x = Math.round(object.worldX - camera.x);
    const y = Math.round(object.worldY - camera.y);
    const valid = !preview || clearingEditor.preview?.valid;
    if (preview || (focusedItem?.id === object.id)) {
      context.beginPath();
      context.ellipse(x, y, object.type === FOREST_STONE_BENCH_TYPE ? 25 : 18, 9,
        0, 0, Math.PI * 2);
      context.fillStyle = valid ? 'rgba(255, 239, 164, 0.38)' : 'rgba(173, 78, 62, 0.42)';
      context.fill();
      context.strokeStyle = valid ? '#fff0ae' : '#842f27';
      context.lineWidth = 2;
      context.stroke();
      if (preview && !valid) {
        context.beginPath();
        context.moveTo(x - 6, y - 6);
        context.lineTo(x + 6, y + 6);
        context.moveTo(x + 6, y - 6);
        context.lineTo(x - 6, y + 6);
        context.stroke();
      }
    }
    context.fillStyle = 'rgba(22, 35, 31, 0.25)';
    context.fillRect(x - 12, y - 3, 24, 5);
    if (object.type === FOREST_TRAIL_SIGN_TYPE) {
      context.fillStyle = '#65462f';
      context.fillRect(x - 2, y - 25, 4, 24);
      context.fillStyle = '#d3ad63';
      context.fillRect(x - 12, y - 29, 24, 9);
      context.fillStyle = '#6d4b32';
      context.fillRect(x - 8, y - 26, 16, 2);
    } else if (object.type === FOREST_STONE_BENCH_TYPE) {
      context.fillStyle = '#aaa58f';
      context.fillRect(x - 19, y - 13, 38, 8);
      context.fillStyle = '#716f68';
      context.fillRect(x - 15, y - 5, 6, 7);
      context.fillRect(x + 9, y - 5, 6, 7);
      context.fillStyle = '#d5cfb8';
      context.fillRect(x - 15, y - 11, 23, 2);
    } else {
      const glow = forestLanternGlowIntensity(object, elapsedSeconds,
        ambientMotionActive && !preview);
      context.fillStyle = `rgba(239, 197, 87, ${glow * 0.38})`;
      context.beginPath();
      context.arc(x, y - 24, 19 + Math.round(glow * 6), 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#5b4932';
      context.fillRect(x - 2, y - 23, 4, 22);
      context.fillStyle = '#e3b94f';
      context.fillRect(x - 7, y - 34, 14, 13);
      context.fillStyle = glow > 0.56 ? '#fff6bd' : '#ffe38a';
      context.fillRect(x - 3, y - 31 - (glow > 0.62 ? 1 : 0), 6,
        7 + (glow > 0.62 ? 1 : 0));
    }
  }

  function paintTrailJoins() {
    const byId = new Map(placedObjects.map((object) => [object.id, object]));
    context.lineWidth = 5;
    context.lineCap = 'round';
    context.strokeStyle = 'rgba(112, 94, 66, 0.36)';
    for (const join of forestSteppingStoneJoins(placedObjects)) {
      const from = byId.get(join.fromId);
      const to = byId.get(join.toId);
      context.beginPath();
      context.moveTo(Math.round(from.worldX - camera.x), Math.round(from.worldY - camera.y));
      context.lineTo(Math.round(to.worldX - camera.x), Math.round(to.worldY - camera.y));
      context.stroke();
    }
  }

  function paintSteppingStone(stone, preview = false) {
    const x = Math.round(stone.worldX - camera.x);
    const y = Math.round(stone.worldY - camera.y);
    context.beginPath();
    context.ellipse(x, y, 13, 6, 0, 0, Math.PI * 2);
    context.fillStyle = preview
      ? (trailEditor.preview?.valid ? 'rgba(238, 224, 181, 0.62)' : 'rgba(173, 78, 62, 0.62)')
      : '#b8aa83';
    context.fill();
    context.strokeStyle = preview
      ? (trailEditor.preview?.valid ? '#fff0ae' : '#842f27') : '#75694f';
    context.lineWidth = preview ? 2 : 1;
    context.stroke();
    if (!preview) {
      context.beginPath();
      context.moveTo(x - 5, y - 1);
      context.lineTo(x + 4, y - 2);
      context.strokeStyle = 'rgba(244, 235, 202, 0.48)';
      context.stroke();
    }
  }

  function paintDiscovery(discovery) {
    const x = Math.round(discovery.worldX - camera.x);
    const y = Math.round(discovery.worldY - camera.y);
    paintDiscoveryGlyph(context, x, y, discovery.material);
    if (focusedItem?.kind === FOREST_DISCOVERY_TYPE && focusedItem.id === discovery.id) {
      context.strokeStyle = '#fff0ae';
      context.lineWidth = 2;
      context.beginPath();
      context.ellipse(x, y, 13, 9, 0, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function paintPlayer() {
    const x = Math.round(player.worldX - camera.x);
    const elevation = crossings.reduce((maximum, bridge) => Math.max(
      maximum, forestBridgeElevationAt(bridge, player)
    ), 0);
    const y = Math.round(player.worldY - camera.y - elevation);
    context.fillStyle = 'rgba(22, 35, 31, 0.28)';
    context.fillRect(x - 8, y - 3, 16, 5);
    context.fillStyle = '#ead9b6';
    context.fillRect(x - 4, y - 19, 8, 8);
    context.fillStyle = '#263b3b';
    context.fillRect(x - 6, y - 12, 12, 11);
    context.fillStyle = '#b96045';
    context.fillRect(x - 7, y - 21, 14, 4);
    context.fillRect(x - 5, y - 24, 10, 3);
  }

  function updateFocus() {
    focusedItem = focusedForestSceneItem(player, scene.placements.filter(
      ({ assetKey }) => assetsByKey.has(assetKey)
    ), placedObjects, scene.exploration.interactionRadius, availableDiscoveries);
    prompt.hidden = !focusedItem || trailEditor.active || clearingEditor.active;
    const action = focusedItem?.kind === FOREST_DISCOVERY_TYPE
      ? `gather ${forestDiscoveryMaterial(focusedItem.value.material).label.toLowerCase()}`
      : focusedItem?.kind === 'marker' ? 'inspect marker' : 'inspect';
    prompt.querySelector('[data-forest-prompt-keyboard]').textContent =
      `Press E or Enter to ${action}`;
    prompt.querySelector('[data-forest-prompt-touch]').textContent = `Tap to ${action}`;
    diagnostics.focus.textContent = focusedItem ? `${focusedItem.kind}: ${focusedItem.id}` : 'None';
  }

  function render(elapsedSeconds, moving = false, frameGap = null) {
    const start = window.performance.now();
    context.imageSmoothingEnabled = false;
    paintGround();
    if (scene.environment?.stream) {
      paintStream(elapsedSeconds);
      crossings.forEach(paintBridgeDeck);
    }
    paintTrailJoins();
    const visibility = visibilityCache.read(camera, player);
    for (const item of visibility.depthOrder) {
      if (item.kind === 'player') paintPlayer();
      else if (item.kind === 'marker') paintMarker(item.object);
      else if (item.kind === FOREST_STEPPING_STONE_TYPE) paintSteppingStone(item.object);
      else if (item.kind === FOREST_DISCOVERY_TYPE) paintDiscovery(item.object);
      else if (item.kind === FOREST_BOULDER_TYPE) paintBoulder(item.object);
      else if (isForestClearingObject(item.object)) {
        if (item.object.id !== clearingEditor.movingId) {
          paintClearingObject(item.object, false, elapsedSeconds);
        }
      }
      else paintTree(item.placement, elapsedSeconds);
    }
    if (trailEditor.active && trailEditor.preview) {
      paintSteppingStone(trailEditor.preview.stone, true);
    }
    if (clearingEditor.active && clearingEditor.preview) {
      paintClearingObject(clearingEditor.preview.object, true, elapsedSeconds);
    }
    crossings.forEach(paintBridgeRails);
    const { visible, visibleObjects } = visibility;
    diagnostics.visible.textContent = `${visible.length} / ${scene.placements.length} trees · ${
      visibleObjects.filter(({ type }) => type === 'marker').length} markers · ${
      visibleObjects.filter(({ type }) => type === FOREST_STEPPING_STONE_TYPE).length} stones · ${
      visibleObjects.filter(isForestClearingObject).length} clearing objects · ${
      visibleObjects.filter(({ type }) => type === FOREST_DISCOVERY_TYPE).length} discoveries · ${
      visibleObjects.filter(({ type }) => type === FOREST_BOULDER_TYPE).length} boulders`;
    diagnostics.camera.textContent = `${camera.x}, ${camera.y}`;
    diagnostics.player.textContent = `${Math.round(player.worldX)}, ${Math.round(player.worldY)}`;
    if (scene.environment && diagnostics.environmentPlayer) {
      const environment = forestEnvironmentAt(scene.environment, {
        worldX: Math.round(player.worldX), worldY: Math.round(player.worldY)
      });
      const bridgeElevation = crossings.reduce((maximum, bridge) => Math.max(
        maximum, forestBridgeElevationAt(bridge, player)
      ), 0);
      diagnostics.environmentPlayer.textContent = `${environment.dominantRegionId} · ${
        environment.groundSurfaceId} · ${environment.habitatId} · ${
        environment.transition.state} · ${environment.hydrology.state} (${
        environment.transition.rockyBlendPermille}‰ rocky)${
        bridgeElevation > 0 ? ` · bridge +${bridgeElevation} px` : ''}`;
    }
    const duration = window.performance.now() - start;
    diagnostics.duration.textContent = `${duration.toFixed(1)} ms`;

    let newlySeen = [];
    let newlySeenAssets = null;
    if (visibility.revision !== lastSeenVisibilityRevision) {
      lastSeenVisibilityRevision = visibility.revision;
      newlySeen = visible.filter(({ id }) => !seenPlacementIds.has(id));
      newlySeenAssets = new Set(newlySeen.map(({ assetKey }) => assetKey)
        .filter((assetKey) => !seenAssetKeys.has(assetKey)));
      visible.forEach(({ id, assetKey }) => {
        seenPlacementIds.add(id);
        seenAssetKeys.add(assetKey);
      });
    }

    if (moving) {
      movementRenders.count += 1;
      movementRenders.total += duration;
      movementRenders.maximum = Math.max(movementRenders.maximum, duration);
      diagnostics.movementDuration.textContent = `${duration.toFixed(1)} ms last / ${
        (movementRenders.total / movementRenders.count).toFixed(1)} ms avg / ${
        movementRenders.maximum.toFixed(1)} ms max`;
      if (newlySeen.length) {
        diagnostics.regionEntry.textContent = `${newlySeen.length} new placements / ${
          newlySeenAssets.size} new assets · ${duration.toFixed(1)} ms render · ${
          frameGap === null ? 'first movement frame' : `${frameGap.toFixed(1)} ms frame gap`}`;
      }
    } else if (ambientMotionActive) {
      ambientRenders.count += 1;
      ambientRenders.total += duration;
      ambientRenders.maximum = Math.max(ambientRenders.maximum, duration);
      diagnostics.ambientDuration.textContent = `${ambientRenders.count} renders · ${
        duration.toFixed(1)} ms last / ${
        (ambientRenders.total / ambientRenders.count).toFixed(1)} ms avg / ${
        ambientRenders.maximum.toFixed(1)} ms max`;
    }

    if (!firstRenderRecorded) {
      firstRenderRecorded = true;
      const renderFinishedAt = window.performance.now();
      diagnostics.firstRender.textContent = `${renderFinishedAt.toFixed(1)} ms after navigation (${
        (renderFinishedAt - scriptStartedAt).toFixed(1)} ms in scene script)`;
    }
  }

  function hasMovement() {
    return keys.left || keys.right || keys.up || keys.down || touch.x || touch.y;
  }

  function movementDirection() {
    if (touch.x || touch.y) return { x: touch.x, y: touch.y };
    return normalizedMovement(keys);
  }

  function frame(timestamp) {
    scheduledFrame = null;
    const frameGap = lastFrameTime === null ? null : timestamp - lastFrameTime;
    if (lastFrameTime === null) lastFrameTime = timestamp;
    const elapsed = Math.min(0.05, (timestamp - lastFrameTime) / 1000);
    lastFrameTime = timestamp;
    const moving = hasMovement() && !dialog.open && !objectDialog.open && !forestMenu.open;
    if (moving) {
      Object.assign(player, moveForestPlayer(player, movementDirection(), elapsed,
        scene.world, [...scene.placements, ...terrainFeatures,
          ...forestSolidClearingPlacements(placedObjects)], scene));
      followPlayer();
      updateFocus();
      if (trailEditor.active && trailEditor.tool !== 'remove') {
        previewTrailAt(player.worldX, player.worldY, false);
      }
      if (clearingEditor.active) {
        previewClearingAt(player.worldX, player.worldY - 56, false);
      }
    }
    render(timestamp / 1000, moving, frameGap);
    if (moving || ambientMotionActive) scheduledFrame = requestAnimationFrame(frame);
    else lastFrameTime = null;
  }

  function requestRender() {
    if (scheduledFrame === null) scheduledFrame = requestAnimationFrame(frame);
  }

  function clearMovement() {
    Object.keys(keys).forEach((key) => { keys[key] = false; });
    touch.pointerId = null;
    touch.x = 0;
    touch.y = 0;
    touch.maximumDistance = 0;
    joystick.hidden = true;
    joystickStick.style.transform = '';
    lastFrameTime = null;
  }

  function updateAmbientMotion() {
    const nextActive = forestAmbientMotionActive({
      documentHidden: document.hidden,
      reducedMotion: reducedMotionQuery.matches
    });
    if (document.hidden) clearMovement();
    ambientMotionActive = nextActive;
    if (document.hidden && scheduledFrame !== null) {
      cancelAnimationFrame(scheduledFrame);
      scheduledFrame = null;
      lastFrameTime = null;
    }
    if (!document.hidden) requestRender();
  }

  function updateTouchMovement(event) {
    const deltaX = event.clientX - touch.originX;
    const deltaY = event.clientY - touch.originY;
    touch.maximumDistance = Math.max(touch.maximumDistance, Math.hypot(deltaX, deltaY));
    Object.assign(touch, touchMovement(deltaX, deltaY));
    const distance = Math.min(34, Math.hypot(deltaX, deltaY));
    const angle = Math.atan2(deltaY, deltaX);
    joystickStick.style.transform = `translate(${Math.cos(angle) * distance}px, ${
      Math.sin(angle) * distance}px)`;
    requestRender();
  }

  function stopTouchMovement(event) {
    if (touch.pointerId === null || (event && event.pointerId !== touch.pointerId)) return;
    touch.pointerId = null;
    touch.x = 0;
    touch.y = 0;
    touch.maximumDistance = 0;
    joystick.hidden = true;
    joystickStick.style.transform = '';
    lastFrameTime = null;
  }

  function finishTouchMovement(event) {
    if (touch.pointerId === null || event.pointerId !== touch.pointerId) return;
    const deltaX = event.clientX - touch.originX;
    const deltaY = event.clientY - touch.originY;
    const intent = forestTouchGestureIntent(Math.max(
      touch.maximumDistance, Math.hypot(deltaX, deltaY)
    ));
    const viewportRect = viewportElement.getBoundingClientRect();
    const worldX = camera.x + event.clientX - viewportRect.left;
    const worldY = camera.y + event.clientY - viewportRect.top;
    stopTouchMovement(event);
    if (intent !== 'tap') return;
    if (clearingEditor.active) {
      commitClearingPlacement();
    } else if (trailEditor.active) {
      commitTrailAt(worldX, worldY);
      viewportElement.focus();
    }
  }

  function reportPickup(message, failed = false) {
    lastPickupResult = message;
    diagnostics.pickup.textContent = message;
    pickupFeedback.textContent = message;
    pickupFeedback.dataset.failed = String(failed);
    pickupFeedback.hidden = false;
    if (pickupFeedbackTimer !== null) window.clearTimeout(pickupFeedbackTimer);
    pickupFeedbackTimer = window.setTimeout(() => {
      pickupFeedback.hidden = true;
      pickupFeedbackTimer = null;
    }, reducedMotionQuery.matches ? 1800 : 2600);
  }

  function collectDiscovery(discovery) {
    const result = forestDiscoveryStateAfterPickup(
      discoveryState, discovery, discoveryOffering
    );
    if (!result.valid) {
      reportPickup(`Pickup rejected: ${result.reason}.`, true);
      return false;
    }
    try {
      discoveryPersistence.save(result.state);
    } catch (error) {
      reportPickup(`Pickup not saved: ${error.message}`, true);
      return false;
    }
    discoveryState = result.state;
    availableDiscoveries = availableForestDiscoveries(discoveryOffering, discoveryState);
    setDiscoveryObjects();
    const material = forestDiscoveryMaterial(discovery.material);
    reportPickup(`${material.label} gathered · ${discoveryState.inventory[discovery.material]} in satchel`);
    updateDiscoverySurfaces();
    updateFocus();
    requestRender();
    return true;
  }

  function openForestMenu() {
    if (forestMenu.open) return;
    clearMovement();
    if (clearingEditor.active) stopClearingPlacement(false);
    if (trailEditor.active) toggleTrailEditor(false);
    forestMenuButton.setAttribute('aria-expanded', 'true');
    forestMenu.showModal();
    forestMenu.querySelector('[data-forest-menu-close]').focus();
  }

  function closeForestMenu() {
    if (forestMenu.open) forestMenu.close();
  }

  function renewDiscoveries() {
    const result = renewForestDiscoveryState(discoveryState, discoveryOffering);
    if (!result.valid) {
      reportPickup(`Renewal unavailable: ${result.reason}.`, true);
      return;
    }
    try {
      discoveryPersistence.save(result.state);
    } catch (error) {
      reportPickup(`Renewal not saved: ${error.message}`, true);
      return;
    }
    discoveryState = result.state;
    regenerateDiscoveryOffering();
    updateFocus();
    reportPickup(`The forest has offered ${FOREST_DISCOVERY_OFFERING_COUNT} more small finds.`);
    requestRender();
  }

  function resetDiscoveries() {
    if (placedObjects.some(isForestClearingObject)) {
      reportPickup('Remove clearing objects before resetting gathered materials.', true);
      return;
    }
    try {
      discoveryState = discoveryPersistence.reset(scene.baseIdentity);
    } catch (error) {
      reportPickup(`Satchel reset failed: ${error.message}`, true);
      return;
    }
    regenerateDiscoveryOffering();
    updateFocus();
    reportPickup('Satchel and discovery progress reset for this generated forest.');
    requestRender();
  }

  function openInspection() {
    if (!focusedItem || dialog.open) return;
    clearMovement();
    if (isForestClearingObject(focusedItem.value)) {
      selectedClearingObjectId = focusedItem.id;
      const object = focusedItem.value;
      const definition = FOREST_CLEARING_OBJECT_DEFINITIONS[object.type];
      objectDialog.querySelector('[data-forest-object-title]').textContent = definition.label;
      objectDialog.querySelector('[data-forest-object-description]').textContent =
        object.type === FOREST_TRAIL_SIGN_TYPE
          ? (object.text || 'An unnamed sign points quietly through the clearing.')
          : object.type === FOREST_STONE_BENCH_TYPE
            ? 'A quiet place to sit or reflect.'
            : 'A gentle seed-pod glow flickers like a small flame.';
      const sign = object.type === FOREST_TRAIL_SIGN_TYPE;
      objectDialog.querySelector('[data-forest-sign-editor]').hidden = true;
      objectDialog.querySelector('[data-forest-object-edit]').hidden = !sign;
      objectDialog.querySelector('[data-forest-bench-writing]').hidden = true;
      objectDialog.querySelector('[data-forest-bench-reflect]').hidden =
        object.type !== FOREST_STONE_BENCH_TYPE;
      selectedBenchWriting = object.type === FOREST_STONE_BENCH_TYPE
        ? nearbyForestWritingForBench(object, scene.placements, scene.exploration.fixtures)
        : null;
      diagnostics.benchWriting.textContent = selectedBenchWriting
        ? `${selectedBenchWriting.benchId} · ${selectedBenchWriting.qualifyingPlacementCount} nearby placements · ${
          selectedBenchWriting.candidates.map(({ fixtureId }) => fixtureId).join(', ') || 'no candidates'}`
        : 'No bench selected';
      if (sign) objectDialog.querySelector('[data-forest-sign-text]').value = object.text;
      objectDialog.showModal();
      return;
    }
    if (focusedItem.kind === 'marker') {
      dialog.querySelector('[data-forest-dialog-eyebrow]').textContent = 'A place made personal';
      dialog.querySelector('[data-forest-post-title]').textContent = 'Your clearing marker';
      dialog.querySelector('[data-forest-dialog-context]').hidden = true;
      dialog.querySelector('[data-forest-tree-meaning]').hidden = true;
      dialog.querySelector('[data-forest-post-excerpt]').textContent =
        'This simple marker is stored in the personal overlay, independently of the generated trees.';
      dialog.showModal();
      return;
    }
    const fixture = fixturesById.get(focusedItem.value.fixtureId);
    openFixtureWriting(fixture, 'A writing remembered here');
  }

  function openFixtureWriting(fixture, eyebrow) {
    if (!fixture) return;
    dialog.querySelector('[data-forest-dialog-eyebrow]').textContent = eyebrow;
    dialog.querySelector('[data-forest-dialog-context]').hidden = false;
    dialog.querySelector('[data-forest-post-title]').textContent = fixture.title;
    dialog.querySelector('[data-forest-post-room]').textContent = fixture.roomName;
    dialog.querySelector('[data-forest-post-date]').textContent = new Intl.DateTimeFormat(undefined,
      { dateStyle: 'long' }).format(new Date(`${fixture.createdAt}T12:00:00Z`));
    dialog.querySelector('[data-forest-post-excerpt]').textContent = fixture.excerpt;
    const meaning = fixture.treeMeaning;
    const meaningSurface = dialog.querySelector('[data-forest-tree-meaning]');
    meaningSurface.hidden = !meaning;
    if (meaning) {
      meaningSurface.querySelector('[data-forest-meaning-phenotype]').textContent =
        meaning.phenotypeId;
      meaningSurface.querySelector('[data-forest-meaning-seed]').textContent =
        String(meaning.specimenSeed);
      meaningSurface.querySelector('[data-forest-meaning-habitat]').textContent =
        meaning.habitat.replaceAll('-', ' ');
      meaningSurface.querySelector('[data-forest-meaning-tint]').textContent =
        `${meaning.creationSeason} · ${meaning.foliagePaletteId || 'seed-selected'}`;
      const reasons = meaningSurface.querySelector('[data-forest-meaning-reasons]');
      reasons.replaceChildren(...meaning.explanations.map((explanation) => {
        const item = document.createElement('li');
        item.textContent = explanation.text;
        return item;
      }));
    }
    dialog.showModal();
  }

  function showNearbyBenchWriting() {
    if (!selectedBenchWriting || !objectDialog.open) return;
    const surface = objectDialog.querySelector('[data-forest-bench-writing]');
    const firstCandidate = renderNearbyForestWritingCandidates(
      surface, selectedBenchWriting, (candidate) => {
        diagnostics.benchResurfaced.textContent =
          `${candidate.fixtureId} via ${selectedBenchWriting.benchId}`;
        objectDialog.close();
        openFixtureWriting(
          fixturesById.get(candidate.fixtureId) || candidate.fixture,
          'Writing reflected from nearby trees'
        );
      }
    );
    objectDialog.querySelector('[data-forest-bench-reflect]').hidden = true;
    (firstCandidate || objectDialog.querySelector('[data-forest-object-move]')).focus();
  }

  function activateFocusedItem() {
    if (focusedItem?.kind === FOREST_DISCOVERY_TYPE) collectDiscovery(focusedItem.value);
    else openInspection();
  }

  function setOverlay(nextOverlay, status) {
    const application = applyForestOverlay(scene, nextOverlay);
    if (application.error) {
      updateOverlayDiagnostic('rejected', application.error);
      return false;
    }
    overlay = nextOverlay;
    overlayApplication = application;
    placedObjects = application.objects;
    regenerateDiscoveryOffering();
    updateOverlayDiagnostic(status, null);
    updateFocus();
    requestRender();
    return true;
  }

  const clearingReasonText = {
    'world-bounds': 'That object would cross the edge of the world.',
    'tree-collision': 'That position overlaps a tree.',
    'terrain-feature-collision': 'That position overlaps a boulder.',
    'water-or-bank-surface': 'Keep clearing objects on dry ground away from the stream bank.',
    'tree-interaction-space': 'Keep writing-tree interaction space clear.',
    'entrance-collision': 'Keep the entrance and spawn clear.',
    'protected-entrance': 'Keep the entrance and spawn clear.',
    'player-collision': 'Place it a little farther from the player.',
    'object-collision': 'That position overlaps another overlay object.',
    'clearing-object-spacing': 'Leave enough room to see and use each clearing object.',
    'discovery-collision': 'That position overlaps a discovery.',
    'insufficient-materials': 'Those materials are not currently available.',
    'clearing-object-limit': 'This experiment allows at most nine clearing objects.',
    'clearing-object-type-limit': 'This experiment allows at most three of each object.',
    'clearing-object-not-found': 'That clearing object is no longer present.'
  };

  function reportClearing(message, action = message, failed = false) {
    clearingStatus.textContent = message;
    lastClearingAction = action;
    updateDiscoverySurfaces();
    reportPickup(message, failed);
  }

  function previewClearingAt(worldX, worldY, shouldRender = true) {
    if (!clearingEditor.active) return;
    const existing = clearingEditor.movingId
      ? placedObjects.find(({ id }) => id === clearingEditor.movingId) : null;
    const id = existing?.id || nextForestClearingObjectId(overlay, clearingEditor.type);
    if (!id) {
      clearingEditor.preview = null;
      reportClearing('This object type has reached its limit.', 'rejected: type limit', true);
      return;
    }
    clearingEditor.preview = createForestClearingPlacementPreview(
      clearingEditor.type, worldX, worldY, id, scene,
      placedObjects.filter(({ id: objectId }) => objectId !== id), availableDiscoveries,
      player, existing?.text || ''
    );
    const result = clearingEditor.preview;
    clearingStatus.textContent = result.valid
      ? (clearingEditor.movingId
        ? 'Carrying on valid ground. Tap, press Enter, or choose Drop here to set it down.'
        : 'Valid position. Click, tap, or press Enter to save.')
      : (clearingReasonText[result.reason] || result.reason);
    if (shouldRender) requestRender();
  }

  function stopClearingPlacement(returnFocus = true) {
    clearingEditor.active = false;
    clearingEditor.type = null;
    clearingEditor.preview = null;
    clearingEditor.movingId = null;
    clearingTools.hidden = true;
    clearingTools.querySelector('[data-forest-clearing-commit]').textContent = 'Place here';
    updateDiscoverySurfaces();
    updateFocus();
    if (returnFocus) viewportElement.focus();
    requestRender();
  }

  function beginClearingPlacement(type, movingId = null) {
    if (!FOREST_CLEARING_OBJECT_TYPES.includes(type)) return;
    if (trailEditor.active) toggleTrailEditor(false);
    clearMovement();
    clearingEditor.active = true;
    clearingEditor.type = type;
    clearingEditor.movingId = movingId;
    clearingTools.hidden = false;
    clearingTools.querySelector('[data-forest-clearing-mode]').textContent = movingId
      ? `Moving ${FOREST_CLEARING_OBJECT_DEFINITIONS[type].label}`
      : `Placing ${FOREST_CLEARING_OBJECT_DEFINITIONS[type].label}`;
    clearingTools.querySelector('[data-forest-clearing-commit]').textContent = movingId
      ? 'Drop here' : 'Place here';
    previewClearingAt(player.worldX, player.worldY - 56, false);
    updateDiscoverySurfaces();
    updateFocus();
    viewportElement.focus();
    requestRender();
  }

  function saveClearingResult(result, action) {
    if (!result.valid) {
      reportClearing(clearingReasonText[result.reason] || result.reason,
        `rejected: ${result.reason}`, true);
      return false;
    }
    try {
      overlayPersistence.save(result.overlay);
    } catch (error) {
      reportClearing(`Save failed; nothing changed: ${error.message}`,
        'persistence failure', true);
      return false;
    }
    setOverlay(result.overlay, `clearing object ${action}`);
    reportClearing(`Clearing object ${action}.`, action);
    stopClearingPlacement();
    return true;
  }

  function commitClearingPlacement() {
    if (!clearingEditor.preview?.valid) {
      if (clearingEditor.preview) reportClearing(
        clearingReasonText[clearingEditor.preview.reason] || clearingEditor.preview.reason,
        `rejected: ${clearingEditor.preview.reason}`, true
      );
      return;
    }
    const result = overlayWithForestClearingObject(
      overlay, clearingEditor.preview.object, scene, discoveryState.inventory,
      availableDiscoveries, player
    );
    saveClearingResult(result, clearingEditor.movingId ? 'moved' : 'placed');
  }

  function saveSelectedSignText() {
    const existing = placedObjects.find(({ id }) => id === selectedClearingObjectId);
    if (!existing || existing.type !== FOREST_TRAIL_SIGN_TYPE) return;
    const normalized = normalizeForestSignText(
      objectDialog.querySelector('[data-forest-sign-text]').value
    );
    if (!normalized.valid) {
      reportClearing(`Sign not saved: ${normalized.reason}.`, 'sign edit rejected', true);
      return;
    }
    const candidate = createForestClearingObject(existing.type, existing.worldX,
      existing.worldY, existing.id, normalized.text);
    const result = overlayWithForestClearingObject(
      overlay, candidate, scene, discoveryState.inventory, availableDiscoveries
    );
    if (saveClearingResult(result, 'sign edited')) objectDialog.close();
  }

  function setSelectedSignEditing(active) {
    const existing = placedObjects.find(({ id }) => id === selectedClearingObjectId);
    const editable = existing?.type === FOREST_TRAIL_SIGN_TYPE;
    const editor = objectDialog.querySelector('[data-forest-sign-editor]');
    const editButton = objectDialog.querySelector('[data-forest-object-edit]');
    editor.hidden = !editable || !active;
    editButton.hidden = !editable || active;
    if (editable && active) {
      const input = objectDialog.querySelector('[data-forest-sign-text]');
      input.value = existing.text;
      input.focus();
    } else if (editable && objectDialog.open) {
      editButton.focus();
    }
  }

  function removeSelectedClearingObject() {
    const result = overlayWithoutForestClearingObject(overlay, selectedClearingObjectId);
    if (!result.valid) {
      reportClearing(clearingReasonText[result.reason] || result.reason,
        'removal rejected', true);
      return;
    }
    try {
      overlayPersistence.save(result.overlay);
    } catch (error) {
      reportClearing(`Removal not saved; object and materials are unchanged: ${error.message}`,
        'persistence failure', true);
      return;
    }
    setOverlay(result.overlay, 'clearing object removed and refunded');
    reportClearing('Object removed. Its complete fixed cost is available again.',
      'removed and fully refunded');
    objectDialog.close();
  }

  const trailReasonText = {
    'world-bounds': 'That stone would cross the edge of the world.',
    'tree-collision': 'That position overlaps a tree.',
    'terrain-feature-collision': 'That position overlaps a boulder.',
    'water-or-bank-surface': 'Keep personal trail stones on dry ground away from the stream bank.',
    'protected-entrance': 'Keep the entrance clearing open.',
    'entrance-collision': 'Keep the entrance clearing open.',
    'tree-interaction-space': 'That stone is too close to the tree trunk.',
    'object-collision': 'That position overlaps another overlay object.',
    'stone-too-close': 'Stones must be at least 26 px apart.',
    'trail-gap': 'Keep each new stone within 96 px of the trail.',
    'stone-limit': 'This focused trail is limited to 12 stones.',
    'trail-disconnected': 'That edit would split the trail.',
    'stone-not-found': 'Choose an existing stepping stone.'
  };

  function trailStones() {
    return placedObjects.filter(({ type }) => type === FOREST_STEPPING_STONE_TYPE);
  }

  function nearestTrailStone(worldX, worldY, maximumDistance = 70) {
    return trailStones().map((stone) => ({ stone, distance: Math.hypot(
      worldX - stone.worldX, worldY - stone.worldY
    ) })).filter(({ distance }) => distance <= maximumDistance)
      .sort((left, right) => left.distance - right.distance
        || left.stone.id.localeCompare(right.stone.id))[0]?.stone || null;
  }

  function reportTrail(message, validity = '') {
    trailStatus.textContent = message;
    diagnostics.trail.textContent = `${trailEditor.active ? trailEditor.tool : 'Off'}${
      validity ? ` · ${validity}` : ''}`;
  }

  function updateTrailControls() {
    trailTools.hidden = !trailEditor.active;
    trailToggle.setAttribute('aria-pressed', String(trailEditor.active));
    trailToggle.textContent = trailEditor.active ? 'Editing trail' : 'Edit trail';
    trailModeLabel.textContent = `Trail editing: ${trailEditor.tool}`;
    for (const tool of ['place', 'move', 'remove']) {
      document.querySelector(`[data-forest-trail-${tool}]`).setAttribute(
        'aria-pressed', String(trailEditor.tool === tool)
      );
    }
  }

  function setTrailTool(tool) {
    trailEditor.tool = tool;
    trailEditor.movingId = tool === 'move'
      ? nearestTrailStone(player.worldX, player.worldY)?.id || null : null;
    trailEditor.preview = null;
    updateTrailControls();
    if (tool === 'move' && !trailEditor.movingId) {
      reportTrail('Stand near a stone, then choose Move nearest.', 'no nearby stone');
    } else if (tool === 'remove') {
      reportTrail('Choose a stone to remove. Removal is rejected if it would split the trail.');
    } else {
      reportTrail(tool === 'move' ? 'Choose a new clear position for the selected stone.'
        : 'Choose clear ground; connected stones stay 26–96 px apart.');
    }
    requestRender();
  }

  function toggleTrailEditor(force) {
    if (!trailEditor.active && force !== false && clearingEditor.active) {
      stopClearingPlacement(false);
    }
    trailEditor.active = typeof force === 'boolean' ? force : !trailEditor.active;
    trailEditor.preview = null;
    trailEditor.movingId = null;
    clearMovement();
    updateTrailControls();
    if (trailEditor.active) setTrailTool('place');
    else reportTrail('Off');
    updateFocus();
    viewportElement.focus();
    requestRender();
  }

  function previewTrailAt(worldX, worldY, shouldRender = true) {
    if (!trailEditor.active || trailEditor.tool === 'remove') return;
    const id = trailEditor.tool === 'move'
      ? trailEditor.movingId : nextForestSteppingStoneId(overlay);
    if (!id) {
      trailEditor.preview = null;
      reportTrail(trailReasonText['stone-limit'], 'invalid: stone-limit');
      return;
    }
    const otherObjects = placedObjects.filter(({ id: objectId }) => objectId !== id);
    trailEditor.preview = createForestTrailPlacementPreview(
      worldX, worldY, id, scene, otherObjects
    );
    const validity = trailEditor.preview;
    reportTrail(validity.valid ? 'Valid position. Click or press Enter to save.'
      : (trailReasonText[validity.reason] || validity.reason),
    validity.valid ? 'valid preview' : `invalid: ${validity.reason}`);
    if (shouldRender) requestRender();
  }

  function saveTrailResult(result, action) {
    if (!result.valid) {
      reportTrail(trailReasonText[result.reason] || result.reason, `rejected: ${result.reason}`);
      return false;
    }
    try {
      overlayPersistence.save(result.overlay);
    } catch (error) {
      reportTrail(`Save failed: ${error.message}`, 'save failed');
      return false;
    }
    setOverlay(result.overlay, `trail ${action} saved locally`);
    trailEditor.preview = null;
    if (trailEditor.tool === 'move') trailEditor.movingId = null;
    reportTrail(`Stone ${action}. The overlay is saved locally.`, action);
    return true;
  }

  function commitTrailAt(worldX, worldY) {
    if (trailEditor.tool === 'remove') {
      const stone = nearestTrailStone(worldX, worldY);
      if (!stone) {
        reportTrail('Choose a nearby stepping stone.', 'invalid: stone-not-found');
        return;
      }
      saveTrailResult(overlayWithoutForestSteppingStone(overlay, stone.id), 'removed');
      return;
    }
    if (trailEditor.tool === 'move' && !trailEditor.movingId) {
      const stone = nearestTrailStone(worldX, worldY);
      if (!stone) {
        reportTrail('Choose a nearby stepping stone to move.', 'invalid: stone-not-found');
        return;
      }
      trailEditor.movingId = stone.id;
      reportTrail(`Selected ${stone.id}. Choose its new clear position.`, 'stone selected');
      return;
    }
    previewTrailAt(worldX, worldY);
    if (!trailEditor.preview?.valid) return;
    saveTrailResult(overlayWithForestSteppingStone(
      overlay, trailEditor.preview.stone, scene
    ), trailEditor.tool === 'move' ? 'moved' : 'placed');
  }

  function placeMarker() {
    const marker = createForestMarker(player.worldX, player.worldY);
    const placement = validateForestObjectPlacement(marker, scene, placedObjects);
    if (!placement.valid) {
      updateOverlayDiagnostic('placement rejected', placement.reason);
      return;
    }
    const nextOverlay = overlayWithForestMarker(overlay, marker);
    try {
      overlayPersistence.save(nextOverlay);
    } catch (error) {
      updateOverlayDiagnostic('save failed', error.message);
      return;
    }
    setOverlay(nextOverlay, 'saved locally');
    viewportElement.focus();
  }

  function resetOverlay() {
    let emptyOverlay;
    try {
      emptyOverlay = overlayPersistence.reset(scene.baseIdentity);
    } catch (error) {
      updateOverlayDiagnostic('reset failed', error.message);
      return;
    }
    setOverlay(emptyOverlay, 'reset');
    stopClearingPlacement(false);
    trailEditor.preview = null;
    trailEditor.movingId = null;
    if (trailEditor.active) setTrailTool('place');
    viewportElement.focus();
  }

  function resetPlayer() {
    clearMovement();
    Object.assign(player, scene.exploration.spawn);
    followPlayer();
    updateFocus();
    requestRender();
    viewportElement.focus();
  }

  function resize() {
    const rect = viewportElement.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(rect.width));
    const nextHeight = Math.max(1, Math.round(rect.height));
    if (canvas.width === nextWidth && canvas.height === nextHeight) return;
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    camera.width = nextWidth;
    camera.height = nextHeight;
    followPlayer();
    requestRender();
  }

  const directionForKey = {
    arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
    arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down'
  };
  viewportElement.addEventListener('keydown', (event) => {
    const direction = directionForKey[event.key.toLowerCase?.() || event.key];
    if (direction) {
      event.preventDefault();
      keys[direction] = true;
      requestRender();
    } else if ((event.key === 't' || event.key === 'T')) {
      event.preventDefault();
      toggleTrailEditor();
    } else if (clearingEditor.active && event.key === 'Escape') {
      event.preventDefault();
      reportClearing('Placement cancelled.', 'cancelled');
      stopClearingPlacement();
    } else if (clearingEditor.active && event.key === 'Enter') {
      event.preventDefault();
      commitClearingPlacement();
    } else if (trailEditor.active && (event.key === 'p' || event.key === 'P')) {
      event.preventDefault();
      setTrailTool('place');
        previewTrailAt(player.worldX, player.worldY, false);
    } else if (trailEditor.active && (event.key === 'm' || event.key === 'M')) {
      event.preventDefault();
      setTrailTool('move');
      previewTrailAt(player.worldX, player.worldY);
    } else if (trailEditor.active && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      setTrailTool('remove');
      commitTrailAt(player.worldX, player.worldY);
    } else if (trailEditor.active && event.key === 'Escape') {
      event.preventDefault();
      toggleTrailEditor(false);
    } else if (trailEditor.active && event.key === 'Enter') {
      event.preventDefault();
      commitTrailAt(trailEditor.preview?.stone.worldX ?? player.worldX,
        trailEditor.preview?.stone.worldY ?? player.worldY);
    } else if ((event.key === 'e' || event.key === 'E' || event.key === 'Enter')
      && focusedItem) {
      event.preventDefault();
      activateFocusedItem();
    }
  });
  viewportElement.addEventListener('keyup', (event) => {
    const direction = directionForKey[event.key.toLowerCase?.() || event.key];
    if (direction) {
      event.preventDefault();
      keys[direction] = false;
    }
  });
  viewportElement.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && clearingEditor.active
      && !event.target.closest('button') && !dialog.open
      && !objectDialog.open && !forestMenu.open) {
      event.preventDefault();
      const viewportRect = viewportElement.getBoundingClientRect();
      previewClearingAt(camera.x + event.clientX - viewportRect.left,
        camera.y + event.clientY - viewportRect.top, false);
      commitClearingPlacement();
      return;
    }
    if (event.pointerType === 'mouse' && trailEditor.active
      && !event.target.closest('button') && !dialog.open && !forestMenu.open) {
      event.preventDefault();
      const viewportRect = viewportElement.getBoundingClientRect();
      commitTrailAt(camera.x + event.clientX - viewportRect.left,
        camera.y + event.clientY - viewportRect.top);
      viewportElement.focus();
      return;
    }
    if (event.pointerType === 'mouse' || event.target.closest('button') || dialog.open
      || forestMenu.open) return;
    event.preventDefault();
    touch.pointerId = event.pointerId;
    touch.originX = event.clientX;
    touch.originY = event.clientY;
    touch.x = 0;
    touch.y = 0;
    touch.maximumDistance = 0;
    const viewportRect = viewportElement.getBoundingClientRect();
    joystick.style.left = `${event.clientX - viewportRect.left}px`;
    joystick.style.top = `${event.clientY - viewportRect.top}px`;
    joystick.hidden = false;
    viewportElement.setPointerCapture(event.pointerId);
    viewportElement.focus();
  });
  viewportElement.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse' && clearingEditor.active) {
      const viewportRect = viewportElement.getBoundingClientRect();
      previewClearingAt(camera.x + event.clientX - viewportRect.left,
        camera.y + event.clientY - viewportRect.top);
      return;
    }
    if (event.pointerType === 'mouse' && trailEditor.active) {
      const viewportRect = viewportElement.getBoundingClientRect();
      previewTrailAt(camera.x + event.clientX - viewportRect.left,
        camera.y + event.clientY - viewportRect.top);
      return;
    }
    if (event.pointerId !== touch.pointerId) return;
    event.preventDefault();
    updateTouchMovement(event);
  });
  viewportElement.addEventListener('pointerup', finishTouchMovement);
  viewportElement.addEventListener('pointercancel', stopTouchMovement);
  viewportElement.addEventListener('lostpointercapture', stopTouchMovement);
  window.addEventListener('blur', clearMovement);
  document.addEventListener('visibilitychange', updateAmbientMotion);
  reducedMotionQuery.addEventListener('change', updateAmbientMotion);
  dialog.addEventListener('close', () => {
    clearMovement();
    viewportElement.focus();
    requestRender();
  });
  objectDialog.addEventListener('close', () => {
    clearMovement();
    objectDialog.querySelector('[data-forest-sign-editor]').hidden = true;
    objectDialog.querySelector('[data-forest-object-edit]').hidden = true;
    objectDialog.querySelector('[data-forest-bench-reflect]').hidden = true;
    objectDialog.querySelector('[data-forest-bench-writing]').hidden = true;
    selectedClearingObjectId = null;
    selectedBenchWriting = null;
    viewportElement.focus();
    requestRender();
  });
  dialog.querySelector('[data-forest-dialog-close]').addEventListener('click', () => dialog.close());
  prompt.addEventListener('click', () => {
    if (!trailEditor.active) activateFocusedItem();
  });
  forestMenu.addEventListener('close', () => {
    clearMovement();
    forestMenuButton.setAttribute('aria-expanded', 'false');
    viewportElement.focus();
    requestRender();
  });
  forestMenuButton.addEventListener('click', openForestMenu);
  forestMenu.querySelector('[data-forest-menu-close]').addEventListener('click', closeForestMenu);
  forestMenu.querySelector('[data-forest-renew-discoveries]').addEventListener(
    'click', renewDiscoveries
  );
  forestMenu.querySelector('[data-forest-reset-discoveries]').addEventListener(
    'click', resetDiscoveries
  );
  forestMenu.querySelectorAll('[data-forest-build]').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.forestBuild;
      closeForestMenu();
      beginClearingPlacement(type);
    });
  });
  document.querySelector('[data-forest-reset]').addEventListener('click', resetPlayer);
  trailToggle.addEventListener('click', () => {
    closeForestMenu();
    toggleTrailEditor();
  });
  document.querySelector('[data-forest-trail-place]').addEventListener('click', () => {
    setTrailTool('place');
    viewportElement.focus();
  });
  document.querySelector('[data-forest-trail-move]').addEventListener('click', () => {
    setTrailTool('move');
    viewportElement.focus();
  });
  document.querySelector('[data-forest-trail-remove]').addEventListener('click', () => {
    setTrailTool('remove');
    viewportElement.focus();
  });
  document.querySelector('[data-forest-trail-done]').addEventListener('click', () => (
    toggleTrailEditor(false)
  ));
  document.querySelector('[data-forest-place-marker]').addEventListener('click', () => {
    closeForestMenu();
    placeMarker();
  });
  document.querySelector('[data-forest-reset-overlay]').addEventListener('click', resetOverlay);
  document.querySelector('[data-forest-clearing-commit]').addEventListener(
    'click', commitClearingPlacement
  );
  document.querySelector('[data-forest-clearing-cancel]').addEventListener('click', () => {
    reportClearing('Placement cancelled.', 'cancelled');
    stopClearingPlacement();
  });
  objectDialog.querySelector('[data-forest-object-save]').addEventListener(
    'click', saveSelectedSignText
  );
  objectDialog.querySelector('[data-forest-object-edit]').addEventListener(
    'click', () => setSelectedSignEditing(true)
  );
  objectDialog.querySelector('[data-forest-object-edit-cancel]').addEventListener(
    'click', () => setSelectedSignEditing(false)
  );
  objectDialog.querySelector('[data-forest-bench-reflect]').addEventListener(
    'click', showNearbyBenchWriting
  );
  objectDialog.querySelector('[data-forest-object-move]').addEventListener('click', () => {
    const object = placedObjects.find(({ id }) => id === selectedClearingObjectId);
    if (!object) return;
    objectDialog.close();
    beginClearingPlacement(object.type, object.id);
  });
  objectDialog.querySelector('[data-forest-object-remove]').addEventListener(
    'click', removeSelectedClearingObject
  );
  objectDialog.querySelector('[data-forest-object-close]').addEventListener(
    'click', () => objectDialog.close()
  );
  window.addEventListener('resize', resize);
  resize();
  updateTrailControls();
  resetPlayer();
}
