import {
  cameraFollowingPlayer,
  focusedForestPlacement,
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
  const scene = JSON.parse(payload.textContent);
  const assetsByKey = new Map(scene.assets.map((asset) => [asset.cacheKey, asset]));
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
    duration: document.querySelector('[data-forest-duration]')
  };
  let focusedPlacement = null;
  let scheduledFrame = null;
  let lastFrameTime = null;

  for (const asset of scene.assets) {
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
    spritesByKey.set(asset.cacheKey, sprite);
  }

  function corridorCenter(worldY) {
    return (scene.world.width / 2) + (Math.sin((worldY / 330) + 0.7) * 155);
  }

  function followPlayer() {
    Object.assign(camera, cameraFollowingPlayer(player, camera, scene.world));
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
    focusedPlacement = focusedForestPlacement(player, scene.placements,
      scene.exploration.interactionRadius);
    prompt.hidden = !focusedPlacement;
    diagnostics.focus.textContent = focusedPlacement?.id || 'None';
  }

  function render() {
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
    diagnostics.duration.textContent = `${(window.performance.now() - start).toFixed(1)} ms`;
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
    if (lastFrameTime === null) lastFrameTime = timestamp;
    const elapsed = Math.min(0.05, (timestamp - lastFrameTime) / 1000);
    lastFrameTime = timestamp;
    if (hasMovement() && !dialog.open) {
      Object.assign(player, moveForestPlayer(player, movementDirection(), elapsed,
        scene.world, scene.placements));
      followPlayer();
      updateFocus();
    }
    render();
    if (hasMovement() && !dialog.open) scheduledFrame = requestAnimationFrame(frame);
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
