// Isolated owner-template study. No database connection, credentials or persistent mutations.
import express from 'express';
import pug from 'pug';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { createHomeStudyFixture, planHomeCartSite, STUDY_SEEDS } from '../lib/forestHomeCartStudy.js';
import { queryOwnerTerrain } from '../../public/js/owner-forest-terrain-authority.js';
import { ownerForestCellsAround } from '../../public/js/owner-forest-scene.js';
import { buildForestOwnerSceneBootstrapService } from '../../server/services/forestOwnerSceneBootstrap.js';
import { buildForestOwnerTerrainRegionService } from '../../server/services/forestOwnerTerrainRegion.js';
import { buildForestOwnerTerrainRegionRouteHandler } from '../../server/api/v1/forest.js';
import { buildForestRouteHandler } from '../../server/routes/forest.js';
import { generateForestTreeAssetV3 } from '../../server/services/forestTreeGeneratorV3.js';
import { encodeForestSceneAssets } from '../../server/services/forestSceneAssetTransport.js';
import { initI18n } from '../../server/services/i18n.js';
import { uiPrefixAndLangContext } from '../../server/middleware/uiPrefix.js';

const OWNER = '64b00000000000000000a093';
const FOREST = 'a9300000-0000-4000-8000-000000000001';
const ACTIVATION = 'a9300000-0000-4000-8000-000000000002';

