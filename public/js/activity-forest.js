import {
  cameraFollowingPlayer,
  focusedForestPlacement,
  forestSceneAssetKeysForCells,
  forestSceneCellIdsForViewport,
  forestDepthOrder,
  moveForestPlayer,
  normalizedMovement,
  touchMovement,
  visibleForestPlacements
} from './forest-scene-math.js';

const payload = document.getElementById('activity-forest-scene');
const viewportElement = document.querySelector('[data-forest-viewport]');
const canvas = document.querySelector('[data-forest-canvas]');

if (payload && viewportElement && canvas) {
  const scriptStartedAt = window.performance.now();
  const scene = JSON.parse(payload.textContent);
  const assetsByKey = new Map();
  const fixturesById = new Map(scene.exploration.fixtures.map((fixture) => [fixture.id, fixture]));
  const context = canvas.getContext('2d');
  const spritesByKey = new Map();
  const camera = { x: 0, y: 0, width: 0, height: 0 };
  const player = { ...scene.exploration.spawn };
  const keys = { left: false, right: false, up: false, down: false };
  const touch = { pointerId: null, originX: 0, originY: 0, x: 0, y: 0 };
  const dialog = document.querySelector('[data-forest-dialog]');
  const prompt = document.querySelector('[data-forest-prompt]');
  const joystick = document.querySelector('[data-forest-joystick]');
  const joystickStick = joystick.querySelector('[data-forest-joystick-stick]');
  const diagnostics = {
    visible: document.querySelector('[data-forest-visible]'),
    camera: document.querySelector('[data-forest-camera]'),
    player: document.querySelector('[data-forest-player]'),
    focus: document.querySelector('[data-forest-focus]'),
    duration: document.querySelector('[data-forest-duration]'),
    spriteDuration: document.querySelector('[data-forest-sprite-duration]'),
    prepared: document.querySelector('[data-forest-prepared]'),
    firstRender: document.querySelector('[data-forest-first-render]'),
    movementDuration: document.querySelector('[data-forest-movement-duration]'),
    regionEntry: document.querySelector('[data-forest-region-entry]'),
    regionLoading: document.querySelector('[data-forest-region-loading]')
  };
  const loadedCellIds = new Set(scene.assetLoading.initialCellIds);
  const pendingCellIds = new Set();
  const totalCellCount = forestSceneCellIdsForViewport({
    x: 0, y: 0, width: scene.world.width, height: scene.world.height
  }, scene.world, scene.assetLoading.cellSize).length;
  const seenPlacementIds = new Set();
  const seenAssetKeys = new Set();
  const movementRenders = { count: 0, total: 0, maximum: 0 };
  let focusedPlacement = null;
  let scheduledFrame = null;
  let lastFrameTime = null;
  let firstRenderRecorded = false;
  let regionRetryAfter = 0;
  let regionalRequestActive = false;

  function prepareRuntimeAssets(assets) {
    let preparedCount = 0;
    for (const asset of assets) {
      if (spritesByKey.has(asset.cacheKey)) continue;
      const sprite = document.createElement('canvas');
      sprite.width = asset.dimensions.width;
      sprite.height = asset.dimensions.height;
      const spriteContext = sprite.getContext('2d');
      spriteContext.imageSmoothingEnabled = false;
      for (const layer of asset.layers) {
        for (const run of layer.runs) {
          spriteContext.fillStyle = run.color;
          spriteContext.fillRect(run.x, run.y, run.width, 1);
        }
      }
      assetsByKey.set(asset.cacheKey, asset);
      spritesByKey.set(asset.cacheKey, sprite);
      preparedCount += 1;
    }
    diagnostics.prepared.textContent = `${spritesByKey.size} / ${
      scene.assetLoading.totalAssetCount} asset canvases`;
    return preparedCount;
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
    let batchDuration = 0;
    let preparedCount = 0;
    for (const [index, asset] of assets.entries()) {
      const assetStartedAt = window.performance.now();
      preparedCount += prepareRuntimeAssets([asset]);
      const assetDuration = window.performance.now() - assetStartedAt;
      activeDuration += assetDuration;
      batchDuration += assetDuration;
      if (batchDuration >= 6 && index < assets.length - 1) {
        await waitForAssetPreparationTime();
        batchDuration = 0;
      }
    }
    return { activeDuration, preparedCount };
  }

  const spritePreparationStartedAt = window.performance.now();
  prepareRuntimeAssets(scene.assets);
  const spritePreparationDuration = window.performance.now() - spritePreparationStartedAt;
  diagnostics.spriteDuration.textContent = `${spritePreparationDuration.toFixed(1)} ms initial`;

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
        cells: missingCellIds.join(','),
        assetKeys: missingAssetKeys.join(',')
      });
      const response = await window.fetch(`/__dev/api/activity-forest/assets?${query}`);
      if (!response.ok) throw new Error(`Regional asset request failed (${response.status}).`);
      const region = await response.json();
      const responseReceivedAt = window.performance.now();
      const {
        activeDuration: preparationDuration,
        preparedCount
      } = await prepareRegionalRuntimeAssets(region.assets);
      region.cellIds.forEach((cellId) => loadedCellIds.add(cellId));
      diagnostics.spriteDuration.textContent = `${spritePreparationDuration.toFixed(1)} ms initial / ${
        preparationDuration.toFixed(1)} ms last regional`;
      completionMessage = `${preparedCount} new assets · ${
        region.serverPreparation.serializedAssetBytes.toLocaleString()} bytes · ${
        (responseReceivedAt - requestStartedAt).toFixed(1)} ms fetch · ${
        region.serverPreparation.durationMilliseconds.toFixed(1)} ms server`;
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

  updateRegionLoading();

  function corridorCenter(worldY) {
    return (scene.world.width / 2) + (Math.sin((worldY / 330) + 0.7) * 155);
  }

  function followPlayer() {
    Object.assign(camera, cameraFollowingPlayer(player, camera, scene.world));
    requestRequiredRegions();
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

  function paintTree(placement) {
    const asset = assetsByKey.get(placement.assetKey);
    const originX = Math.round(placement.worldX - camera.x - asset.anchor.x * placement.scale);
    const originY = Math.round(placement.worldY - camera.y - asset.anchor.y * placement.scale);
    if (placement.id === focusedPlacement?.id) {
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
    context.drawImage(spritesByKey.get(placement.assetKey), originX, originY,
      asset.dimensions.width * placement.scale, asset.dimensions.height * placement.scale);
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
    focusedPlacement = focusedForestPlacement(player, scene.placements.filter(
      ({ assetKey }) => assetsByKey.has(assetKey)
    ),
      scene.exploration.interactionRadius);
    prompt.hidden = !focusedPlacement;
    diagnostics.focus.textContent = focusedPlacement?.id || 'None';
  }

  function render({ moving = false, frameGap = null } = {}) {
    const start = window.performance.now();
    context.imageSmoothingEnabled = false;
    paintGround();
    const visible = visibleForestPlacements(scene.placements, assetsByKey, camera);
    for (const item of forestDepthOrder(visible, player)) {
      if (item.kind === 'player') paintPlayer();
      else paintTree(item.placement);
    }
    diagnostics.visible.textContent = `${visible.length} / ${scene.placements.length}`;
    diagnostics.camera.textContent = `${camera.x}, ${camera.y}`;
    diagnostics.player.textContent = `${Math.round(player.worldX)}, ${Math.round(player.worldY)}`;
    const duration = window.performance.now() - start;
    diagnostics.duration.textContent = `${duration.toFixed(1)} ms`;

    const newlySeen = visible.filter(({ id }) => !seenPlacementIds.has(id));
    const newlySeenAssets = new Set(newlySeen.map(({ assetKey }) => assetKey)
      .filter((assetKey) => !seenAssetKeys.has(assetKey)));
    visible.forEach(({ id, assetKey }) => {
      seenPlacementIds.add(id);
      seenAssetKeys.add(assetKey);
    });

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
    const moving = hasMovement() && !dialog.open;
    if (moving) {
      Object.assign(player, moveForestPlayer(player, movementDirection(), elapsed,
        scene.world, scene.placements));
      followPlayer();
      updateFocus();
    }
    render({ moving, frameGap });
    if (moving) scheduledFrame = requestAnimationFrame(frame);
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
    joystick.hidden = true;
    joystickStick.style.transform = '';
    lastFrameTime = null;
  }

  function updateTouchMovement(event) {
    const deltaX = event.clientX - touch.originX;
    const deltaY = event.clientY - touch.originY;
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
    joystick.hidden = true;
    joystickStick.style.transform = '';
    lastFrameTime = null;
  }

  function openInspection() {
    if (!focusedPlacement || dialog.open) return;
    clearMovement();
    const fixture = fixturesById.get(focusedPlacement.fixtureId);
    dialog.querySelector('[data-forest-post-title]').textContent = fixture.title;
    dialog.querySelector('[data-forest-post-room]').textContent = fixture.roomName;
    dialog.querySelector('[data-forest-post-date]').textContent = new Intl.DateTimeFormat(undefined,
      { dateStyle: 'long' }).format(new Date(`${fixture.createdAt}T12:00:00Z`));
    dialog.querySelector('[data-forest-post-excerpt]').textContent = fixture.excerpt;
    dialog.showModal();
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
    } else if ((event.key === 'e' || event.key === 'E' || event.key === 'Enter')
      && focusedPlacement) {
      event.preventDefault();
      openInspection();
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
    if (event.pointerType === 'mouse' || event.target.closest('button') || dialog.open) return;
    event.preventDefault();
    touch.pointerId = event.pointerId;
    touch.originX = event.clientX;
    touch.originY = event.clientY;
    touch.x = 0;
    touch.y = 0;
    const viewportRect = viewportElement.getBoundingClientRect();
    joystick.style.left = `${event.clientX - viewportRect.left}px`;
    joystick.style.top = `${event.clientY - viewportRect.top}px`;
    joystick.hidden = false;
    viewportElement.setPointerCapture(event.pointerId);
    viewportElement.focus();
  });
  viewportElement.addEventListener('pointermove', (event) => {
    if (event.pointerId !== touch.pointerId) return;
    event.preventDefault();
    updateTouchMovement(event);
  });
  viewportElement.addEventListener('pointerup', stopTouchMovement);
  viewportElement.addEventListener('pointercancel', stopTouchMovement);
  viewportElement.addEventListener('lostpointercapture', stopTouchMovement);
  window.addEventListener('blur', clearMovement);
  dialog.addEventListener('close', () => {
    clearMovement();
    viewportElement.focus();
    requestRender();
  });
  dialog.querySelector('[data-forest-dialog-close]').addEventListener('click', () => dialog.close());
  prompt.addEventListener('click', openInspection);
  document.querySelector('[data-forest-reset]').addEventListener('click', resetPlayer);
  window.addEventListener('resize', resize);
  resize();
  resetPlayer();
}
