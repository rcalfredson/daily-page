import { queryOwnerTerrain as queryTerrainProof, sampleOwnerTerrain as sampleTerrainProof } from '../../public/js/owner-forest-terrain-authority.js';
import { ownerForestCellsAround } from '../../public/js/owner-forest-scene.js';
import { buildForestOwnerTerrainRegionService } from '../../server/services/forestOwnerTerrainRegion.js';
import { buildForestOwnerTerrainRegionRouteHandler, privateForestApiResponse } from '../../server/api/v1/forest.js';
import { ForestAuthoredMutationError } from '../../server/services/forestAuthoredObjectMutation.js';
import { buildForestAuthoredReturnDestinationService } from '../../server/services/forestAuthoredReturnDestination.js';
import { buildForestAuthoredObjectReadService } from '../../server/services/forestAuthoredObjectRead.js';
import { buildForestAuthoredInspectionRouteHandler, buildForestAuthoredMutationRouteHandler, requireForestAuthoredMutationOrigin } from '../../server/api/v1/forest.js';
import { ForestOwnerTreeInspectionError } from '../../server/services/forestOwnerTreeInspection.js';
// Isolated Firefox BiDi walkthrough; no database connection or real account.
// Start Firefox with --headless --no-remote --profile /tmp/forest-return-firefox
// --remote-debugging-port 9224, then run this script with Node 24.
/* global WebSocket */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import express from 'express';
import pug from 'pug';
import { buildForestOwnerSceneBootstrapService } from '../../server/services/forestOwnerSceneBootstrap.js';
import { buildForestOwnerReturnDestinationService } from '../../server/services/forestOwnerReturnDestination.js';
import { buildForestRouteHandler } from '../../server/routes/forest.js';
import { forestWritingReturn } from '../../server/middleware/forestWritingReturn.js';
import { initI18n } from '../../server/services/i18n.js';
import { uiPrefixAndLangContext } from '../../server/middleware/uiPrefix.js';

const OWNER = '507f1f77bcf86cd799439011';
const TREE = '22222222-2222-4222-8222-222222222222';
const FOREST = '11111111-1111-4111-8111-111111111111';
const MARKER = '33333333-3333-4333-8333-333333333333';
const PLACE = '55555555-5555-4555-8555-555555555555';
const POST = '/rooms/general/blocks/507f1f77bcf86cd799439013';
const target = { id: TREE, worldX: -1500, worldY: 1500, collisionRadius: 20, scale: 1, assetKey: 'fixture-tree' };
const manifest = { status: 'ready', placements: [target], page: { nextCursor: null } };
const inspection = {
  status: 'ready', tree: { id: TREE, recordRevision: 1, phenotypeId: 'open-crown-deciduous', creationSeason: 'spring' },
  writing: { title: 'Remembered writing', path: POST, lang: 'en', createdAt: '2026-04-10T10:00:00Z' },
  translations: [{ title: 'Remembered writing', path: POST, lang: 'en' }], page: { nextCursor: null }
};
const terrainGeneration = process.env.FOREST_TERRAIN_GENERATION === '4' ? 4 : 3;
const serveOnly = process.env.FOREST_TERRAIN_SERVE_ONLY === 'true';
const terrainSeed = process.env.FOREST_TERRAIN_SEED || 'abcdefghijklmnopqrstuvwxyzABCDEF';
if (!/^[A-Za-z0-9_-]{32,80}$/.test(terrainSeed)) throw new Error('Invalid terrain fixture seed.');
const terrainActivation = { schemaVersion: 1, generationVersion: terrainGeneration,
  activationId: '77777777-7777-4777-8777-777777777777', revision: 1,
  state: 'active', phase: 'ready', cursor: null };
const terrainProtections = [
  { id: 'entrance', x: 0, y: 0, radius: 80 },
  { id: `tree:${TREE}`, x: target.worldX, y: target.worldY, radius: 56 },
  { id: `marker:${MARKER}`, x: -1420, y: 1500, radius: 45 },
  { id: `marker:${PLACE}`, x: -1580, y: 1500, radius: 45 }
];
const terrainWorld = () => ({
  schemaVersion: 1, forestId: FOREST, ownerUserId: OWNER, worldRole: 'primary', status: 'active',
  worldSeed: terrainSeed, placementPolicyVersion: 1,
  environmentPolicyVersion: 1, environmentSchemaVersion: 1, worldGenerationVersion: 1,
  reconciliation: { state: 'idle' }, ...(scenario.startsWith('terrain') ? { terrain: terrainActivation } : {})
});
const readTerrainFixture = async ({ bounds }) => queryTerrainProof({
  seed: terrainWorld().worldSeed, bounds, records: terrainProtections, generationVersion: terrainGeneration });
