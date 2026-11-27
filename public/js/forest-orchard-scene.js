import { availableOrchardDyes, orchardCairnBlocks, orchardPlacementAllowed, orchardPlotApproach, orchardReturnWaypoint, orchardRoad,
  orchardStonePassage, orchardTreeBlocks, orchardTreeForm, orchardVariety, orchardPlanting, orchardYardContains,
  ORCHARD_PLANTING_RADIUS } from './forest-orchard.js';
import { orchardPlantingSpace } from './forest-home-reservations.js';
import { ownerForestPlacementPoint } from './owner-forest-scene.js';
import { amberClearingBend } from './forest-amber-clearing.js';
import { paintAmberTrail } from './forest-homestead-paint.js';
import { outingBlocks, outingPlacementAllowed, preservingHearth, provisionerSite, quinceIsRipe,
  reservationsAllow, villageReservations, walledOrchardSite } from './forest-orchard-outing.js';
import { terrainPointSegmentDistance } from './owner-forest-terrain.js';
import { displayedItem, itemCount, QUINCE_JAM, WOVEN_TRIM } from './forest-village-goods.js';
import { createVillageStand } from './forest-village-stand.js';

const range = (point, pose) => Math.hypot(point.x - pose.worldX, point.y - pose.worldY);
const nearby = point => ({ worldX: point.x, worldY: point.y });
const visible = (p, c) => p.x >= c.x - 68 && p.x <= c.x + c.width + 68
  && p.y >= c.y - 22 && p.y <= c.y + c.height + 114;
const fruitTree = stage => stage === 'planted' || stage === 'harvested';

function ellipse(ctx, x, y, width, height, color, angle = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, width, height, angle, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
}

function paintTree(ctx, x, y, { palette, leaf, variant }, form, index, garden, bare) {
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
    if (bare || garden && i % 2) return;
    ellipse(ctx, fx * spread, fy, index ? 3.6 : 4.7, index ? 4.6 : 5, palette[i % 2]);
    ellipse(ctx, fx * spread - 1, fy - 1.6, 1.6, 1.2, palette[2]);
  });
  ctx.restore();
}

