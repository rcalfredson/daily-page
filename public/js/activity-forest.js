import { visibleForestPlacements } from './forest-scene-math.js';

const payload = document.getElementById('activity-forest-scene');
const viewportElement = document.querySelector('[data-forest-viewport]');
const canvas = document.querySelector('[data-forest-canvas]');

if (payload && viewportElement && canvas) {
  const scene = JSON.parse(payload.textContent);
  const assetsByKey = new Map(scene.assets.map((asset) => [asset.cacheKey, asset]));
  const context = canvas.getContext('2d');
  const spritesByKey = new Map();
  const camera = { x: 0, y: 0, width: 0, height: 0 };
  const diagnostics = {
    visible: document.querySelector('[data-forest-visible]'),
    camera: document.querySelector('[data-forest-camera]'),
    duration: document.querySelector('[data-forest-duration]')
  };
  let scheduledFrame = null;
  let drag = null;

  function prepareTreeSprites() {
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
  }

  function corridorCenter(worldY) {
    return (scene.world.width / 2) + (Math.sin((worldY / 330) + 0.7) * 155);
  }

  function clampCamera() {
    camera.x = Math.max(0, Math.min(scene.world.width - camera.width, Math.round(camera.x)));
    camera.y = Math.max(0, Math.min(scene.world.height - camera.height, Math.round(camera.y)));
  }

  function paintGround() {
    context.fillStyle = '#617858';
    context.fillRect(0, 0, camera.width, camera.height);

    const bandHeight = 320;
    const firstBandY = Math.floor(camera.y / bandHeight) * bandHeight;
    for (let worldY = firstBandY;
      worldY <= camera.y + camera.height;
      worldY += bandHeight) {
      const bandIndex = Math.floor(worldY / bandHeight);
      context.fillStyle = bandIndex % 2 === 0
        ? 'rgba(202, 211, 170, 0.045)'
        : 'rgba(31, 67, 48, 0.035)';
      context.fillRect(0, worldY - camera.y, camera.width, bandHeight);
    }

    context.beginPath();
    for (let screenY = 0; screenY <= camera.height + 16; screenY += 16) {
      const worldY = camera.y + screenY;
      const screenX = corridorCenter(worldY) - camera.x - scene.corridor.halfWidth;
      if (screenY === 0) context.moveTo(screenX, screenY);
      else context.lineTo(screenX, screenY);
    }
    for (let screenY = camera.height + 16; screenY >= 0; screenY -= 16) {
      const worldY = camera.y + screenY;
      context.lineTo(
        corridorCenter(worldY) - camera.x + scene.corridor.halfWidth,
        screenY
      );
    }
    context.closePath();
    context.fillStyle = 'rgba(173, 159, 112, 0.42)';
    context.fill();
  }

  function paintTree(placement, asset) {
    const originX = Math.round(placement.worldX - camera.x - (asset.anchor.x * placement.scale));
    const originY = Math.round(placement.worldY - camera.y - (asset.anchor.y * placement.scale));
    const sprite = spritesByKey.get(placement.assetKey);
    context.drawImage(
      sprite,
      originX,
      originY,
      asset.dimensions.width * placement.scale,
      asset.dimensions.height * placement.scale
    );
  }

  function render() {
    scheduledFrame = null;
    const start = window.performance.now();
    context.imageSmoothingEnabled = false;
    paintGround();
    const visible = visibleForestPlacements(scene.placements, assetsByKey, camera);
    for (const placement of visible) paintTree(placement, assetsByKey.get(placement.assetKey));
    diagnostics.visible.textContent = `${visible.length} / ${scene.placements.length}`;
    diagnostics.camera.textContent = `${camera.x}, ${camera.y}`;
    diagnostics.duration.textContent = `${(window.performance.now() - start).toFixed(1)} ms`;
  }

  function requestRender() {
    if (scheduledFrame === null) scheduledFrame = requestAnimationFrame(render);
  }

  function moveCamera(deltaX, deltaY) {
    camera.x += deltaX;
    camera.y += deltaY;
    clampCamera();
    requestRender();
  }

  function resetCamera() {
    camera.x = (scene.world.width - camera.width) / 2;
    camera.y = scene.world.height - camera.height - 80;
    clampCamera();
    requestRender();
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
    clampCamera();
    requestRender();
  }

  viewportElement.addEventListener('keydown', (event) => {
    const directions = {
      ArrowLeft: [-56, 0], a: [-56, 0], A: [-56, 0],
      ArrowRight: [56, 0], d: [56, 0], D: [56, 0],
      ArrowUp: [0, -56], w: [0, -56], W: [0, -56],
      ArrowDown: [0, 56], s: [0, 56], S: [0, 56]
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    moveCamera(direction[0], direction[1]);
  });

  viewportElement.addEventListener('pointerdown', (event) => {
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    viewportElement.setPointerCapture(event.pointerId);
    viewportElement.focus();
  });
  viewportElement.addEventListener('pointermove', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    moveCamera(drag.x - event.clientX, drag.y - event.clientY);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  viewportElement.addEventListener('pointerup', () => { drag = null; });
  viewportElement.addEventListener('pointercancel', () => { drag = null; });
  document.querySelector('[data-forest-reset]').addEventListener('click', resetCamera);
  window.addEventListener('resize', resize);
  prepareTreeSprites();
  resize();
  resetCamera();
}