const terrainPredicate = async ({ world, position }) => {
  if (!world?.terrain) return () => true;
  const scene = await readTerrainFixture({ bounds: { minX: position.worldX - 120,
    maxX: position.worldX + 120, minY: position.worldY - 120, maxY: position.worldY + 120 } });
  return p => sampleTerrainProof(scene, { x: p.worldX, y: p.worldY }, p.radius).walkable;
};
const resolveReturnDestination = buildForestOwnerReturnDestinationService({
  ForestWritingTreeModel: { findOne: () => ({ lean: async () => ({ placement: target }) }) },
  inspectTree: async () => inspection,
  readManifest: async () => manifest, terrainPredicate
});
const marker = { objectId: MARKER, ownerUserId: OWNER, forestId: FOREST, schemaVersion: 2,
  identityVersion: 1, state: 'active', kind: 'personal-marker',
  placement: { worldX: -1420, worldY: 1500 }, placementIndex: { version: 1, cellX: -2, cellY: 2 },
  writingLink: { version: 1, writingTreeId: TREE }, creationFingerprint: { version: 2, digest: 'A'.repeat(43) },
  appearance: { id: 'quiet-waymarker', version: 1 }, recordRevision: 1,
  worldVersionEvidence: { ownerWorldSchemaVersion: 1, placementPolicyVersion: 1,
    environmentPolicyVersion: 1, environmentSchemaVersion: 1, worldGenerationVersion: 1 },
  createdAt: new Date('2026-11-03T12:00:00Z'), changedAt: new Date('2026-11-03T12:00:00Z'),
  removedAt: null, purgeEligibleAt: null };
const placeMarker = { ...marker, objectId: PLACE, schemaVersion: 1,
  placement: { worldX: -1580, worldY: 1500 }, placementIndex: { version: 1, cellX: -3, cellY: 2 },
  creationFingerprint: { version: 1, digest: 'A'.repeat(43) } };
delete placeMarker.writingLink;
let creationEnabled = false;
const createdMarkers = new Map();
const mutationRequests = [];
const ForestAuthoredObjectModel = { findOne: filter => ({ lean: async () => {
  const object = filter.objectId === MARKER ? marker : filter.objectId === PLACE ? placeMarker : createdMarkers.get(filter.objectId);
  return object && (!filter.state || object.state === filter.state)
    && (!filter.recordRevision || object.recordRevision === filter.recordRevision) ? globalThis.structuredClone(object) : null;
} }) };
const resolveMarkerReturnDestination = buildForestAuthoredReturnDestinationService({
  ForestAuthoredObjectModel, readManifest: async () => manifest, terrainPredicate
});
const readBootstrap = buildForestOwnerSceneBootstrapService({
  ForestOwnerWorldModel: { findOne: () => ({ lean: async () => terrainWorld() }) }, resolveReturnDestination, resolveMarkerReturnDestination, linkedCreationEnabled: () => creationEnabled
});
const app = express();
app.set('views', `${process.cwd()}/views`);
app.set('view engine', 'pug');
app.use(express.static('public'));
app.get('/dev/terrain-style-review', (req, res) => res.sendFile(`${process.cwd()}/scripts/dev/forestTerrainStyleReview.html`));
app.use(express.json());
app.use('/api/v1/forest', privateForestApiResponse);
// Include the production prefix guard: testing handlers alone missed GETs being rejected.
app.use('/api/v1/forest/authored-objects', requireForestAuthoredMutationOrigin);
app.use(uiPrefixAndLangContext);
app.use(initI18n(['layout', 'nav', 'forestScene', 'blockView']));
app.use((req, res, next) => { req.user = { id: OWNER, username: 'fixture' }; req.authSession = { _id: OWNER }; next(); });
let scenario = 'normal';
let requests = [];
app.get('/forest', (req, res, next) => {
  scenario = req.query.fixture || (serveOnly ? 'terrain' : 'normal');
  creationEnabled = scenario.startsWith('create');
  if (creationEnabled) { createdMarkers.clear(); mutationRequests.length = 0; }
  requests = [];
  // Use the full production template, but keep unrelated scripts and remote assets out of QA.
  res.render = (view, model) => {
    // Camera-only fixtures use the real production template, movement, terrain and region API.
    // Their temporary spawn is never persisted and adds no production navigation endpoint.
    if (terrainGeneration === 4 && scenario.startsWith('terrain-camera-')) {
      const scene = queryTerrainProof({ seed: terrainSeed, generationVersion: 4,
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 }, records: terrainProtections });
      const f = scene.features.find(f => f.stream);
      if (!f) throw new Error('Camera fixture needs an accepted water system.');
      const stream = f.stream;
      let p;
      if (scenario.endsWith('bridge')) p = f.bridges[1];
      else if (scenario.endsWith('lake')) {
        const edge = stream.outlet.outline[80], center = stream.outlet;
        const length = Math.hypot(edge.x - center.x, edge.y - center.y);
        p = { x: edge.x + (edge.x - center.x) / length * 30, y: edge.y + (edge.y - center.y) / length * 30 };
      } else {
        const i = scenario.endsWith('inlet') ? 142 : 80;
        const edge = stream.channels[0].outline[i], center = stream.points[i];
        const length = Math.hypot(edge.x - center.x, edge.y - center.y);
        p = { x: edge.x + (edge.x - center.x) / length * 30, y: edge.y + (edge.y - center.y) / length * 30 };
      }
      if (!sampleTerrainProof(queryTerrainProof({ seed: terrainSeed, generationVersion: 4,
        records: terrainProtections, bounds: { minX: p.x, maxX: p.x, minY: p.y, maxY: p.y } }), p, 11).walkable) {
        throw new Error('Camera fixture spawn is obstructed.');
      }
      model.bootstrap.spawn = { ...model.bootstrap.spawn, worldX: Math.round(p.x), worldY: Math.round(p.y) };
      delete model.bootstrap.returnDestination;
      model.bootstrap.delivery.initialCells = ownerForestCellsAround(model.bootstrap.spawn, model.bootstrap.spatialIndex.cellSize);
    }
    let html = pug.renderFile(`${process.cwd()}/views/${view}.pug`, { ...res.locals, ...model })
      .replace(/<script>[\s\S]*?<\/script>/g, '')
      .replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g, (tag, src) => src === '/js/owner-forest.js' ? tag : '')
      .replace(/<link\b[^>]*href="https?:[^>]*>/g, '');
    if (serveOnly) html = html.replace(/(<body\b[^>]*>)/, `$1<aside style="padding:12px;background:#263e31;color:#eee" role="note">Development fixture · no account data or durable writes · generation ${terrainGeneration}. Camera stops: ${
      ['bend', 'bridge', 'inlet', 'lake'].map(stop => `<a style="color:#dce9c7;margin-right:12px" href="/en/forest?fixture=terrain-camera-${stop}">${stop}</a>`).join('')
    }<a style="color:#dce9c7" href="/en/forest?returnTree=${TREE}">writing grove</a></aside>`);
    res.send(html);
  };
  next();
}, buildForestRouteHandler({ readBootstrap }));
app.get('/api/v1/forest/terrain-regions', (req, res, next) => {
  if (scenario === 'terrain-failed') return res.sendStatus(503);
  return next();
}, buildForestOwnerTerrainRegionRouteHandler({ readRegion: buildForestOwnerTerrainRegionService({
  WorldModel: { findOne: () => ({ lean: async () => terrainWorld() }), exists: async () => true },
  DeletionModel: { exists: () => ({ lean: async () => null }) }, readTerrain: readTerrainFixture
}) }));
app.get('/api/v1/forest/regions', async (req, res) => {
  if (scenario === 'delayed') await new Promise(resolve => setTimeout(resolve, 700));
  const cells = String(req.query.cells).split(',');
  requests.push(cells);
  const atTarget = cells.includes('-3:2');
  if (atTarget && scenario === 'failed-load') return res.sendStatus(503);
  return res.json(atTarget && scenario !== 'missing' ? manifest : { ...manifest, placements: [] });
});
app.get('/api/v1/forest/assets', (req, res) => res.json({ status: 'ready', assets: [{
  cacheKey: 'fixture-tree', dimensions: { width: 96, height: 96 },
  anchor: { x: 48, y: 80 }, bounds: { x: 0, y: 0, width: 96, height: 96 },
  layers: [{ id: 'fixture', runs: Array.from({ length: 75 }, (_, y) => ({
    x: y < 50 ? 10 : 43, y, width: y < 50 ? 76 : 10, color: y < 50 ? '#438449' : '#62432f'
  })) }]
}] }));
app.get('/api/v1/forest/authored-regions', (req, res) => res.json({ manifestVersion: 2, status: 'ready',
  objects: [marker, placeMarker, ...createdMarkers.values()].filter(object => object.state === 'active'
    && String(req.query.cells).split(',').includes(`${object.placementIndex.cellX}:${object.placementIndex.cellY}`))
    .map(object => ({ ...object, worldX: object.placement.worldX, worldY: object.placement.worldY,
      regionId: `${object.placementIndex.cellX}:${object.placementIndex.cellY}` })), page: { nextCursor: null } }));
