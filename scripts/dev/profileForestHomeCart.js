// Repeatable callback-work profile; timings include JS/canvas submission, not GPU or total process CPU.
/* global WebSocket */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { once } from 'node:events';
import { createHomeCartStudyApp } from './forestHomeCartFixture.js';
import { STUDY_SEEDS } from '../lib/forestHomeCartStudy.js';

const { app, plan } = createHomeCartStudyApp({ generation: Number(process.env.FOREST_CART_GENERATION ?? 4),
  seed: STUDY_SEEDS[Number(process.env.FOREST_CART_SEED ?? 0)], occupancy: process.env.FOREST_CART_OCCUPANCY || 'mixed' });
assert.equal(plan.status, 'ready');
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const ws = new WebSocket(process.argv[2] || 'ws://127.0.0.1:9226/session');
const pending = new Map(); let nextId = 0;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId, timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 45000);
    pending.set(id, { resolve, reject, timeout }); ws.send(JSON.stringify({ id, method, params }));
  });
}
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data), p = pending.get(message.id);
  if (!p) return;
  pending.delete(message.id); clearTimeout(p.timeout);
  if (message.type === 'error') p.reject(new Error(message.message)); else p.resolve(message.result);
};
let started = false;
try {
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  await send('session.new', { capabilities: {} }); started = true;
  await send('script.addPreloadScript', { functionDeclaration: `() => {
    window.sceneWork = {}; window.scenePaints = 0;
    const smoothing = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'imageSmoothingEnabled');
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'imageSmoothingEnabled', { ...smoothing,
      set(value) { if (this.canvas.matches?.('[data-owner-forest-canvas]')) window.scenePaints++; smoothing.set.call(this, value); }
    });
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => original(time => {
      const start = performance.now(); try { callback(time); } finally {
        const name = callback.name || 'anonymous', row = window.sceneWork[name] ||= { count: 0, ms: 0 };
        row.count++; row.ms += performance.now() - start;
      }
    });
  }` });
  const { context } = await send('browsingContext.create', { type: 'tab' });
  const evaluate = async expression => {
    const result = await send('script.evaluate', { target: { context }, expression, awaitPromise: true });
    assert.equal(result.type, 'success', JSON.stringify(result)); return result.result.value;
  };
  await send('browsingContext.setViewport', { context, viewport: { width: 1280, height: 880 }, devicePixelRatio: 1 });
  const start = performance.now();
  await send('browsingContext.navigate', { context, url: `${base}/en/forest`, wait: 'complete' });
  await evaluate(`new Promise(resolve => { const timer = setInterval(() => {
    if(window.homeCartStudy?.snapshot().regionReady){clearInterval(timer);resolve(true);}
  },40);})`);
  console.log('Load', JSON.stringify({ wallMs: Math.round(performance.now()-start), callbackWork: JSON.parse(await evaluate('JSON.stringify(sceneWork)')) }));
  const measure = async (label, action = '') => {
    const result = await evaluate(`(async()=>{window.sceneWork={};window.scenePaints=0;${action}
      await new Promise(resolve=>setTimeout(resolve,4000));
      document.querySelector('[data-owner-forest-viewport]').dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowRight',bubbles:true}));
      return JSON.stringify({callbacks:sceneWork, paints:scenePaints});})()`);
    console.log(label, result); return JSON.parse(result);
  };
  await measure('Idle');
  await evaluate(`document.querySelector('[data-study-mount]').click();true`);
  await measure('Driving', `const v=document.querySelector('[data-owner-forest-viewport]');v.focus();v.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));`);
  const other = await send('browsingContext.create', { type: 'tab' });
  await send('browsingContext.activate', { context: other.context });
  assert.equal(await evaluate('document.hidden'), true);
  const hidden = await measure('Hidden'); assert.equal(hidden.paints, 0);
  await send('browsingContext.close', { context: other.context });
  await send('browsingContext.activate', { context });
  const resumed = await measure('Resumed'); assert.ok(resumed.paints > 0);

} finally {
  if (started) await send('session.end'); ws.close(); await new Promise(resolve => server.close(resolve));
}
