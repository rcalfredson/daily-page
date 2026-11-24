import { availableOrchardDyes, orchardCairnBlocks, orchardPlacementAllowed, orchardPlotApproach, orchardReturnWaypoint, orchardRoad,
  orchardStonePassage, orchardTreeBlocks, orchardTreeForm, orchardVariety, orchardPlanting, orchardYardContains,
  ORCHARD_PLANTING_RADIUS } from './forest-orchard.js';
import { orchardPlantingSpace } from './forest-home-reservations.js';
import { ownerForestPlacementPoint } from './owner-forest-scene.js';
import { amberClearingBend } from './forest-amber-clearing.js';
import { paintAmberTrail } from './forest-homestead-paint.js';

const range = (point, pose) => Math.hypot(point.x - pose.worldX, point.y - pose.worldY);
const nearby = point => ({ worldX: point.x, worldY: point.y });
const visible = (p, c) => p.x >= c.x - 68 && p.x <= c.x + c.width + 68
  && p.y >= c.y - 22 && p.y <= c.y + c.height + 114;
const fruitTree = stage => stage === 'planted' || stage === 'harvested';

function ellipse(ctx, x, y, width, height, color, angle = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, width, height, angle, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
}

function paintTree(ctx, x, y, { palette, leaf, variant }, form, index, garden) {
  const size = garden ? .76 : 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
  ellipse(ctx, 6, 2, 34, 11, 'rgba(20,30,21,.23)', -.08);
  ctx.transform(form.width, 0, form.lean, form.height, 0, 0);
  const spread = index === 0 ? 1 : .77;
  const top = index === 0 ? 60 + variant * 4 : 75 + variant * 3;
  ctx.lineCap = 'round'; ctx.strokeStyle = '#75573e';
  ctx.beginPath(); ctx.moveTo(2, 1); ctx.quadraticCurveTo(-6, -22, 3, -47); ctx.lineWidth = 10; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-1, -18); ctx.lineTo(-21 * spread, -43); ctx.moveTo(0, -25);
  ctx.lineTo(22 * spread, -49); ctx.lineWidth = 5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, -1); ctx.quadraticCurveTo(-2, -17, 0, -29);
  ctx.lineWidth = 2; ctx.strokeStyle = '#a78358'; ctx.stroke();
  const canopy = [[-23, -43, 23, 20], [15, -44, 28, 22], [-13, -57, 24, 22],
    [13, -top, 24, 18], [-13, -top + 4, 21, 19], [26, -top + 14, 12, 16]];
  canopy.forEach(([cx, cy, w, h], i) => ellipse(ctx, cx * spread, cy, w * spread, h, leaf[i < 2 ? 0 : i < 4 ? 1 : 2], -.28));
  [[-35, -57, 10], [-18, -top - 9, 12], [4, -top - 11, 8], [24, -top - 2, 13], [34, -49, 9]]
    .forEach(([cx, cy, w], i) => ellipse(ctx, cx * spread, cy, w * spread, 5 + i % 3, leaf[(i + 1) % 3], -.32));
  [[-29, -51], [-20, -42], [-7, -top + 2], [12, -top - 5], [24, -top + 17], [15, -47],
    [5, -36], [-31, -60], [31, -43]].forEach(([fx, fy], i) => {
    if (garden && i % 2) return;
    ellipse(ctx, fx * spread, fy, index ? 3.6 : 4.7, index ? 4.6 : 5, palette[i % 2]);
    ellipse(ctx, fx * spread - 1, fy - 1.6, 1.6, 1.2, palette[2]);
  });
  ctx.restore();
}

