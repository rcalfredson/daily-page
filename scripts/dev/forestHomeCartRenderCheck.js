import { buildForestBridgeModel3d, forestBridgeProfileHeight, FOREST_BRIDGE_DEFINITION_ID } from '/js/forest-bridges.js';
import { projectForestPoint3d } from '/js/forest-projection.js';
/* global document */
import { paintStudyCart, studyCartDepthItems, paintStudyCartSupport, paintStudyCartRider, paintStudyCartRiderRow } from '/__study/paint.js';
import { paintForestCompanion } from '/js/forest-companion-paint.js';
import { studyCartDesign } from '/js/forest-construction-design.js';

// Pixel checks at the reported shallow upward headings, plus a sheet for reviewing
// natural occlusion by near rails and roofs around an entire rotation.
export function checkCartRendering() {
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let checks = 0;
  for (const length of [36, 44, 52]) for (const width of [24, 30, 36]) {
    for (const degrees of [345, 350, 355]) {
      const heading = degrees * Math.PI / 180;
      const design = { ...studyCartDesign('compact'), length, width };
      ctx.clearRect(0, 0, 240, 240);
      paintStudyCart(ctx, { design, worldX: 120, worldY: 150, heading }, { x: 0, y: 0 }, true);
      const seatX = Math.round(120 + Math.cos(heading) * (length / 2 - 4));
      const seatY = Math.round(150 + Math.sin(heading) * (length / 2 - 4) - 27);
      const pixel = [...ctx.getImageData(seatX + 1, seatY - 5, 1, 1).data];
      if (pixel.join(',') !== '57,116,155,255') {
        throw new Error(`Rider shirt obscured at ${degrees} degrees, ${length}x${width}: ${pixel}`);
      }
      checks++;
    }
  }
  const angles = [0, 15, 45, 90, 135, 170, 180, 190, 225, 270, 315, 345];
  const designs = [studyCartDesign('compact'), { ...studyCartDesign('canopy'), canopy: 'none' },
    { ...studyCartDesign('canopy'), supports: 'posts', cloth: 'ochre' }, studyCartDesign('canopy')];
  const sheet = document.createElement('canvas'); sheet.width = 1200; sheet.height = 1280;
  const output = sheet.getContext('2d'); output.fillStyle = '#687453'; output.fillRect(0, 0, sheet.width, sheet.height);
  designs.forEach((design, row) => angles.forEach((degrees, i) => {
    const x = i % 6 * 200, y = (row * 2 + Math.floor(i / 6)) * 160;
    output.fillStyle = '#f4e5c5'; output.font = '12px sans-serif';
    output.fillText(`${row + 1}: ${degrees}°`, x + 8, y + 16);
    paintStudyCart(output, { design, worldX: x + 100, worldY: y + 110, heading: degrees * Math.PI / 180 },
      { x: 0, y: 0 }, true, 0, { wheel: .4, gait: 0 });
  }));
  return { checks, image: sheet.toDataURL('image/png').split(',')[1] };
}

