// Pixel geometry at the same world scale as the owner avatar. No raster download or asset job.
export function paintLanternbell(ctx, plant, camera, { preview = false, valid = true, wild = false, focused = false, spent = false, preserveAppearance = false } = {}) {
  const x = Math.round(plant.worldX - camera.x), y = Math.round(plant.worldY - camera.y);
  if (x < -40 || y < -50 || x > camera.width + 40 || y > camera.height + 40) return;
  ctx.save();
  if (preview) ctx.globalAlpha = 0.7;
  const rect = (dx, dy, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x + dx, y + dy, w, h); };
  rect(-11, -2, 22, 6, '#34463c'); rect(-8, 2, 16, 3, '#546147');
  if (preview || focused) {
    ctx.strokeStyle = preview ? valid ? '#b9e7c1' : '#f6a194' : '#e5f2cd';
    ctx.setLineDash(preview ? [3, 3] : []);
    ctx.strokeRect(x - 13, y - 8, 26, 15);
  }
  if (plant.stage === 'rooted') {
    rect(-1, -10, 3, 12, '#6a7951'); rect(-6, -9, 6, 4, '#7caa85'); rect(2, -13, 6, 5, '#9ec49b');
  } else {
    rect(-2, -21, 4, 24, '#546c4a');
    rect(-10, -15, 9, 6, '#4e8878'); rect(2, -18, 9, 6, '#69a18b');
    rect(-8, -8, 9, 6, '#6c9e7e'); rect(2, -9, 8, 6, '#8bb18e');
    rect(-6, -24, 7, 7, '#7eb19b'); rect(1, -27, 6, 8, '#91bea1');
    if (plant.stage === 'flowering') {
      const bells = [[-10, -22], [3, -30], [8, -17]];
      const trimmed = (!preview || preserveAppearance) && (wild ? spent : !plant.ready);
      for (const [dx, dy] of bells.slice(0, trimmed ? 2 : 3)) {
        rect(dx + 2, dy - 3, 2, 6, '#6d8152');
        rect(dx, dy + 1, 7, 7, '#bd8050'); rect(dx + 1, dy, 5, 8, '#efbc6c');
        rect(dx + 2, dy + 2, 2, 4, '#ffe0a1'); rect(dx - 1, dy + 7, 9, 2, '#e3a563');
      }
      if (trimmed) { rect(10, -19, 2, 7, '#91a272'); rect(9, -20, 4, 2, '#d8c599'); }
    } else { rect(-6, -22, 3, 4, '#bd9d68'); rect(5, -25, 3, 4, '#d6b782'); }
  }
  ctx.restore();
}

export function paintLanternbellCutting(ctx, x, y, scale = 1) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(scale, scale);
  const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  rect(-1, -12, 2, 15, '#b0bc7e');
  rect(-7, -10, 6, 4, '#76ad94'); rect(-5, -11, 4, 2, '#a4cfaa');
  rect(1, -6, 6, 4, '#76ad94'); rect(2, -7, 4, 2, '#a4cfaa');
  rect(-2, -15, 4, 5, '#efbc6c'); rect(-1, -15, 2, 3, '#ffe0a1');
  rect(-3, 0, 6, 2, '#c7a078'); ctx.restore();
}