function paintGroveFloor(ctx, x, y, variety, index) {
  ellipse(ctx, x - 6, y - 4, 69, 32, index ? 'rgba(80,106,66,.31)' : 'rgba(168,153,92,.23)', -.12);
  for (const [dx, dy, lean] of [[-49, -8, -3], [-40, 12, 2], [-30, -19, -2], [29, 17, 4], [42, -8, 2], [55, 5, 4]]) {
    const px = x + dx, py = y + dy;
    ctx.beginPath(); ctx.moveTo(px - 3, py); ctx.lineTo(px + lean - 4, py - 7); ctx.lineTo(px + lean + 2, py - 3);
    ctx.lineTo(px + 6, py - 8); ctx.lineTo(px + 4, py); ctx.closePath();
    ctx.fillStyle = variety.leaf[1]; ctx.fill();
  }
  for (const [dx, dy] of [[-23, 7], [19, 9], [36, -5]]) {
    ellipse(ctx, x + dx + 1, y + dy + 1, 3, 1.8, 'rgba(25,27,18,.28)');
    ellipse(ctx, x + dx, y + dy, 2.6, 2.1, variety.palette[0]);
  }
}

function paintCairn(ctx, x, y) {
  ellipse(ctx, x + 4, y + 1, 22, 7, 'rgba(35,41,27,.22)');
  [[0, -5, 20, 8], [2, -15, 16, 7], [-2, -24, 11, 6], [1, -33, 7, 5]]
    .forEach(([dx, dy, w, h], index) => {
      ellipse(ctx, x + dx, y + dy, w, h, index % 2 ? '#969884' : '#767d70', -.1);
      ellipse(ctx, x + dx - 2, y + dy - 2, w * .73, h * .48, '#b2af96', -.16);
    });
}

