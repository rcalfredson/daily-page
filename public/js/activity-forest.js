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

const payload = document.getElementById('activity-forest-scene');
const viewportElement = document.querySelector('[data-forest-viewport]');
const canvas = document.querySelector('[data-forest-canvas]');

if (payload && viewportElement && canvas) {
  const scriptStartedAt = window.performance.now();
  const initialResponseDecodeStartedAt = window.performance.now();
  const scene = JSON.parse(payload.textContent);
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
    benchResurfaced: document.querySelector('[data-forest-bench-resurfaced]')
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
  const visibilityCache = createForestVisibilityCache(
    scene.placements, assetsByKey, 24, [...placedObjects, ...availableDiscoveries]
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
    visibilityCache.setObjects([...placedObjects, ...availableDiscoveries]);
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

  function paintGround() {
    context.fillStyle = '#617858';
    context.fillRect(0, 0, camera.width, camera.height);
    const bandHeight = 320;
    const firstBandY = Math.floor(camera.y / bandHeight) * bandHeight;
    for (let worldY = firstBandY; worldY <= camera.y + camera.height; worldY += bandHeight) {
      context.fillStyle = Math.floor(worldY / bandHeight) % 2 === 0
        ? 'rgba(202, 211, 170, 0.045)' : 'rgba(31, 67, 48, 0.035)';
      context.fillRect(0, worldY - camera.y, camera.width, bandHeight);
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
    context.fillStyle = 'rgba(173, 159, 112, 0.42)';
    context.fill();
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
    const y = Math.round(player.worldY - camera.y);
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
    paintTrailJoins();
    const visibility = visibilityCache.read(camera, player);
    for (const item of visibility.depthOrder) {
      if (item.kind === 'player') paintPlayer();
      else if (item.kind === 'marker') paintMarker(item.object);
      else if (item.kind === FOREST_STEPPING_STONE_TYPE) paintSteppingStone(item.object);
      else if (item.kind === FOREST_DISCOVERY_TYPE) paintDiscovery(item.object);
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
    const { visible, visibleObjects } = visibility;
    diagnostics.visible.textContent = `${visible.length} / ${scene.placements.length} trees · ${
      visibleObjects.filter(({ type }) => type === 'marker').length} markers · ${
      visibleObjects.filter(({ type }) => type === FOREST_STEPPING_STONE_TYPE).length} stones · ${
      visibleObjects.filter(isForestClearingObject).length} clearing objects · ${
      visibleObjects.filter(({ type }) => type === FOREST_DISCOVERY_TYPE).length} discoveries`;
    diagnostics.camera.textContent = `${camera.x}, ${camera.y}`;
    diagnostics.player.textContent = `${Math.round(player.worldX)}, ${Math.round(player.worldY)}`;
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
        scene.world, [...scene.placements, ...forestSolidClearingPlacements(placedObjects)]));
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
        openFixtureWriting(candidate.fixture, 'Writing reflected from nearby trees');
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