// Composite the same depth items used by the scene against real bridge rail geometry.
export function checkBridgeCartRendering() {
  const make = () => { const c = document.createElement('canvas'); c.width = 240; c.height = 240; return c; };
  const canvas = make(), roof = make(), rails = make(), body = make(), legacy = make(), upper = make(), supportsMask = make(), rider = make();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const roofCtx = roof.getContext('2d', { willReadFrequently: true });
  const railsCtx = rails.getContext('2d', { willReadFrequently: true });
  const bodyCtx = body.getContext('2d', { willReadFrequently: true });
  const legacyCtx = legacy.getContext('2d', { willReadFrequently: true });
  const upperCtx = upper.getContext('2d', { willReadFrequently: true });
  const supportsCtx = supportsMask.getContext('2d', { willReadFrequently: true });
  const riderCtx = rider.getContext('2d', { willReadFrequently: true });
  const camera = { x: 0, y: 0 };
  const sheet = document.createElement('canvas'); sheet.width = 1440; sheet.height = 960;
  const output = sheet.getContext('2d');
  let checks = 0, overlaps = 0, foreground = 0, legacyOcclusions = 0, supportOverlaps = 0, oldSupportOcclusions = 0;
  const paintRail = (target, m) => {
    const a = projectForestPoint3d(m.from), b = projectForestPoint3d(m.to);
    target.lineCap = 'round';
    for (const [color, width] of [[m.colors[0], m.width], [m.colors[1], Math.max(1, m.width / 3)]]) {
      target.strokeStyle = color; target.lineWidth = width; target.beginPath();
      target.moveTo(a.x, a.y); target.lineTo(b.x, b.y); target.stroke();
    }
  };
  for (const [index, degrees] of [0, 30, 45, 60, 90, 120, 150, 180, 210, 225, 270, 315].entries()) {
    for (const [row, canopy] of ['linen', 'patched'].entries()) for (const supports of ['posts', 'bows']) for (const longitudinal of [-55, 0, 55]) {
      const angle = degrees * Math.PI / 180;
      const bridge = { id: 'rail-check', worldX: 120, worldY: 150, halfLength: 90, halfWidth: 24,
        maximumElevationPixels: 16, angleMilliradians: angle * 1000, definitionId: FOREST_BRIDGE_DEFINITION_ID };
      const model = buildForestBridgeModel3d(bridge), elevation = forestBridgeProfileHeight(bridge, longitudinal);
      const cart = { design: { ...studyCartDesign('canopy'), canopy, supports }, worldX: 120 + Math.cos(angle) * longitudinal, worldY: 150 + Math.sin(angle) * longitudinal, heading: angle + .05 };
      const bodyDepth = cart.worldY + elevation;
      const items = [...model.members.map(m => ({ kind: 'rail', id: m.id, member: m,
        worldY: (m.from.y + m.to.y + m.from.z + m.to.z) / 2 })), ...studyCartDepthItems(cart, elevation, true)]
        .sort((a, b) => a.worldY - b.worldY || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
      ctx.clearRect(0, 0, 240, 240); roofCtx.clearRect(0, 0, 240, 240); railsCtx.clearRect(0, 0, 240, 240);
      for (const item of items) {
        if (item.type === 'cart-support') paintStudyCartSupport(ctx, item, camera);
        else if (item.type === 'cart-rider') paintStudyCartRiderRow(ctx, item, camera);
        else if (item.member) paintRail(ctx, item.member);
        else paintStudyCart(ctx, cart, camera, true, elevation, { wheel: 0, gait: 0 }, item.type === 'cart-roof' ? 'roof' : 'body');
      }
      paintStudyCart(roofCtx, cart, camera, true, elevation, { wheel: 0, gait: 0 }, 'roof');
      for (const item of items.filter(i => i.member)) paintRail(railsCtx, item.member);
      bodyCtx.clearRect(0, 0, 240, 240); legacyCtx.clearRect(0, 0, 240, 240);
      paintStudyCart(bodyCtx, cart, camera, true, elevation, { wheel: 0, gait: 0 }, 'body');
      const legacyItems = [...items.filter(i => i.member), { kind: 'extension', id: 'study-cart', worldY: cart.worldY }]
        .sort((a, b) => a.worldY - b.worldY || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
      for (const item of legacyItems) {
        if (item.member) paintRail(legacyCtx, item.member);
        else paintStudyCart(legacyCtx, cart, camera, true, elevation);
      }
      upperCtx.clearRect(0, 0, 240, 240);
      for (const item of items.filter(i => i.type === 'cart-support' && Math.min(i.from.z, i.to.z) >= elevation + 38)) {
        paintStudyCartSupport(upperCtx, item, camera);
      }
      supportsCtx.clearRect(0, 0, 240, 240);
      for (const item of items.filter(i => i.type === 'cart-support')) paintStudyCartSupport(supportsCtx, item, camera);
      riderCtx.clearRect(0, 0, 240, 240);
      for (const item of items.filter(i => i.type === 'cart-rider')) paintStudyCartRiderRow(riderCtx, item, camera);
      const riderPixels = riderCtx.getImageData(0, 0, 240, 240).data;
      const supportPixels = supportsCtx.getImageData(0, 0, 240, 240).data;
      const upperPixels = upperCtx.getImageData(0, 0, 240, 240).data;
      const bodyPixels = bodyCtx.getImageData(0, 0, 240, 240).data;
      const legacyPixels = legacyCtx.getImageData(0, 0, 240, 240).data;
      const pixels = ctx.getImageData(0, 0, 240, 240).data;
      const roofPixels = roofCtx.getImageData(0, 0, 240, 240).data, railPixels = railsCtx.getImageData(0, 0, 240, 240).data;
      for (let i = 0; i < pixels.length; i += 4) if (!riderPixels[i + 3] && [-960, -4, 0, 4, 960].every(offset => roofPixels[i + offset + 3] === 255) && railPixels[i + 3] === 255) {
        overlaps++;
        if ([0, 1, 2].some(k => Math.abs(legacyPixels[i + k] - roofPixels[i + k]) > 2)) legacyOcclusions++;
        if ([0, 1, 2].some(k => Math.abs(pixels[i + k] - roofPixels[i + k]) > 2)) throw new Error(`Rail painted over canopy: ${degrees}°, ${canopy}, ${supports}, pixel ${i / 4}`);
      }
      for (let i = 0; i < pixels.length; i += 4) if (upperPixels[i + 3] === 255 && railPixels[i + 3] === 255
        && !roofPixels[i + 3] && !bodyPixels[i + 3] && !riderPixels[i + 3]) {
        supportOverlaps++;
        if ([0, 1, 2].some(k => Math.abs(legacyPixels[i + k] - upperPixels[i + k]) > 2)) oldSupportOcclusions++;
        if ([0, 1, 2].some(k => Math.abs(pixels[i + k] - upperPixels[i + k]) > 2)) throw new Error(`Rail painted over upper support: ${degrees}°, ${supports}, pixel ${i / 4}`);
      }
      railsCtx.clearRect(0, 0, 240, 240);
      for (const item of items.filter(i => i.member && i.worldY > bodyDepth)) paintRail(railsCtx, item.member);
      const frontPixels = railsCtx.getImageData(0, 0, 240, 240).data;
      for (let i = 0; i < pixels.length; i += 4) if (!riderPixels[i + 3] && !roofPixels[i + 3] && !supportPixels[i + 3] && frontPixels[i + 3] === 255 && bodyPixels[i + 3] === 255) {
        foreground++;
        if ([0, 1, 2].some(k => Math.abs(pixels[i + k] - frontPixels[i + k]) > 2)) throw new Error(`Near rail lost: ${degrees}°, pixel ${i / 4}`);
      }
      if (supports === 'bows' && longitudinal === 0) {
        const x = index % 6 * 240, y = (row * 2 + Math.floor(index / 6)) * 240;
        output.fillStyle = '#687453'; output.fillRect(x, y, 240, 240);
        output.save(); output.translate(x, y);
        const order = { shadow: 0, abutment: 1, fascia: 2, 'plank-end': 3, plank: 4 };
        for (const surface of [...model.surfaces].sort((a, b) => order[a.role] - order[b.role] || a.ordinal - b.ordinal)) {
          output.beginPath(); surface.points.map(p => projectForestPoint3d(p)).forEach((p, i) =>
            i ? output.lineTo(p.x, p.y) : output.moveTo(p.x, p.y));
          output.closePath(); output.fillStyle = surface.fill; output.fill();
        }
        output.restore(); output.drawImage(canvas, x, y);
        output.fillStyle = '#f4e5c5'; output.fillText(`${degrees}° · ${canopy}`, x + 8, y + 16);
      }
      checks++;
    }
  }
  if (!overlaps || !foreground || !legacyOcclusions || !supportOverlaps || !oldSupportOcclusions) throw new Error('Bridge test did not exercise occlusion');
  return { checks, overlaps, foreground, legacyOcclusions, supportOverlaps, oldSupportOcclusions, image: sheet.toDataURL('image/png').split(',')[1] };
}

export function checkRiderSupportRendering() {
  const make = () => { const c = document.createElement('canvas'); c.width = 240; c.height = 240; return c.getContext('2d', { willReadFrequently: true }); };
  const scene = make(), rider = make(), rear = make(), front = make(), roof = make(), old = make();
  const camera = { x: 0, y: 0 };
  let checks = 0, rearOverlaps = 0, frontOverlaps = 0, oldOcclusions = 0;
  const sheet = document.createElement('canvas'); sheet.width = 1200; sheet.height = 960;
  const output = sheet.getContext('2d');
  for (const length of [36, 44, 52]) for (const width of [24, 30, 36]) for (const supports of ['posts', 'bows']) {
    for (let degrees = 0; degrees < 360; degrees += 15) {
      const heading = degrees * Math.PI / 180;
      const cart = { design: { ...studyCartDesign('canopy'), length, width, supports }, worldX: 120, worldY: 150, heading };
      const seatY = cart.worldY + Math.sin(heading) * (length / 2 - 4);
      const items = studyCartDepthItems(cart, 0, true).sort((a, b) => a.worldY - b.worldY || a.id.localeCompare(b.id));
      for (const ctx of [scene, rider, rear, front, roof, old]) ctx.clearRect(0, 0, 240, 240);
      paintStudyCart(scene, cart, camera, true);
      paintStudyCart(roof, cart, camera, true, 0, undefined, 'roof');
      for (const item of items) {
        if (item.type === 'cart-rider') paintStudyCartRiderRow(rider, item, camera);
        if (item.type === 'cart-support' && Math.abs(item.from.y - item.to.y) < .001) {
          if (item.from.y < seatY - 1) paintStudyCartSupport(rear, item, camera);
          if (item.from.y > seatY + 1) paintStudyCartSupport(front, item, camera);
        }
      }
      const oldItems = [...items.filter(i => i.type !== 'cart-rider'),
        { type: 'rider-flat', id: 'rider-flat', worldY: cart.worldY + .001 }].sort((a, b) => a.worldY - b.worldY || a.id.localeCompare(b.id));
      for (const item of oldItems) {
        if (item.type === 'cart-support') paintStudyCartSupport(old, item, camera);
        else if (item.type === 'rider-flat') paintStudyCartRider(old, cart, camera);
        else paintStudyCart(old, cart, camera, false, 0, undefined, item.type === 'cart-roof' ? 'roof' : 'body');
      }
      const [actual, avatar, behind, ahead, fabric, legacy] = [scene, rider, rear, front, roof, old].map(c => c.getImageData(0, 0, 240, 240).data);
      for (let i = 0; i < actual.length; i += 4) {
        if (avatar[i + 3] !== 255 || fabric[i + 3]) continue;
        if (behind[i + 3] === 255 && !ahead[i + 3]) {
          rearOverlaps++;
          if ([0, 1, 2].some(k => Math.abs(legacy[i + k] - avatar[i + k]) > 2)) oldOcclusions++;
          if ([0, 1, 2].some(k => Math.abs(actual[i + k] - avatar[i + k]) > 2)) throw new Error(`Rear pillar covered rider: ${degrees}°, ${length}x${width}, ${supports}, pixel ${i / 4}`);
        }
        if (ahead[i + 3] === 255) {
          frontOverlaps++;
          if ([0, 1, 2].some(k => Math.abs(actual[i + k] - ahead[i + k]) > 2)) throw new Error(`Foreground pillar lost: ${degrees}°, ${length}x${width}, ${supports}, pixel ${i / 4}`);
        }
      }
      if (length === 52 && width === 36) {
        const index = degrees / 15, x = index % 6 * 200, y = (Math.floor(index / 6) + (supports === 'bows' ? 4 : 0)) * 120;
        output.fillStyle = '#687453'; output.fillRect(x, y, 200, 120);
        output.drawImage(scene.canvas, 20, 40, 200, 120, x, y, 200, 120);
        output.fillStyle = '#f4e5c5'; output.fillText(`${degrees}° · ${supports}`, x + 5, y + 12);
      }
      checks++;
    }
  }
  if (!rearOverlaps || !frontOverlaps || !oldOcclusions) throw new Error('Rider test did not exercise both depth directions');
  return { checks, rearOverlaps, frontOverlaps, oldOcclusions, image: sheet.toDataURL('image/png').split(',')[1] };
}

export function checkCompanionEyeRendering() {
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 120;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const sheet = document.createElement('canvas'); sheet.width = 960; sheet.height = 840;
  const output = sheet.getContext('2d'); output.imageSmoothingEnabled = false;
  let checks = 0;
  const failures = [];
  for (const [row, state] of [{}, { resting: true }, { attentive: true, greeting: 1 }].entries()) {
    for (const [column, degrees] of [0, 90, 180, 270].entries()) for (const [variant, look] of [-.4, 0, .4].entries()) {
      const heading = degrees * Math.PI / 180, c = Math.cos(heading), s = Math.sin(heading);
      const project = (x, y, z = 0) => ({ x: Math.round(80 + c * x - s * y), y: Math.round(85 + s * x + c * y - z) });
      ctx.clearRect(0, 0, 160, 120); paintForestCompanion(ctx, project, heading, { ...state, look });
      const pixels = ctx.getImageData(0, 0, 160, 120).data, dark = new Set();
      // Oblique cheeks can make a subpixel-width eye. Include its antialiased dark
      // interior, while staying distinct from the brown outlines and gray hooves.
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] === 255
        && [52, 61, 51].every((color, k) => Math.abs(pixels[i + k] - color) <= 12)) dark.add(i / 4);
      let eyes = 0;
      while (dark.size) {
        eyes++; const pending = [dark.values().next().value]; dark.delete(pending[0]);
        while (pending.length) {
          const p = pending.pop();
          // A steep projected eye can have one lightly antialiased pixel between
          // its dark pixels; the two eyes remain at least three pixels apart.
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
            const neighbor = p + dy * 160 + dx;
            if (dark.delete(neighbor)) pending.push(neighbor);
          }
        }
      }
      const expected = degrees === 90 ? 2 : degrees === 270 ? 0 : 1;
      if (eyes !== expected) failures.push(`Mallow eyes: ${degrees}°, look ${look}, pose ${row}: expected ${expected}, saw ${eyes}`);
      const index = column * 3 + variant, x = index % 6 * 160, y = (row * 2 + Math.floor(index / 6)) * 140;
      output.fillStyle = '#687453'; output.fillRect(x, y, 160, 140);
      output.drawImage(canvas, 40, 25, 80, 70, x, y, 160, 140);
      output.fillStyle = '#f4e5c5'; output.fillText(`${degrees}° · look ${look}`, x + 6, y + 14);
      checks++;
    }
  }
  return { checks, failures, image: sheet.toDataURL('image/png').split(',')[1] };
}