export function createHomeCartStudyApp(options = {}) {
  if (process.env.NODE_ENV === 'production') throw new Error('Home/cart study is development-only.');
  const fixture = createHomeStudyFixture(options);
  const plan = planHomeCartSite(fixture);
  const world = { schemaVersion: 1, ownerUserId: OWNER, forestId: FOREST, worldRole: 'primary',
    status: 'active', worldSeed: fixture.seed, placementPolicyVersion: 1, environmentPolicyVersion: 1,
    environmentSchemaVersion: 1, worldGenerationVersion: 1, reconciliation: { state: 'idle' },
    ...(fixture.generation ? { terrain: { schemaVersion: 1, generationVersion: fixture.generation,
      activationId: ACTIVATION, revision: 1, state: 'active', phase: 'ready', cursor: null } } : {}) };
  const WorldModel = { findOne: () => ({ lean: async () => world }), exists: async () => true };
  const readBootstrap = buildForestOwnerSceneBootstrapService({ ForestOwnerWorldModel: WorldModel,
    linkedCreationEnabled: () => false, resolveReturnDestination: async () => null,
    resolveMarkerReturnDestination: async () => null });
  const assets = [0, 1, 2].map(i => generateForestTreeAssetV3({ id: `home-study-tree-${i}` }, { seed: 130 + i }));
  const trees = fixture.obstacles.filter(o => o.kind === 'tree').map((o, i) => ({ id: o.id,
    worldX: o.x, worldY: o.y, collisionRadius: o.collisionRadius, scale: 1, assetKey: assets[i % assets.length].cacheKey }));
  const app = express();
  const delivery = {};
  app.locals.studyDelivery = delivery;
  app.set('views', `${process.cwd()}/views`); app.set('view engine', 'pug');
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).json({ code: 'STUDY_HAS_NO_SAVED_MUTATIONS' });
    if (req.path.startsWith('/api/v1/forest/')) {
      const json = res.json.bind(res);
      res.json = body => {
        const row = delivery[req.path] ||= { requests: 0, maximumBytes: 0, maximumCells: 0 };
        row.requests++; row.maximumBytes = Math.max(row.maximumBytes, Buffer.byteLength(JSON.stringify(body)));
        row.maximumCells = Math.max(row.maximumCells, String(req.query.cells || req.query.districts || '').split(',').filter(Boolean).length);
        return json(body);
      };
    }
    next();
  });
  app.use(express.static('public'));
  app.get('/__study/entry.js', (req, res) => res.sendFile(`${process.cwd()}/scripts/dev/forestHomeCartEntry.js`));
  app.get('/__study/paint.js', (req, res) => res.sendFile(`${process.cwd()}/scripts/dev/forestHomeCartPaint.js`));
  app.get('/__study/editor.js', (req, res) => res.sendFile(`${process.cwd()}/scripts/dev/forestHomeCartEditor.js`));
  app.get('/__study/render-check.js', (req, res) => res.sendFile(`${process.cwd()}/scripts/dev/forestHomeCartRenderCheck.js`));
  app.get('/__study/style.css', (req, res) => res.sendFile(`${process.cwd()}/scripts/dev/forestHomeCartStudy.css`));
  app.get('/__study/report', (req, res) => res.json({ generation: fixture.generation, occupancy: fixture.occupancy, plan, delivery }));
  app.use(uiPrefixAndLangContext); app.use(initI18n(['layout', 'nav', 'forestScene', 'blockView']));
  app.use((req, res, next) => { req.user = { id: OWNER, username: 'home_cart_study' }; next(); });
  app.get('/forest', (req, res, next) => {
    res.render = (view, model) => {
      if (plan.status !== 'ready') return res.status(409).send(`<h1>No connected site in this study</h1><p>${plan.reason}</p><p>The existing world was not changed.</p><a href="/__study/report">Study report</a>`);
      const spawn = { ...model.bootstrap.spawn, worldX: plan.spawn.x, worldY: plan.spawn.y };
      model.bootstrap.spawn = spawn;
      model.bootstrap.delivery.initialCells = ownerForestCellsAround(spawn, 720);
      const data = { plan, generation: fixture.generation, extent: 3600 };
      let html = pug.renderFile(`views/${view}.pug`, { ...res.locals, ...model })
        .replace(/<script>[\s\S]*?<\/script>/g, '')
        .replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g,
          (tag, src) => src === '/js/owner-forest.js' ? '<script type="module" src="/__study/entry.js"></script>' : '')
        .replace(/<link\b[^>]*href="https?:[^>]*>/g, '');
      html = html.replace('</head>', '<link rel="stylesheet" href="/__study/style.css"></head>')
        .replace('</body>', `<script type="application/json" id="home-cart-study">${JSON.stringify(data).replace(/</g, '\\u003c')}</script></body>`);
      res.send(html);
    };
    next();
  }, buildForestRouteHandler({ readBootstrap }));
  const readTerrain = async ({ bounds }) => queryOwnerTerrain({ seed: fixture.seed, generationVersion: fixture.generation,
    records: fixture.protections, bounds });
  app.get('/api/v1/forest/terrain-regions', buildForestOwnerTerrainRegionRouteHandler({
    readRegion: buildForestOwnerTerrainRegionService({ WorldModel,
      DeletionModel: { exists: () => ({ lean: async () => null }) }, readTerrain }) }));
  const selectedCells = req => {
    const cells = String(req.query.cells || '').split(',');
    if (cells.length > 9 || cells.some(c => !/^-?\d+:-?\d+$/.test(c))) throw new Error('Invalid fixture cells');
    return new Set(cells);
  };
  app.get('/api/v1/forest/regions', (req, res) => {
    const cells = selectedCells(req);
    res.json({ status: 'ready', placements: trees.filter(t => cells.has(`${Math.floor(t.worldX / 720)}:${Math.floor(t.worldY / 720)}`)),
      page: { nextCursor: null } });
  });
  app.get('/api/v1/forest/assets', async (req, res) => {
    const encoded = await encodeForestSceneAssets(assets.filter(a => String(req.query.assetKeys).split(',').includes(a.cacheKey)), 'lossless-raster');
    res.json({ status: 'ready', assets: encoded.assets });
  });
  app.get('/api/v1/forest/authored-regions', (req, res) => {
    const cells = selectedCells(req);
    res.json({ manifestVersion: 2, status: 'ready', objects: fixture.obstacles.filter(o => o.kind === 'marker'
      && cells.has(`${Math.floor(o.x / 720)}:${Math.floor(o.y / 720)}`)).map(o => ({
      objectId: o.id, kind: 'personal-marker', schemaVersion: 1, recordRevision: 1, state: 'active',
      worldX: o.x, worldY: o.y, regionId: `${Math.floor(o.x / 720)}:${Math.floor(o.y / 720)}`
    })), page: { nextCursor: null } });
  });
  app.get('/api/v1/forest/garden', (req, res) => res.json({ version: 1, revision: 1,
    acquired: true, cuttings: 0, plants: fixture.obstacles.filter(o => o.kind === 'plant' && o.id !== 'study-plant-fixed')
      .map(o => ({ plantId: o.id, worldX: o.x, worldY: o.y, stage: 'flowering', ready: false })) }));
  app.get('/api/v1/forest/trees/:id', (req, res) => res.json({ status: 'ready',
    tree: { id: req.params.id, recordRevision: 1, phenotypeId: 'open-crown-deciduous', creationSeason: 'spring' },
    writing: { title: 'A remembered walk — study writing', path: '/study-writing', lang: 'en', createdAt: '2026-04-10T10:00:00Z' },
    translations: [], page: { nextCursor: null } }));
  app.get('/study-writing', (req, res) => res.send('<h1>A remembered walk</h1><p>Fixture writing; no account data.</p><a href="/en/forest">Return to forest study</a>'));
  app.get('/forest/writing', (req, res) => res.send('<p>Isolated study; real writing is unchanged.</p><a href="/en/forest">Return to forest study</a>'));
  return { app, fixture, plan };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const action = process.argv[2] || 'serve';
  if (action === 'report') {
    for (const generation of [0, 3, 4]) for (const seed of STUDY_SEEDS) {
      for (const occupancy of ['empty', 'mixed', 'dense', 'blocked']) {
        const r = planHomeCartSite(createHomeStudyFixture({ generation, seed, occupancy }));
        console.log(JSON.stringify({ generation, seed, occupancy, ...r }));
      }
    }
  } else if (action === 'serve') {
    const { app, plan } = createHomeCartStudyApp({ generation: Number(process.env.FOREST_CART_GENERATION ?? 4),
      seed: STUDY_SEEDS[Number(process.env.FOREST_CART_SEED ?? 0)], occupancy: process.env.FOREST_CART_OCCUPANCY || 'mixed' });
    const port = Number(process.env.FOREST_CART_PORT || 4183);
    const server = app.listen(port, '127.0.0.1');
    await once(server, 'listening');
    console.log(`Home/cart study: http://127.0.0.1:${server.address().port}/en/forest`);
    console.log(JSON.stringify(plan));
  } else throw new Error('Use forestHomeCartFixture.js serve|report');
}