const markerReads = buildForestAuthoredObjectReadService({ ForestAuthoredObjectModel,
  ForestOwnerWorldModel: { findOne: () => ({ lean: async () => ({ schemaVersion: 1,
    ownerUserId: OWNER, forestId: FOREST, worldRole: 'primary', status: 'active',
    worldSeed: 'abcdefghijklmnopqrstuvwxyzABCDEF', reconciliation: { state: 'idle' },
    placementPolicyVersion: 1, environmentPolicyVersion: 1, environmentSchemaVersion: 1, worldGenerationVersion: 1 }) }) },
  inspectTree: async () => {
    if (scenario === 'marker-failed') throw new Error('fixture inspection failure');
    if (scenario === 'marker-unavailable') throw new ForestOwnerTreeInspectionError('TREE_INSPECTION_NOT_FOUND', 'private');
    return inspection;
  }
});
app.get('/api/v1/forest/authored-objects/:objectId/inspection', buildForestAuthoredInspectionRouteHandler({ inspect: markerReads.inspect }));
// In-memory persistence for browser interaction only; real transaction/index evidence has its own guarded fixture.
app.put('/api/v1/forest/authored-objects/:objectId', (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = value => {
    if (['create-lost', 'create-removed'].includes(scenario) && value.outcome === 'created') {
      if (scenario === 'create-removed') {
        const object = createdMarkers.get(value.object.objectId);
        Object.assign(object, { state: 'removed', recordRevision: 2, changedAt: new Date(),
          removedAt: new Date(), purgeEligibleAt: new Date(Date.now() + 90 * 86400000) });
      }
      creationEnabled = false;
      res.destroy(); // Committed write, lost response, then an equal retry while creation is disabled.
      return res;
    }
    return originalJson(value);
  };
  next();
}, buildForestAuthoredMutationRouteHandler({ operation: 'create', enforceRateLimit: async () => {},
  mutate: async input => {
    mutationRequests.push(globalThis.structuredClone(input));
    const existing = createdMarkers.get(input.objectId);
    if (existing) return { protocolVersion: input.protocolVersion,
      outcome: existing.state === 'removed' ? 'existing-removed' : 'existing-active', object: existing };
    if (input.writingLink && !creationEnabled) throw new ForestAuthoredMutationError('AUTHORED_WRITING_LINKS_DISABLED', 'disabled');
    const object = { ...globalThis.structuredClone(marker), objectId: input.objectId,
      schemaVersion: input.writingLink ? 2 : 1, writingLink: input.writingLink || undefined,
      placement: { worldX: input.worldX, worldY: input.worldY },
      placementIndex: { version: 1, cellX: Math.floor(input.worldX / 720), cellY: Math.floor(input.worldY / 720) },
      creationFingerprint: { version: input.writingLink ? 2 : 1, digest: 'A'.repeat(43) }
    };
    if (!input.writingLink) delete object.writingLink;
    createdMarkers.set(object.objectId, object);
    return { protocolVersion: input.protocolVersion, outcome: 'created', object };
  }
}));

