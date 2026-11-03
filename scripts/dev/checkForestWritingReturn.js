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
const POST = '/rooms/general/blocks/507f1f77bcf86cd799439013';
const target = { id: TREE, worldX: -1500, worldY: 1500, collisionRadius: 20, scale: 1, assetKey: 'fixture-tree' };
const manifest = { status: 'ready', placements: [target], page: { nextCursor: null } };
const inspection = {
  status: 'ready', tree: { id: TREE, recordRevision: 1, phenotypeId: 'open-crown-deciduous', creationSeason: 'spring' },
  writing: { title: 'Remembered writing', path: POST, lang: 'en', createdAt: '2026-04-10T10:00:00Z' },
  translations: [{ title: 'Remembered writing', path: POST, lang: 'en' }], page: { nextCursor: null }
};
const resolveReturnDestination = buildForestOwnerReturnDestinationService({
  ForestWritingTreeModel: { findOne: () => ({ lean: async () => ({ placement: target }) }) },
  inspectTree: async () => inspection,
  readManifest: async () => manifest
});
const readBootstrap = buildForestOwnerSceneBootstrapService({
  ForestOwnerWorldModel: { findOne: () => ({ lean: async () => ({
    schemaVersion: 1, forestId: FOREST, ownerUserId: OWNER, worldRole: 'primary', status: 'active',
    worldSeed: 'abcdefghijklmnopqrstuvwxyzABCDEF', placementPolicyVersion: 1,
    environmentPolicyVersion: 1, environmentSchemaVersion: 1, worldGenerationVersion: 1,
    reconciliation: { state: 'idle' }
  }) }) }, resolveReturnDestination
});
const app = express();
app.set('views', `${process.cwd()}/views`);
app.set('view engine', 'pug');
app.use(express.static('public'));
app.use(uiPrefixAndLangContext);
app.use(initI18n(['layout', 'nav', 'forestScene', 'blockView']));
app.use((req, res, next) => { req.user = { id: OWNER, username: 'fixture' }; next(); });
let scenario = 'normal';
let requests = [];
app.get('/forest', (req, res, next) => {
  scenario = req.query.fixture || 'normal';
  requests = [];
  // Use the full production template, but keep unrelated scripts and remote assets out of QA.
  res.render = (view, model) => {
    const html = pug.renderFile(`${process.cwd()}/views/${view}.pug`, { ...res.locals, ...model })
      .replace(/<script>[\s\S]*?<\/script>/g, '')
      .replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g, (tag, src) => src === '/js/owner-forest.js' ? tag : '')
      .replace(/<link\b[^>]*href="https?:[^>]*>/g, '');
    res.send(html);
  };
  next();
}, buildForestRouteHandler({ readBootstrap }));
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
app.get('/api/v1/forest/authored-regions', (req, res) => res.json({ status: 'ready', objects: [], page: { nextCursor: null } }));
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
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
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
    await waitFor(`document.querySelector('[data-owner-forest-nearby]').hidden`);
    assert.ok(requests.some(cells => cells.includes('0:0')), 'Reset loads the ordinary entrance');
    console.log(`PASS ${width}px keyboard inspection, post link, tree return, entrance reset`);
  }
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