export function createForestOrchardScene({ api, dock, layout, read, canAct, blocked, save, say }) {
  const viewport = dock.closest('[data-owner-forest-viewport]');
  const action = document.createElement('button');
  action.type = 'button'; action.hidden = true; action.dataset.orchardAction = '';
  const choose = [0, 1].map(index => {
    const button = document.createElement('button');
    button.type = 'button'; button.hidden = true; button.dataset.orchardChoose = index;
    return button;
  });
  const toolbar = document.createElement('section');
  toolbar.className = 'owner-forest__garden-preview orchard-planting';
  toolbar.hidden = true;
  toolbar.innerHTML = '<p role="status" aria-live="polite" data-orchard-preview></p><div class="owner-forest__garden-actions"><button type="button" data-orchard-confirm>Plant here</button><button type="button" data-orchard-suggest>Suggested spot</button><button type="button" data-orchard-cancel>Cancel</button></div>';
  const copy = toolbar.querySelector('p'), confirm = toolbar.querySelector('[data-orchard-confirm]');
  const suggest = toolbar.querySelector('[data-orchard-suggest]');
  if (api.amberClearingEnabled) dock.append(action, ...choose, toolbar);
  const satchel = document.querySelector('[data-orchard-satchel]');
  let lastRecord, cached, activeAction, planting = null, preview = null;
  function scene() {
    const record = read(), site = record?.orchard?.site;
    if (!site) return null;
    if (record !== lastRecord) {
      lastRecord = record;
      const road = orchardRoad(layout, site);
      const trees = site.plots.map((_, i) => orchardPlanting(record.orchard, i));
      cached = { road, varieties: site.plots.map((_, i) => orchardVariety(record.forestId, i)),
        wildForms: road.branches.map(({ tree }, i) => orchardTreeForm(record.forestId, i, tree)),
        trees, yardForms: trees.map((plot, i) => plot && orchardTreeForm(record.forestId, i, plot)) };
    }
    return cached;
  }
  function nextAction(player) {
    if (!api.amberClearingEnabled || !canAct() || !api.regionLoaded(player)) return null;
    const orchard = read()?.orchard, data = scene();
    if (!data) return null;
    const choices = orchard.stages.flatMap((stage, branch) => {
      const name = data.varieties[branch].name;
      if (stage === 'undiscovered') return [{ branch, kind: 'collect', label: `Collect the ${name.toLowerCase()} seed`,
        at: data.road.branches[branch].tree, notice: `${name} seed in your Satchel. At home, choose its planting spot.` }];
      if (stage === 'planted') return [{ branch, kind: 'harvest', label: `Pick first ${name.toLowerCase()}`, at: data.trees[branch],
        notice: `${name} dye is now available under Cloth color at the workshop.` }];
      return [];
    });
    return choices.filter(option => range(option.at, player) <= 52)
      .sort((a, b) => range(a.at, player) - range(b.at, player))[0];
  }
  action.addEventListener('click', async () => {
    const current = nextAction(api.state().player);
    if (!current || current.branch !== activeAction?.branch || current.kind !== activeAction.kind || blocked()) return;
    api.focus();
    if (await save(`orchard-${current.kind}`, { branch: current.branch })) say(current.notice);
  });
  const canChoose = () => canAct() && range(layout.home, api.state().player) <= 205;
  function stopPlanting(restoreFocus = true) {
    planting = preview = null;
    toolbar.hidden = true;
    delete viewport.dataset.orchardPlanting;
    if (restoreFocus) api.focus();
    api.requestRender();
  }
  function updatePreview() {
    if (!planting) return;
    const record = read(), { player, terrain, facingRadians, placements } = api.state();
    if (record.orchard.stages[planting.branch] !== 'seed') { stopPlanting(); return; }
    const offered = record.orchard.site.plots[planting.branch];
    const canSuggest = range(offered, player) <= 92;
    if (planting.origin && (player.worldX !== planting.origin.worldX || player.worldY !== planting.origin.worldY
      || facingRadians !== planting.origin.facingRadians)) planting.origin = null;
    const p = planting.origin && canSuggest ? nearby(offered) : ownerForestPlacementPoint(player, facingRadians);
    const disc = { ...p, radius: ORCHARD_PLANTING_RADIUS }, point = { x: p.worldX, y: p.worldY };
    const reason = !orchardYardContains(layout.home, point) ? 'Choose a spot within the homestead yard.'
      : !api.regionLoaded(disc) || !terrain.ready(disc) ? 'Waiting for the ground here to load.'
      : !orchardPlantingSpace(layout, record.parking, record.orchard, point) ? 'Leave room for the house, trees, and cart access.'
      : !terrain.sample(disc).placeable ? 'The tree needs dry, clear ground.'
      : api.occupied(disc) || !api.travelerClear(disc) || placements.some(tree => range(point, tree) <= tree.collisionRadius + disc.radius)
        ? 'Leave room around the existing trees, plants, and objects.' : '';
    const valid = !reason;
    if (preview?.worldX !== p.worldX || preview?.worldY !== p.worldY || preview?.valid !== valid) api.requestRender();
    preview = { ...p, valid, form: orchardTreeForm(record.forestId, planting.branch, point) };
    confirm.disabled = !valid || blocked();
    suggest.hidden = !canSuggest;
    suggest.disabled = blocked();
    const text = reason || 'Walk or turn to move the preview. Plant here when the tree fits.';
    if (copy.textContent !== text) copy.textContent = text;
  }
  const useSuggestion = () => {
    if (!planting || blocked()) return;
    const { player, facingRadians } = api.state();
    planting.origin = { ...player, facingRadians };
    api.focus(); updatePreview();
  };
  choose.forEach((button, branch) => button.addEventListener('click', () => {
    if (planting || !canChoose() || blocked() || read()?.orchard?.stages[branch] !== 'seed') return;
    planting = { branch, origin: null };
    toolbar.hidden = false;
    viewport.dataset.orchardPlanting = 'true';
    useSuggestion();
  }));
  toolbar.querySelector('[data-orchard-cancel]').addEventListener('click', () => stopPlanting());
  suggest.addEventListener('click', useSuggestion);
  async function plantHere() {
    updatePreview();
    if (!planting || !preview?.valid || !canAct() || blocked()) return;
    const { branch } = planting, plot = { x: preview.worldX, y: preview.worldY };
    if (await save('orchard-plant', { branch, plot })) {
      stopPlanting();
      say(`${scene().varieties[branch].name} planted. Pick its first fruit when you’re ready.`);
    }
  }
  confirm.addEventListener('click', plantHere);
  toolbar.addEventListener('keydown', event => {
    if (event.key === 'Escape') { stopPlanting(); event.preventDefault(); event.stopPropagation(); }
  });
  return {
    plantingActive: () => Boolean(planting),
    plantingKey(event) {
      if (!planting) return false;
      if (event.key === 'Escape') { stopPlanting(); return true; }
      if (['Enter', ' '].includes(event.key)) { if (!event.repeat) plantHere(); return true; }
      return event.key.toLowerCase() === 'e';
    },
    stopPlanting,
    update(player) {
      if (planting && !canAct()) stopPlanting(false);
      updatePreview();
      activeAction = planting ? null : nextAction(player);
      action.hidden = !activeAction;
      action.disabled = Boolean(activeAction && blocked());
      if (activeAction && action.textContent !== activeAction.label) action.textContent = activeAction.label;
      const canPlant = !planting && api.amberClearingEnabled && canChoose(), data = scene(), record = read();
      choose.forEach((button, index) => {
        button.hidden = !canPlant || record?.orchard?.stages[index] !== 'seed';
        button.disabled = blocked();
        if (!button.hidden) {
          const text = `Choose spot for ${data.varieties[index].name.toLowerCase()}`;
          if (button.textContent !== text) button.textContent = text;
        }
      });
      if (satchel) {
        const seeds = data?.varieties.filter((_, i) => record.orchard.stages[i] === 'seed').map(v => v.name) || [];
        const dyes = availableOrchardDyes(record);
        const lines = [seeds.length ? `Seeds to plant in your yard: ${seeds.join(', ')}.` : '',
          dyes.length ? `Workshop dyes: ${data.varieties.filter(v => dyes.includes(v.dye)).map(v => v.name).join(', ')}.` : ''].filter(Boolean);
        satchel.hidden = !lines.length;
        const text = lines.join(' ');
        if (satchel.textContent !== text) satchel.textContent = text;
      }
    },
    surveyStatus() {
      if (!api.amberClearingEnabled) return null;
      return read()?.orchard ? 'mapped' : blocked() ? 'blocked' : 'ready';
    },
    async survey() {
      if (this.surveyStatus() === 'ready' && !await save('orchard-survey')) return;
      if (scene()) {
        api.navigation.navigate('orchard-fork');
        say('Orchard Fork is in Navigate. The pale road leads as far as the cairn.');
      }
    },
    destinations(mounted) {
      const data = scene();
      if (!data) return [];
      const { road } = data, orchard = read().orchard;
      const slot = orchard.stages.findIndex(stage => stage === 'seed' || stage === 'planted');
      const plot = data.trees[slot] || orchard.site.plots[slot];
      const isSuggested = plot === orchard.site.plots[slot] || orchard.site.plots[slot]?.x === plot?.x
        && orchard.site.plots[slot]?.y === plot?.y;
      return [{ id: 'orchard-fork', label: 'Orchard Fork', ...nearby(road.fork), nearbyRadius: 64,
        waypoint: player => mounted ? orchardReturnWaypoint(road, player) || orchardStonePassage(road, player, false)
          || amberClearingBend(road.route, player, false) : null },
      ...(slot < 0 ? [] : [{ id: 'orchard-plot', label: orchard.stages[slot] === 'seed' ? 'Suggested orchard spot' : 'Fruit tree at home',
        ...nearby(plot), nearbyRadius: 49,
        waypoint: player => mounted ? this.wayHome(player, true)
          : isSuggested && range(layout.home, player) <= 280 ? orchardPlotApproach(layout.home, plot, player) : null }])];
    },
    wayHome(player, mounted) {
      const data = scene();
      return data && mounted ? orchardReturnWaypoint(data.road, player) || orchardStonePassage(data.road, player, true)
        || amberClearingBend(data.road.route, player, true) : null;
    },
    placementAllowed(point, radius) {
      const orchard = read()?.orchard;
      return !orchard || orchardPlacementAllowed(layout, orchard, point, radius);
    },
    blocks(disc, from) {
      const data = scene();
      if (!data) return false;
      return orchardCairnBlocks(data.road.cairn, disc, from)
        || data.road.branches.some(branch => orchardTreeBlocks(branch.tree, disc, from))
        || data.trees.some(tree => tree && orchardTreeBlocks(tree, disc, from));
    },
    distance(player) {
      const data = scene();
      if (!data) return Infinity;
      const { site, stages } = read().orchard;
      const revealed = site.plots.flatMap((plot, index) => data.trees[index] || (stages[index] === 'seed' ? [plot] : []));
      return Math.min(...data.road.branches.map(branch => range(branch.tree, player)), ...revealed.map(p => range(p, player)));
    },
    paintGround(ctx, camera) {
      const data = scene();
      if (!data) return;
      const { end, fork, branches, extendsAmber } = data.road;
      if (extendsAmber) paintAmberTrail(ctx, [end, fork], camera);
      ctx.save(); ctx.strokeStyle = 'rgba(190,169,119,.28)'; ctx.lineWidth = 18; ctx.lineCap = 'round';
      for (const { apron } of branches) {
        ctx.beginPath(); ctx.moveTo(fork.x - camera.x, fork.y - camera.y);
        ctx.lineTo(fork.x + Math.sign(apron.x - fork.x) * 72 - camera.x, fork.y + Math.sign(apron.y - fork.y) * 72 - camera.y);
        ctx.stroke();
        ellipse(ctx, apron.x - camera.x, apron.y - camera.y, 31, 19, 'rgba(177,166,116,.24)');
      }
      branches.forEach(({ tree }, index) => {
        if (visible(tree, camera)) paintGroveFloor(ctx, tree.x - camera.x, tree.y - camera.y, data.varieties[index], index);
      });
      const { site, stages } = read().orchard;
      site.plots.forEach((suggested, index) => {
        const stage = stages[index];
        if (stage === 'undiscovered') return;
        const plot = data.trees[index] || suggested;
        const x = plot.x - camera.x, y = plot.y - camera.y, side = Math.sign(plot.x - layout.home.x);
        if (fruitTree(stage)) ellipse(ctx, x, y, 23, 12, 'rgba(78,61,38,.49)');
        const stoneColor = stage === 'seed' ? '#d4c9a4' : '#a3a080';
        for (const [dx, dy] of [[26, 3], [34, -1], [40, 3]]) ellipse(ctx, x + side * dx, y + dy, 4, 2, stoneColor);
      });
      if (preview) {
        ctx.beginPath();
        ctx.ellipse(preview.worldX - camera.x, preview.worldY - camera.y, ORCHARD_PLANTING_RADIUS,
          ORCHARD_PLANTING_RADIUS, 0, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = preview.valid ? '#e1d9a2' : '#e9967e';
        ctx.fillStyle = preview.valid ? 'rgba(219,213,157,.15)' : 'rgba(180,93,73,.23)';
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    },
    depthItems(camera) {
      const data = scene();
      if (!data) return [];
      const { road, varieties, wildForms, yardForms } = data;
      const trees = road.branches.map(({ tree }, index) => ({ point: tree, index, variety: varieties[index], form: wildForms[index] }));
      const planted = data.trees.flatMap((point, index) => point
        ? [{ point, index, variety: varieties[index], form: yardForms[index], garden: true }] : []);
      const ghost = preview && planting ? [{ point: { x: preview.worldX, y: preview.worldY }, garden: true, ghost: true,
        index: planting.branch, variety: varieties[planting.branch], form: preview.form }] : [];
      return [{ point: road.cairn, cairn: true }, { point: road.branches[1].cue, cue: true }, ...trees, ...planted, ...ghost]
        .filter(item => visible(item.point, camera)).map(item => ({ ...item, kind: 'extension', type: 'orchard',
          id: `orchard-${item.point.x}:${item.point.y}`, worldY: item.point.y }));
    },
    paint(ctx, item, camera) {
      const x = item.point.x - camera.x, y = item.point.y - camera.y;
      if (item.cairn) paintCairn(ctx, x, y);
      else if (item.cue) {
        for (let i = 0; i < 7; i++) {
          const dx = i * 5 - 17, dy = (i * 7 % 13) - 5;
          ellipse(ctx, x + dx, y + dy, 4, 11, '#58796a', (i - 3) * .2);
          ellipse(ctx, x + dx + (i - 3) * 2, y + dy - 11, 3, 4, i % 2 ? '#9ba4b9' : '#7f8eaa');
        }
      } else {
        ctx.save();
        if (item.ghost) ctx.globalAlpha = .55;
        paintTree(ctx, x, y, item.variety, item.form, item.index, item.garden);
        ctx.restore();
      }
    }
  };
}