app.get('/api/v1/forest/trees/:tree/inspection', (req, res) => res.json(
  scenario === 'translations' ? {
    ...inspection,
    translations: req.query.cursor ? [
      ...inspection.translations,
      { title: 'Un recuerdo', path: '/rooms/general/blocks/507f1f77bcf86cd799439014', lang: 'es' }
    ] : inspection.translations,
    page: { nextCursor: req.query.cursor ? null : 'next-page' }
  } : inspection
));
app.get('/rooms/:room/blocks/:post', forestWritingReturn, (req, res) => {
  res.send(`<h1>Remembered writing</h1>${pug.renderFile('views/partials/_forest_writing_return.pug', res.locals)}`);
});
const server = app.listen(serveOnly ? Number(process.env.FOREST_TERRAIN_REVIEW_PORT || 4179) : 0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
if (serveOnly) {
  console.log(`Real-template terrain fixture (no account data): ${base}/en/forest?fixture=terrain-camera-inlet`);
  await new Promise(() => {});
}
const ws = new WebSocket(process.argv[2] || 'ws://127.0.0.1:9224/session');
let nextId = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timeout });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  clearTimeout(request.timeout);
  if (message.type === 'error') request.reject(new Error(message.message));
  else request.resolve(message.result);
};
let sessionStarted = false;
try {
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  await send('session.new', { capabilities: {} });
  sessionStarted = true;
  const { context } = await send('browsingContext.create', { type: 'tab' });
  const evaluate = async (expression, awaitPromise = false) => {
    const result = await send('script.evaluate', { target: { context }, expression, awaitPromise });
    assert.equal(result.type, 'success', JSON.stringify(result));
    return result.result.value;
  };
  const waitFor = async expression => evaluate(`new Promise((resolve, reject) => {
    const start = Date.now(); const check = () => {
      if (${expression}) resolve(true);
      else if (Date.now() - start > 8000) reject(new Error('UI condition timed out'));
      else setTimeout(check, 25);
    }; check();
  })`, true);
  const navigate = url => send('browsingContext.navigate', { context, url, wait: 'complete' });
  const capture = async name => {
    if (!process.env.FOREST_RETURN_SCREENSHOT_DIR) return;
    await evaluate(`document.documentElement.dataset.theme = 'dark'`);
    await evaluate(`document.querySelector('[data-owner-forest-viewport]').scrollIntoView({ block: 'center' })`);
    const screenshot = await send('browsingContext.captureScreenshot', { context });
    fs.mkdirSync(process.env.FOREST_RETURN_SCREENSHOT_DIR, { recursive: true });
    fs.writeFileSync(`${process.env.FOREST_RETURN_SCREENSHOT_DIR}/${name}.png`, Buffer.from(screenshot.data, 'base64'));
  };
  const assertToolbar = async () => {
    assert.equal(await evaluate(`(() => {
      const hud = document.querySelector('[data-owner-forest-dock]');
      const inspect = document.querySelector('[data-owner-forest-inspect]').getBoundingClientRect();
      const place = document.querySelector('[data-owner-forest-more]').getBoundingClientRect();
      const bounds = hud.getBoundingClientRect();
      const viewport = document.querySelector('[data-owner-forest-viewport]').getBoundingClientRect();
      return getComputedStyle(hud).display !== 'none' && inspect.height >= 44 && place.height >= 44
        && Math.abs(inspect.height - place.height) < 1
        && bounds.left >= viewport.left && bounds.right <= viewport.right;
    })()`), true, 'Nearby actions have matching touch targets and stay inside the viewport');
  };

  if (process.env.FOREST_TERRAIN_STYLE_REVIEW === 'true') {
    await send('browsingContext.setViewport', { context, viewport: { width: 1280, height: 820 }, devicePixelRatio: 1 });
    await navigate(`${base}/dev/terrain-style-review`);
    await waitFor(`document.body.dataset.ready === 'true'`);
    await capture('terrain-style-comparison');
    console.log('PASS experimental/live shared-painter style comparison rendered');
  }

  if (terrainGeneration === 4) {
    const preload = await send('script.addPreloadScript', { functionDeclaration: `() => {
      const nativeMatch = window.matchMedia.bind(window);
      window.matchMedia = query => {
        const result = nativeMatch(query);
        if (query === '(prefers-reduced-motion: reduce)') Object.defineProperty(result, 'matches', { value: true });
        return result;
      };
    }` });
    await navigate(`${base}/en/forest?fixture=terrain-camera-lake`);
    await waitFor(`document.querySelector('[data-owner-forest-status]').textContent.includes('discovered')`);
    const frozen = await evaluate(`document.querySelector('[data-owner-forest-canvas]').toDataURL()`);
    await new Promise(resolve => setTimeout(resolve, 900));
    assert.equal(await evaluate(`document.querySelector('[data-owner-forest-canvas]').toDataURL()`), frozen,
      'Reduced-motion owner scene freezes the lake surface');
    await send('script.removePreloadScript', { script: preload.script });
    console.log('PASS reduced-motion lake rendering remains static on the production scene');
  }

  for (const width of [1280, 390]) {
    await send('browsingContext.setViewport', { context, viewport: { width, height: 900 }, devicePixelRatio: 1 });
    await navigate(`${base}/en/forest?returnTree=${TREE}&fixture=terrain`);
    await waitFor(`document.querySelector('[data-owner-forest-status]').textContent.includes('discovered')`);
    assert.equal(await evaluate(`JSON.parse(document.getElementById('owner-forest-bootstrap').textContent).bootstrapVersion`), 4);
    const evidence = JSON.parse(await evaluate(`(async () => {
      const { createOwnerForestTerrainScene, ownerTerrainDistrictsAround } = await import('/js/owner-forest-terrain-scene.js');
      const bootstrap = JSON.parse(document.getElementById('owner-forest-bootstrap').textContent);
      const terrain = createOwnerForestTerrainScene({ descriptor: bootstrap.terrain });
      const origin = { worldX: -1500, worldY: 1500, radius: 11 };
      await terrain.ensure(origin);
      const url = new URL(bootstrap.terrain.regionPath, location.origin);
      url.searchParams.set('districts', ownerTerrainDistrictsAround(origin).map(d => d.cellX + ':' + d.cellY).join(',')); url.searchParams.set('token', bootstrap.terrain.token);
      const response = await fetch(url); const result = await response.json();
      const area = (result.features || result.districts).find(d => d.stream);
      const b = area.bridges ? area.bridges[1] : area.bridge; const pond = area.stream.outlet;
      await terrain.ensure({ worldX: pond.x, worldY: pond.y });
      const pondSurface = terrain.sample({ worldX: pond.x, worldY: pond.y });
      await terrain.ensure({ worldX: b.x, worldY: b.y });
      return JSON.stringify({ private: response.headers.get('cache-control').includes('no-store'),
        pondBlocked: pondSurface.surface === 'water' && !pondSurface.walkable,
        bridgeClear: terrain.sample({ worldX: b.x, worldY: b.y }).walkable,
        elevated: terrain.elevation({ worldX: b.x, worldY: b.y }) > 0 });
    })()`, true));
    assert.deepEqual(evidence, { private: true, pondBlocked: true, bridgeClear: true, elevated: true });
    await capture(`live-terrain-${width}`);
    console.log(`PASS live terrain route, private geometry, pond collision and elevated crossing at ${width}px`);
    if (terrainGeneration === 4) for (const stop of ['bend', 'bridge', 'inlet', 'lake']) {
      await navigate(`${base}/en/forest?fixture=terrain-camera-${stop}`);
      await waitFor(`document.querySelector('[data-owner-forest-status]').textContent.includes('discovered')`);
      await capture(`regional-${stop}-${width}`);
      if (stop === 'lake') {
        const first = await evaluate(`document.querySelector('[data-owner-forest-canvas]').toDataURL()`);
        await new Promise(resolve => setTimeout(resolve, 900));
        const later = await evaluate(`document.querySelector('[data-owner-forest-canvas]').toDataURL()`);
        assert.notEqual(first, later, 'Lake surface animates on the real owner scene');
      }
    }
  }

  for (const width of [1280, 390]) {
    await send('browsingContext.setViewport', { context, viewport: { width, height: 900 }, devicePixelRatio: 1 });
    await navigate(`${base}/en/forest?returnTree=${TREE}`);
    await waitFor(`!document.querySelector('[data-owner-forest-nearby]').hidden`);
    assert.ok(requests.some(cells => cells.includes('-3:2')), 'Loads the target neighborhood');
    assert.equal(await evaluate(`document.activeElement.matches('[data-owner-forest-viewport]')`), true,
      'Movement surface receives focus automatically on entry');
    await send('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions: [
      { type: 'keyDown', value: 'e' }, { type: 'keyUp', value: 'e' }
    ] }] });
    await waitFor(`!document.querySelector('[data-owner-forest-inspection-content]').hidden`);
    assert.equal(await evaluate(`document.querySelector('[data-owner-forest-translations-wrap]').hidden`), true,
      'The selected post is not repeated as its own translation');
    assert.equal(await evaluate(`document.activeElement.matches('[data-owner-forest-inspection-close]')`), true);
    if (process.env.FOREST_RETURN_SCREENSHOT_DIR) {
      await evaluate(`document.documentElement.dataset.theme = 'dark'`);
      await evaluate(`document.querySelector('[data-owner-forest-viewport]').scrollIntoView({ block: 'center' })`);
      const screenshot = await send('browsingContext.captureScreenshot', { context });
      fs.mkdirSync(process.env.FOREST_RETURN_SCREENSHOT_DIR, { recursive: true });
      fs.writeFileSync(`${process.env.FOREST_RETURN_SCREENSHOT_DIR}/forest-inspection-${width}.png`, Buffer.from(screenshot.data, 'base64'));
    }
    const link = await evaluate(`document.querySelector('[data-owner-forest-inspection-link]').getAttribute('href')`);
    assert.equal(link, `/en${POST}?from=forest&returnTree=${TREE}`);
    await navigate(base + link);
    const back = await evaluate(`document.querySelector('.block-forest-return a').getAttribute('href')`);
    assert.equal(back, `/en/forest?returnTree=${TREE}`);
    await navigate(base + back);
    await waitFor(`!document.querySelector('[data-owner-forest-nearby]').hidden`);
    assert.equal(await evaluate(`document.activeElement.matches('[data-owner-forest-viewport]')`), true,
      'Returning from writing focuses the movement surface');
    await evaluate(`document.querySelector('[data-owner-forest-reset]').click()`);
    // Reset must request entrance cells, even though a return destination remains in bootstrap.
    await waitFor(`document.querySelector('[data-owner-forest-nearby]').hidden
      && document.querySelector('[data-owner-forest-status]').textContent.includes('discovered')`);
    assert.ok(requests.some(cells => cells.includes('0:0')), 'Reset loads the ordinary entrance');
    console.log(`PASS ${width}px keyboard inspection, post link, tree return, entrance reset`);
  }
  for (const width of [1280, 390]) {
    await send('browsingContext.setViewport', { context, viewport: { width, height: 900 }, devicePixelRatio: 1 });
    await navigate(`${base}/en/forest?returnMarker=${MARKER}`);
    await waitFor(`!document.querySelector('[data-owner-forest-nearby]').hidden`);
    await assertToolbar();
    await capture(`marker-toolbar-${width}`);
    assert.equal(await evaluate(`document.activeElement.matches('[data-owner-forest-viewport]')`), true);
    await send('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions: [
      { type: 'keyDown', value: 'e' }, { type: 'keyUp', value: 'e' }
    ] }] });
    await waitFor(`!document.querySelector('[data-owner-forest-marker-writing]').hidden`);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.owner-forest__hud-actions')).display`), 'none');
    assert.equal(await evaluate(`document.getElementById('owner-forest-marker-title').textContent`), 'Remembered writing');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('[data-owner-forest-marker-writing-link]')).display`), 'inline-flex');
    await capture(`marker-writing-${width}`);

    assert.equal(await evaluate(`document.activeElement.matches('[data-owner-forest-marker-close]')`), true);
    const post = await evaluate(`document.querySelector('[data-owner-forest-marker-writing-link]').getAttribute('href')`);
    assert.equal(post, `/en${POST}?from=forest&returnMarker=${MARKER}`);
    await navigate(base + post);
    const back = await evaluate(`document.querySelector('.block-forest-return a').getAttribute('href')`);
    assert.equal(back, `/en/forest?returnMarker=${MARKER}`);
    await navigate(base + back);
    await waitFor(`!document.querySelector('[data-owner-forest-nearby]').hidden`);
    await evaluate(`document.querySelector('[data-owner-forest-inspect]').click()`);
    await waitFor(`!document.querySelector('[data-owner-forest-marker-writing]').hidden`);
    assert.ok(await evaluate(`document.querySelector('[data-owner-forest-marker-writing-title]').textContent === 'Remembered writing'`));
    await evaluate(`document.querySelector('[data-owner-forest-marker-close]').click()`);
    assert.equal(await evaluate(`document.activeElement.matches('[data-owner-forest-viewport]')`), true);
    console.log(`PASS ${width}px linked-marker inspection, writing link, marker return and focus`);
  }
  for (const width of [1280, 390]) {
    await send('browsingContext.setViewport', { context, viewport: { width, height: 900 }, devicePixelRatio: 1 });
    await navigate(`${base}/en/forest?returnMarker=${PLACE}`);
    await waitFor(`!document.querySelector('[data-owner-forest-nearby]').hidden`);
    await assertToolbar();
    await evaluate(`document.querySelector('[data-owner-forest-inspect]').click()`);
    await waitFor(`!document.querySelector('[data-owner-forest-marker-inspection]').hidden`);
    assert.equal(await evaluate(`document.getElementById('owner-forest-marker-title').textContent`), 'A place you marked');
    assert.equal(await evaluate(`document.querySelector('[data-owner-forest-marker-list]').hidden`), true);
    assert.equal(await evaluate(`document.querySelector('[data-owner-forest-marker-writing]').hidden`), true);
    assert.equal(await evaluate(`document.querySelector('[data-owner-forest-marker-description]').textContent`), 'A reminder of a place you want to find again.');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.owner-forest__hud-actions')).display`), 'none');
    await capture(`marker-place-${width}`);
    await evaluate(`document.querySelector('[data-owner-forest-marker-close]').click()`);
    await assertToolbar();
    assert.equal(await evaluate(`document.activeElement.matches('[data-owner-forest-viewport]')`), true);
    console.log(`PASS ${width}px place-marker presentation, matching nearby actions, hidden inspection toolbar and close focus`);
  }
  for (const width of [1280, 390]) {
    await send('browsingContext.setViewport', { context, viewport: { width, height: 900 }, devicePixelRatio: 1 });
    await navigate(`${base}/en/forest?returnTree=${TREE}&fixture=create-lost`);
    await waitFor(`!document.querySelector('[data-owner-forest-nearby]').hidden`);
    await evaluate(`document.querySelector('[data-owner-forest-inspect]').click()`);
    await waitFor(`!document.querySelector('[data-owner-forest-mark-writing]').disabled`);
    await evaluate(`document.querySelector('[data-owner-forest-mark-writing]').click()`);
    await waitFor(`!document.querySelector('[data-owner-forest-placement-save]').disabled`);
    assert.equal(await evaluate(`document.querySelector('[data-owner-forest-placement-writing-title]').textContent`), 'Remembered writing');
    assert.equal(await evaluate(`document.activeElement.matches('[data-owner-forest-viewport]')`), true);
    await evaluate(`document.querySelector('[data-owner-forest-placement-save]').click()`);
    await waitFor(`document.querySelector('[data-owner-forest-sync-status]').hidden`);
    assert.equal(mutationRequests.length, 2, 'Lost response retries once');
    assert.deepEqual(mutationRequests[0], mutationRequests[1], 'Retry retains exact id, link and placement');
    assert.equal(mutationRequests[0].protocolVersion, 2);
    assert.deepEqual(mutationRequests[0].writingLink, { version: 1, writingTreeId: TREE });
    assert.equal(createdMarkers.size, 1);
    assert.equal(creationEnabled, false, 'Committed retry recovers while creation is disabled');
    const id = mutationRequests[0].objectId;
    await navigate(`${base}/en/forest?returnMarker=${id}`);
    await waitFor(`!document.querySelector('[data-owner-forest-nearby]').hidden`);
    await evaluate(`document.querySelector('[data-owner-forest-inspect]').click()`);
    await waitFor(`!document.querySelector('[data-owner-forest-marker-writing]').hidden`);
    const link = await evaluate(`document.querySelector('[data-owner-forest-marker-writing-link]').getAttribute('href')`);
    assert.equal(link, `/en${POST}?from=forest&returnMarker=${id}`);
    await navigate(base + link);
    const back = await evaluate(`document.querySelector('.block-forest-return a').getAttribute('href')`);
    assert.equal(back, `/en/forest?returnMarker=${id}`);
    await navigate(base + back);
    await waitFor(`!document.querySelector('[data-owner-forest-nearby]').hidden`);
    assert.equal(await evaluate(`document.activeElement.matches('[data-owner-forest-viewport]')`), true);
    console.log(`PASS ${width}px selected-writing creation, lost-response retry with gate off, inspection and post return`);
  }
  await navigate(`${base}/en/forest?returnTree=${TREE}&fixture=create-removed`);
  await waitFor(`!document.querySelector('[data-owner-forest-nearby]').hidden`);
  await evaluate(`document.querySelector('[data-owner-forest-inspect]').click()`);
  await waitFor(`!document.querySelector('[data-owner-forest-mark-writing]').disabled`);
  await evaluate(`document.querySelector('[data-owner-forest-mark-writing]').click()`);
  await waitFor(`!document.querySelector('[data-owner-forest-placement-save]').disabled`);
  await evaluate(`document.querySelector('[data-owner-forest-placement-save]').click()`);
  await waitFor(`document.querySelector('[data-owner-forest-sync-status]').hidden`);
  assert.equal(mutationRequests.length, 2);
  assert.equal([...createdMarkers.values()].filter(object => object.state === 'active').length, 0);
  assert.equal(await evaluate(`document.querySelector('[data-owner-forest-authored-status-copy]').textContent`),
    await evaluate(`JSON.parse(document.getElementById('owner-forest-copy').textContent).markers.removedElsewhere`));
  console.log('PASS lost-response retry observes a concurrent removal without reviving the marker');
  await navigate(`${base}/en/forest?returnTree=${TREE}&fixture=create-range`);
  await waitFor(`!document.querySelector('[data-owner-forest-nearby]').hidden`);
  await evaluate(`document.querySelector('[data-owner-forest-inspect]').click()`);
  await waitFor(`!document.querySelector('[data-owner-forest-mark-writing]').disabled`);
  await evaluate(`document.querySelector('[data-owner-forest-mark-writing]').click()`);
  await send('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions: [
    { type: 'keyDown', value: '\uE015' }, { type: 'pause', duration: 1600 }, { type: 'keyUp', value: '\uE015' }
  ] }] });
  await waitFor(`document.querySelector('[data-owner-forest-placement-save]').disabled`);
  assert.ok((await evaluate(`document.querySelector('[data-owner-forest-placement-status]').textContent`)).includes('closer'));
  await evaluate(`document.querySelector('[data-owner-forest-placement-cancel]').click()`);
  await navigate(`${base}/en/forest`);
  await waitFor(`!document.querySelector('[data-owner-forest-place-marker]').disabled`);
  assert.equal(await evaluate(`document.querySelector('[data-owner-forest-mark-writing]').hidden`), true);
  await evaluate(`document.querySelector('[data-owner-forest-more]').click()`);
  assert.equal(await evaluate(`document.querySelector('[data-owner-forest-more-panel]').hidden`), false);
  await evaluate(`document.querySelector('[data-owner-forest-place-marker]').click()`);
  await waitFor(`!document.querySelector('[data-owner-forest-placement-save]').disabled`);
  await evaluate(`document.querySelector('[data-owner-forest-placement-save]').click()`);
  await waitFor(`document.querySelector('[data-owner-forest-sync-status]').hidden`);
  assert.equal(mutationRequests.at(-1).protocolVersion, 1);
  assert.equal(mutationRequests.at(-1).writingLink, undefined);
  console.log('PASS source-range preview and ordinary marker creation with linked creation disabled');
  await navigate(`${base}/en/forest?returnMarker=${MARKER}&fixture=marker-unavailable`);
  await waitFor(`!document.querySelector('[data-owner-forest-nearby]').hidden`);
  await evaluate(`document.querySelector('[data-owner-forest-inspect]').click()`);
  await waitFor(`document.querySelector('[data-owner-forest-marker-writing-status]').textContent.includes('cannot be opened')`);
  assert.equal(await evaluate(`document.querySelector('[data-owner-forest-marker-writing]').hidden`), true);
  assert.equal(await evaluate(`document.querySelector('[data-owner-forest-marker-move]').disabled`), false);
  console.log('PASS unavailable writing preserves the marker place and management controls');
  await navigate(`${base}/en/forest?returnMarker=${MARKER}&fixture=marker-failed`);
  await waitFor(`!document.querySelector('[data-owner-forest-nearby]').hidden`);
  await evaluate(`document.querySelector('[data-owner-forest-inspect]').click()`);
  await waitFor(`document.querySelector('[data-owner-forest-marker-writing-status]').textContent === JSON.parse(document.getElementById('owner-forest-copy').textContent).markers.inspectionUnavailable`);
  assert.equal(await evaluate(`document.querySelector('[data-owner-forest-marker-writing]').hidden`), true);
  assert.equal(await evaluate(`document.querySelector('[data-owner-forest-marker-move]').disabled`), false);
  console.log('PASS marker read failures show a retry message without claiming the tree source is absent');
  await navigate(`${base}/en/forest?returnTree=${TREE}&fixture=translations`);
  await waitFor(`!document.querySelector('[data-owner-forest-nearby]').hidden`);
  await evaluate(`document.querySelector('[data-owner-forest-inspect]').click()`);
  await waitFor(`!document.querySelector('[data-owner-forest-inspection-content]').hidden`);
  assert.equal(await evaluate(`document.querySelector('[data-owner-forest-translations-wrap]').hidden`), false);
  await evaluate(`document.querySelector('[data-owner-forest-translations-more]').click()`);
  await waitFor(`document.querySelectorAll('[data-owner-forest-translations] a').length === 1`);
  assert.ok((await evaluate(`document.querySelector('[data-owner-forest-translations]').textContent`)).includes('Un recuerdo'));
  await evaluate(`document.querySelector('[data-owner-forest-inspection-close]').click()`);
  assert.equal(await evaluate(`document.activeElement.matches('[data-owner-forest-viewport]')`), true);
  console.log('PASS translation pagination excludes the current post and closing restores game focus');
  await navigate(`${base}/en/forest?returnTree=${TREE}&fixture=delayed`);
  await evaluate(`document.querySelector('[data-owner-forest-reset]').focus()`);
  await waitFor(`!document.querySelector('[data-owner-forest-nearby]').hidden`);
  assert.equal(await evaluate(`document.activeElement.matches('[data-owner-forest-reset]')`), true);
  console.log('PASS delayed regional load does not steal focus from another control');
  for (const fixture of ['missing', 'failed-load']) {
    await navigate(`${base}/en/forest?returnTree=${TREE}&fixture=${fixture}`);
    await waitFor(`document.querySelector('[data-owner-forest-status]').textContent === '0 writing trees discovered nearby.'`);
    assert.ok(requests.some(cells => cells.includes('0:0')), `${fixture} falls back to entrance`);
    console.log(`PASS ${fixture} falls back to entrance`);
  }
} finally {
  if (sessionStarted) await send('session.end');
  ws.close();
  await new Promise(resolve => server.close(resolve));
}