function paintGroveFloor(ctx, x, y, variety, index, bare = false) {
  ellipse(ctx, x - 6, y - 4, 69, 32, index ? 'rgba(80,106,66,.31)' : 'rgba(168,153,92,.23)', -.12);
  for (const [dx, dy, lean] of [[-49, -8, -3], [-40, 12, 2], [-30, -19, -2], [29, 17, 4], [42, -8, 2], [55, 5, 4]]) {
    const px = x + dx, py = y + dy;
    ctx.beginPath(); ctx.moveTo(px - 3, py); ctx.lineTo(px + lean - 4, py - 7); ctx.lineTo(px + lean + 2, py - 3);
    ctx.lineTo(px + 6, py - 8); ctx.lineTo(px + 4, py); ctx.closePath();
    ctx.fillStyle = variety.leaf[1]; ctx.fill();
  }
  if (bare) return;
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

function paintJar(ctx, x, y, contents, lid) {
  ctx.fillStyle = '#342b23'; ctx.fillRect(x - 7, y - 13, 14, 13);
  ctx.fillStyle = contents; ctx.fillRect(x - 6, y - 12, 12, 10);
  ctx.fillStyle = '#f2dfb7'; ctx.fillRect(x - 4, y - 11, 2, 5);
  ctx.fillStyle = lid; ctx.fillRect(x - 7, y - 15, 14, 4);
}

function paintProvisioner(ctx, x, y, hasJar) {
  ctx.save(); ctx.translate(x, y);
  ellipse(ctx, 2, 1, 37, 12, 'rgba(29,35,24,.29)');
  ctx.fillStyle = '#5b4434'; ctx.fillRect(-27, -56, 5, 58); ctx.fillRect(23, -56, 5, 56);
  ctx.fillStyle = '#9b744c'; ctx.fillRect(-30, -31, 60, 31);
  ctx.fillStyle = '#c7a172'; ctx.fillRect(-33, -34, 66, 6);
  ctx.fillStyle = '#664d38'; ctx.fillRect(-26, -18, 52, 5);
  ctx.fillStyle = '#c2b59a';
  for (const dx of [-17, -7, 13]) {
    ctx.fillRect(dx, -43, 7, 9);
    ctx.fillStyle = '#e1d6b6'; ctx.fillRect(dx + 1, -44, 6, 2); ctx.fillStyle = '#c2b59a';
  }
  if (hasJar) paintJar(ctx, 9, -13, '#e8a83d', '#faf0c9');
  ctx.fillStyle = '#97603f'; ctx.fillRect(-33, -64, 66, 12);
  for (const dx of [-28, -13, 2, 17]) ctx.fillRect(dx, -53, 9, 5);
  ctx.fillStyle = '#c48759'; ctx.fillRect(-33, -64, 66, 3);
  ctx.restore();
}

function paintPreservingHearth(ctx, x, y, cleanJar) {
  ctx.save(); ctx.translate(x, y);
  ellipse(ctx, 3, 1, 34, 12, 'rgba(30,35,25,.25)');
  ctx.fillStyle = '#614b39'; ctx.fillRect(-27, -20, 5, 21); ctx.fillRect(-3, -20, 5, 19);
  ctx.fillStyle = '#b99466'; ctx.fillRect(-31, -24, 37, 5);
  ctx.fillStyle = '#d6c8a0'; ctx.fillRect(-26, -26, 15, 6); ctx.fillRect(-14, -22, 3, 8);
  ellipse(ctx, 15, -3, 16, 7, '#686a60');
  ellipse(ctx, 15, -9, 16, 7, '#9a9985');
  ellipse(ctx, 15, -10, 10, 5, '#594c3d');
  ctx.fillStyle = '#46382f'; ctx.fillRect(0, -22, 5, 3); ctx.fillRect(26, -22, 5, 3);
  ellipse(ctx, 15, -20, 12, 9, '#965534');
  ellipse(ctx, 15, -26, 12, 4, '#cf8854');
  ellipse(ctx, 15, -26, 9, 2.5, '#564136');
  if (cleanJar) paintJar(ctx, -6, -24, '#cfceb4', '#f1dab0');
  ctx.restore();
}

function paintPlayerStand(ctx, x, y, village) {
  const mat = village?.standArrangement === 'barter-mat';
  const item = displayedItem(village, 'stand');
  ctx.save(); ctx.translate(x - 14, y + 11);
  ctx.fillStyle = '#624632'; ctx.fillRect(-14, -15, 4, 15); ctx.fillRect(10, -15, 4, 15);
  ctx.fillStyle = '#a77750'; ctx.fillRect(-17, -17, 34, 5);
  ctx.fillStyle = '#d6ad7b'; ctx.fillRect(-17, -23, 34, 7);
  if (mat) {
    ctx.fillStyle = '#477b77'; ctx.fillRect(-11, -22, 22, 12);
    ctx.fillStyle = '#f0d6a0'; ctx.fillRect(-11, -12, 22, 1);
  } else {
    ctx.fillStyle = '#bb8a60'; ctx.fillRect(-14, -26, 28, 5);
  }
  if (item === QUINCE_JAM) paintJar(ctx, mat ? 0 : -8, mat ? -17 : -25, '#e8a83d', '#faf0c9');
  else if (item === WOVEN_TRIM) {
    ctx.fillStyle = '#477b77'; ctx.fillRect(-9, -28, 18, 5);
    ctx.fillStyle = '#f0d6a0'; ctx.fillRect(-9, -26, 18, 1);
  }
  ctx.restore();
}

function paintWallStone(ctx, x, y) {
  ellipse(ctx, x + 2, y, 12, 5, 'rgba(32,34,25,.24)');
  ellipse(ctx, x, y - 5, 11, 8, '#6e7165', -.12);
  ellipse(ctx, x - 1, y - 12, 11, 7, '#8e9080', .16);
  ellipse(ctx, x - 2, y - 17, 9, 4, '#a6a28b', .08);
}

function paintJarSign(ctx, x, y) {
  ctx.fillStyle = '#604631'; ctx.fillRect(x - 2, y - 24, 4, 25);
  ctx.fillStyle = '#a9784e'; ctx.fillRect(x - 11, y - 30, 22, 17);
  ctx.fillStyle = '#e0c89b'; ctx.fillRect(x - 4, y - 25, 8, 9); ctx.fillRect(x - 3, y - 27, 6, 1);
}

export function createForestOrchardScene({ api, dock, layout, read, canAct, canEat, blocked, save, say }) {
  const viewport = dock.closest('[data-owner-forest-viewport]');
  const action = document.createElement('button');
  action.type = 'button'; action.hidden = true; action.dataset.orchardAction = '';
  const villageAction = document.createElement('button'), keepQuince = document.createElement('button');
  villageAction.type = keepQuince.type = 'button';
  villageAction.hidden = keepQuince.hidden = true;
  villageAction.dataset.villageAction = '';
  keepQuince.dataset.keepQuince = '';
  keepQuince.textContent = 'Keep the quince';
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
  if (api.amberClearingEnabled) dock.append(action, villageAction, keepQuince, ...choose, toolbar);
  const satchel = document.querySelector('[data-orchard-satchel]');
  let lastRecord, cached, activeAction, planting = null, preview = null;
  let lastOutingRecord, stall, wall, walledTree, hearth, provisionerSide, activeVillage, keptQuinceHere = false;
  const stand = api.amberClearingEnabled && satchel ? createVillageStand({ dock, satchel, read: () => read()?.village,
    blocked, canEat, save: (action, args) => save(action, { provisionerSide, ...args }), focus: () => api.focus(), say }) : null;
  function refreshOuting() {
    const record = read();
    if (record === lastOutingRecord) return;
    lastOutingRecord = record;
    const outing = record?.orchard?.outing;
    provisionerSide = outing?.provisionerSide ?? record?.provisionerSide;
    stall = provisionerSide == null ? null : provisionerSite(layout, provisionerSide);
    hearth = stall && api.amberClearingEnabled && record?.preservingHearthAvailable
      ? preservingHearth(layout, provisionerSide) : null;
    wall = outing ? walledOrchardSite(layout, record.orchard.site, outing.spurLength) : null;
    walledTree = wall && { point: wall.tree, index: 0, variety: orchardVariety(record.forestId, 0),
      form: orchardTreeForm(record.forestId, 0, wall.tree) };
  }
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
    refreshOuting();
    const choices = orchard.stages.flatMap((stage, branch) => {
      const name = data.varieties[branch].name;
      const oldQuince = wall && branch === 0;
      const wild = stage === 'undiscovered' && !oldQuince ? collection(branch, data.road.branches[branch].tree)
        : { branch, kind: 'inspect', label: oldQuince ? 'Look at the old quince' : `Look at the wild ${name.toLowerCase()}`,
          at: data.road.branches[branch].tree, notice: oldQuince
            ? 'There’s no fruit on the old quince. The track beyond the cairn leads to the tree inside the wall.'
            : wildTreeNotice(branch, stage) };
      const yard = stage === 'planted' ? { branch, kind: 'harvest', label: `Pick first ${name.toLowerCase()}`, at: data.trees[branch],
        notice: `${name} dye unlocked. At the workshop, fit a cover and look under Cloth color.` }
        : { branch, kind: 'inspect', label: `Check your ${name.toLowerCase()} tree`, at: data.trees[branch],
          notice: 'You’ve picked the first fruit. Its dye is available whenever you fit a cloth cover at the workshop.' };
      return data.trees[branch] ? [wild, yard] : [wild];
    });
    if (wall?.inside(player)) {
      choices.push(orchard.stages[0] === 'undiscovered' ? collection(0, wall.tree) : {
        branch: 0, kind: 'inspect', label: 'Look at the walled quince', at: wall.tree,
        notice: walledTreeNotice(orchard.stages[0]) });
    }
    return choices.filter(option => range(option.at, player) <= 52)
      .sort((a, b) => range(a.at, player) - range(b.at, player))[0];
  }
  function collection(branch, at) {
    const name = scene().varieties[branch].name;
    return { branch, kind: 'collect', label: `Collect the ${name.toLowerCase()} seed`, at,
      notice: `${name} seed in your Satchel. Choose a planting spot at home, or ask Tansy about it on the way back.` };
  }
  function wildTreeNotice(branch, stage) {
    const kind = branch === 0 ? 'quince' : 'damson';
    if (stage === 'seed') return `You can smell the ${kind} here. Its seed is in your Satchel, ready to plant at home.`;
    if (stage === 'planted') return `The wild ${kind} is still here. The tree you planted at home has its first fruit.`;
    return `The wild ${kind} is still here. The fruit from your own tree has given you a dye for your cart cover.`;
  }
  function walledTreeNotice(stage) {
    const village = read()?.village;
    if (hearth && village?.carryingQuince) return 'There’s already a quince in your Satchel. The hearth by Tansy’s stall is ready for it.';
    if (hearth && !quinceIsRipe(village)) return 'The quince has been picked today. Check the tree again tomorrow.';
    return wildTreeNotice(0, stage);
  }
  function nextVillageAction(player) {
    refreshOuting();
    if (!hearth || planting || !canAct() || !api.regionLoaded(player)) return null;
    const village = read()?.village;
    if (range(hearth.walk.at(-1), player) <= 32) {
      if (village?.carryingQuince) return keptQuinceHere ? null : {
        kind: 'village-make-preserves', label: 'Make quince jam',
        notice: 'A jar of quince jam is in your Satchel.'
      };
      if (!village?.cleanJar) return { kind: 'village-set-jar', label: 'Set out a clean jar',
        notice: 'The clean jar is ready by the pot.' };
      return null;
    }
    if (wall?.inside(player) && range(wall.tree, player) <= 52
      && !village?.carryingQuince && quinceIsRipe(village)) {
      return { kind: 'village-pick-quince', label: 'Pick a quince',
        notice: 'A quince is in your Satchel. You can bring it to the hearth by Tansy’s stall.' };
    }
    return null;
  }
  villageAction.addEventListener('click', async () => {
    const current = nextVillageAction(api.state().player);
    if (!current || current.kind !== activeVillage?.kind || blocked()) return;
    api.focus();
    if (await save(current.kind, { provisionerSide })) say(current.notice);
  });
  keepQuince.addEventListener('click', () => {
    if (nextVillageAction(api.state().player)?.kind !== 'village-make-preserves' || blocked()) return;
    keptQuinceHere = true;
    villageAction.hidden = keepQuince.hidden = true;
    api.focus();
    say('You keep the quince in your Satchel.');
  });
  action.addEventListener('click', async () => {
    const current = nextAction(api.state().player);
    if (!current || current.at !== activeAction?.at || current.kind !== activeAction.kind || current.kind !== 'inspect' && blocked()) return;
    api.focus();
    if (current.kind === 'inspect' || await save(`orchard-${current.kind}`, { branch: current.branch })) say(current.notice);
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
      action.disabled = Boolean(activeAction && activeAction.kind !== 'inspect' && blocked());
      if (activeAction && action.textContent !== activeAction.label) action.textContent = activeAction.label;
      if (hearth && range(hearth.walk.at(-1), player) > 32) keptQuinceHere = false;
      activeVillage = nextVillageAction(player);
      villageAction.hidden = !activeVillage;
      keepQuince.hidden = activeVillage?.kind !== 'village-make-preserves';
      villageAction.disabled = keepQuince.disabled = blocked();
      if (activeVillage && villageAction.textContent !== activeVillage.label) villageAction.textContent = activeVillage.label;
      const villageNearby = hearth && !planting && canAct() && api.regionLoaded(player);
      stand?.update({ nearStand: villageNearby && range(hearth.walk.at(-1), player) <= 32,
        nearShelf: villageNearby && range(stall.stall, player) <= 62 });
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
          hearth && record?.village?.carryingQuince ? 'Fruit: 1 quince.' : '',
          dyes.length ? `Workshop dyes: ${data.varieties.filter(v => dyes.includes(v.dye)).map(v => v.name).join(', ')}.` : ''].filter(Boolean);
        satchel.hidden = !lines.length;
        const text = lines.join(' ');
        if (satchel.textContent !== text) satchel.textContent = text;
      }
    },
    provisioner() {
      refreshOuting();
      return stall;
    },
    progress() {
      const data = scene(), stages = read()?.orchard?.stages;
      if (!data) return null;
      const stage = ['seed', 'planted', 'harvested'].find(value => stages.includes(value));
      const branch = stages.indexOf(stage);
      if (branch < 0) return null;
      return { stage, names: data.varieties.filter((_, i) => stages[i] === stage).map(variety => variety.name),
        destination: stage === 'harvested' ? 'home' : `orchard-plot-${branch}` };
    },
    surveyStatus(walled = false) {
      if (!api.amberClearingEnabled) return null;
      if (walled) return read()?.orchard?.outing ? 'mapped' : blocked() ? 'blocked' : 'ready';
      return read()?.orchard ? 'mapped' : blocked() ? 'blocked' : 'ready';
    },
    async survey(walled = false) {
      if (this.surveyStatus(walled) === 'ready') {
        const saved = walled ? await save('orchard-outing', { provisionerSide: read()?.provisionerSide })
          : await save('orchard-survey');
        if (!saved) return;
      }
      if (scene()) {
        api.navigation.navigate('orchard-fork');
        say(walled ? 'Follow the compass to the cairn. Look for the road that carries on beyond it.'
          : 'Orchard Fork is in Navigate. The pale road leads as far as the cairn.');
      }
    },
    destinations(mounted) {
      refreshOuting();
      const data = scene();
      const provisioner = stall ? [{ id: 'provisioner', label: 'Provisioner’s stall',
        ...(mounted ? nearby(stall.bay) : stall.tansy), nearbyRadius: mounted ? 42 : 48,
        waypoint: player => mounted && range(stall.turn, player) > 62 && range(stall.bay, player) > 58
          ? this.wayHome(player, true) || amberClearingBend(layout.route, player, true)
            || { ...nearby(stall.turn), label: 'Turn at the stall' } : null }] : [];
      if (!data) return provisioner;
      const { road } = data, orchard = read().orchard;
      const plots = orchard.stages.flatMap((stage, branch) => {
        if (!['seed', 'planted'].includes(stage)) return [];
        const suggested = orchard.site.plots[branch], plot = data.trees[branch] || suggested;
        const isSuggested = suggested.x === plot.x && suggested.y === plot.y;
        return [{ id: `orchard-plot-${branch}`,
          label: stage === 'seed' ? `Plant ${data.varieties[branch].name.toLowerCase()}` : `${data.varieties[branch].name} tree at home`,
          ...nearby(plot), nearbyRadius: 49,
          waypoint: player => mounted ? this.wayHome(player, true)
            : isSuggested && range(layout.home, player) <= 280 ? orchardPlotApproach(layout.home, plot, player) : null }];
      });
      return [...provisioner, { id: 'orchard-fork', label: 'Orchard Fork', ...nearby(road.fork), nearbyRadius: 64,
        waypoint: player => mounted ? this.stallExit(player) || orchardReturnWaypoint(road, player) || orchardStonePassage(road, player, false)
          || amberClearingBend(road.route, player, false) : null },
      ...(wall ? [{ id: 'walled-orchard', label: 'Orchard wall pull-off', ...nearby(wall.apron), nearbyRadius: 42,
          waypoint: player => {
            if (!mounted || this.onSpur(player) || range(road.fork, player) <= 60) return null;
            return this.stallExit(player) || orchardStonePassage(road, player, false) || amberClearingBend(road.route, player, false)
              || { ...nearby(road.fork), label: 'Fork' };
          } }] : []),
      ...plots];
    },
    onSpur(player) {
      return wall && terrainPointSegmentDistance({ x: player.worldX, y: player.worldY }, wall.fork, wall.apron) <= 80;
    },
    stallExit(player) {
      if (!stall || range(stall.bay, player) > 95) return null;
      const lateral = terrainPointSegmentDistance({ x: player.worldX, y: player.worldY }, ...layout.route.slice(0, 2));
      return lateral > 40 ? { ...nearby(stall.turn), label: 'Road' } : null;
    },
    wayHome(player, mounted) {
      refreshOuting();
      const data = scene();
      if (!mounted) return null;
      return this.stallExit(player) || (data ? (this.onSpur(player) && range(wall.fork, player) > 48 ? { ...nearby(wall.fork), label: 'Fork' } : null)
        || orchardReturnWaypoint(data.road, player) || orchardStonePassage(data.road, player, true)
        || amberClearingBend(data.road.route, player, true) : null);
    },
    placementAllowed(point, radius) {
      refreshOuting();
      const orchard = read()?.orchard;
      return (!orchard || orchardPlacementAllowed(layout, orchard, point, radius))
        && (!orchard?.outing || outingPlacementAllowed(layout, orchard, point, radius))
        && (!hearth || reservationsAllow(villageReservations(layout, provisionerSide, Boolean(orchard?.outing)), point, radius));
    },
    blocks(disc, from) {
      refreshOuting();
      if (stall && outingBlocks(stall.solids.slice(0, 1), disc, from) || wall && outingBlocks(wall.solids, disc, from)) return true;
      if (hearth && outingBlocks([hearth.solid], disc, from)) return true;
      const data = scene();
      if (!data) return false;
      return orchardCairnBlocks(data.road.cairn, disc, from)
        || data.road.branches.some(branch => orchardTreeBlocks(branch.tree, disc, from))
        || data.trees.some(tree => tree && orchardTreeBlocks(tree, disc, from));
    },
    distance(player) {
      refreshOuting();
      const outingDistance = Math.min(stall ? range(stall.stall, player) : Infinity,
        hearth ? range(hearth.hearth, player) : Infinity,
        wall ? Math.min(range(wall.apron, player), range(wall.tree, player)) : Infinity);
      const data = scene();
      if (!data) return outingDistance;
      const { site, stages } = read().orchard;
      const revealed = site.plots.flatMap((plot, index) => data.trees[index] || (stages[index] === 'seed' ? [plot] : []));
      return Math.min(outingDistance, ...data.road.branches.map(branch => range(branch.tree, player)), ...revealed.map(p => range(p, player)));
    },
    paintGround(ctx, camera) {
      refreshOuting();
      if (stall) {
        paintAmberTrail(ctx, [stall.turn, stall.bay], camera);
        ctx.save();
        ctx.strokeStyle = 'rgba(182,160,113,.24)'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.setLineDash([9, 13]);
        ctx.beginPath(); ctx.moveTo(stall.bay.x - camera.x, stall.bay.y - camera.y);
        ctx.lineTo(stall.footpath.b.x - camera.x, stall.footpath.b.y - camera.y); ctx.stroke();
        if (hearth) {
          ctx.beginPath();
          ctx.moveTo(hearth.walk[0].x - camera.x, hearth.walk[0].y - camera.y);
          for (const p of hearth.walk.slice(1)) ctx.lineTo(p.x - camera.x, p.y - camera.y);
          ctx.stroke();
        }
        ctx.restore();
      }
      if (wall) {
        paintAmberTrail(ctx, [wall.fork, wall.apron], camera);
        ellipse(ctx, wall.opening.x - camera.x, wall.opening.y - camera.y, 12, 8, 'rgba(194,172,126,.3)');
        if (visible(wall.tree, camera)) paintGroveFloor(ctx, wall.tree.x - camera.x, wall.tree.y - camera.y,
          walledTree.variety, 0, Boolean(hearth && !quinceIsRipe(read()?.village)));
      }
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
        if (visible(tree, camera)) paintGroveFloor(ctx, tree.x - camera.x, tree.y - camera.y, data.varieties[index], index,
          Boolean(wall && index === 0));
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
      refreshOuting();
      const village = read()?.village;
      const outing = [...(stall ? [{ point: stall.stall, stall: true }, { point: stall.sign, sign: true }] : []),
        ...(hearth ? [{ point: hearth.hearth, hearth: true }] : []),
        ...(wall ? [{ ...walledTree, bare: Boolean(hearth && !quinceIsRipe(village)) },
          ...wall.stones.map(point => ({ point, stone: true }))] : [])];
      const items = list => list.filter(item => visible(item.point, camera)).map(item => ({
        ...item, kind: 'extension', type: 'orchard', id: `orchard-${item.point.x}:${item.point.y}`, worldY: item.point.y
      }));
      const data = scene();
      if (!data) return items(outing);
      const { road, varieties, wildForms, yardForms } = data;
      const trees = road.branches.map(({ tree }, index) => ({ point: tree, index, variety: varieties[index],
        form: wildForms[index], bare: Boolean(wall && index === 0) }));
      const planted = data.trees.flatMap((point, index) => point
        ? [{ point, index, variety: varieties[index], form: yardForms[index], garden: true,
          bare: read().orchard.stages[index] === 'harvested' }] : []);
      const ghost = preview && planting ? [{ point: { x: preview.worldX, y: preview.worldY }, garden: true, ghost: true,
        index: planting.branch, variety: varieties[planting.branch], form: preview.form }] : [];
      return items([{ point: road.cairn, cairn: true }, { point: road.branches[1].cue, cue: true }, ...trees, ...planted, ...ghost, ...outing]);
    },
    paint(ctx, item, camera) {
      const x = item.point.x - camera.x, y = item.point.y - camera.y;
      if (item.stall) paintProvisioner(ctx, x, y, hearth && itemCount(read()?.village, 'stall-shelf', QUINCE_JAM));
      else if (item.hearth) {
        paintPreservingHearth(ctx, x, y, read()?.village?.cleanJar);
        paintPlayerStand(ctx, x, y, read()?.village);
      }
      else if (item.sign) paintJarSign(ctx, x, y);
      else if (item.stone) paintWallStone(ctx, x, y);
      else if (item.cairn) paintCairn(ctx, x, y);
      else if (item.cue) {
        for (let i = 0; i < 7; i++) {
          const dx = i * 5 - 17, dy = (i * 7 % 13) - 5;
          ellipse(ctx, x + dx, y + dy, 4, 11, '#58796a', (i - 3) * .2);
          ellipse(ctx, x + dx + (i - 3) * 2, y + dy - 11, 3, 4, i % 2 ? '#9ba4b9' : '#7f8eaa');
        }
      } else {
        ctx.save();
        if (item.ghost) ctx.globalAlpha = .55;
        paintTree(ctx, x, y, item.variety, item.form, item.index, item.garden, item.bare);
        ctx.restore();
      }
    }
  };
}
