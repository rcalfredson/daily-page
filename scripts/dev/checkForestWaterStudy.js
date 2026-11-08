// Database-free Firefox check. Starts/stops its own local server and temporary browser profile.
/* global WebSocket */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-water-firefox-'));
const output = path.join(root, 'tmp/forest-water-study');
await fs.mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['scripts/dev/serveForestWaterStudy.js'], {
  cwd: root, env: { ...process.env, FOREST_WATER_STUDY_PORT: '4186' }, stdio: ['ignore', 'pipe', 'pipe']
});
const browser = spawn('firefox', ['--headless', '--no-remote', '--profile', profile,
  '--remote-debugging-port', '9236'], { stdio: ['ignore', 'pipe', 'pipe'] });
let diagnostics = '';
for (const child of [server, browser]) {
  child.stdout.on('data', data => { diagnostics += data; });
  child.stderr.on('data', data => { diagnostics += data; });
}
let ws, nextId = 0;
const pending = new Map(), errors = [];
async function connect() {
  for (let i = 0; i < 80; i++) {
    try {
      const socket = new WebSocket('ws://127.0.0.1:9236/session');
      await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
      return socket;
    } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  throw new Error(`Firefox did not start: ${diagnostics}`);
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 75000);
    pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
  });
}
try {
  ws = await connect();
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'log.entryAdded' && message.params.level === 'error') errors.push(message.params.text);
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timer); pending.delete(message.id);
    if (message.type === 'error') request.reject(new Error(message.message)); else request.resolve(message.result);
  };
  await send('session.new', { capabilities: {} });
  await send('session.subscribe', { events: ['log.entryAdded'] });
  const { context } = await send('browsingContext.create', { type: 'tab' });
  const evaluate = async expression => {
    const result = await send('script.evaluate', { target: { context }, expression, awaitPromise: true });
    assert.equal(result.type, 'success', JSON.stringify(result));
    return result.result.value;
  };
  const waitFor = expression => evaluate(`new Promise((resolve, reject) => {
    let count = 0; const timer = setInterval(() => {
      if (${expression}) { clearInterval(timer); resolve(true); }
      else if (++count > 700) { clearInterval(timer); reject(new Error('Study UI timeout')); }
    }, 100);
  })`);
  await send('browsingContext.navigate', { context, url: 'http://127.0.0.1:4186/', wait: 'complete' });
  await waitFor("document.querySelector('#status').textContent.includes('bank route')");
  for (const width of [1280, 390]) {
    await send('browsingContext.setViewport', { context, viewport: { width, height: 900 }, devicePixelRatio: 1 });
    for (const seed of ['alder', 'granite', 'snowmelt']) {
      await evaluate(`document.querySelector('#seed').value = '${seed}'; document.querySelector('#seed').dispatchEvent(new Event('change')); true`);
      for (const stop of ['confluence', 'bridge', 'inlet', 'lake']) {
        await evaluate(`document.querySelector('[data-stop="${stop}"]').click(); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
        const shot = await send('browsingContext.captureScreenshot', { context });
        await fs.writeFile(path.join(output, `${seed}-${stop}-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    console.log(`Captured three seeds at ${width}px with no horizontal overflow.`);
  }
  await send('browsingContext.activate', { context });
  await evaluate("document.querySelector('[data-stop=upstream]').click(); document.querySelector('canvas').focus(); true");
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  assert.equal(await evaluate("document.activeElement.tagName"), 'CANVAS');
  const beforeMove = await evaluate("document.querySelector('#status').textContent");
  await send('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions: [
    { type: 'keyDown', value: '\uE015' }, { type: 'pause', duration: 500 }, { type: 'keyUp', value: '\uE015' }
  ] }] });
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  assert.notEqual(await evaluate("document.querySelector('#status').textContent"), beforeMove);
  const distance = Number((await evaluate("document.querySelector('#status').textContent")).match(/walked (\d+) units/)[1]);
  assert.ok(distance > 35 && distance < 70, `Half-second keyboard travel should be near 54 units, got ${distance}`);
  await evaluate("document.querySelector('[data-stop=lake]').click(); document.querySelector('#motion').checked = false; true");
  await new Promise(resolve => setTimeout(resolve, 150));
  const movingLake = await evaluate("document.querySelector('canvas').toDataURL()");
  await new Promise(resolve => setTimeout(resolve, 900));
  assert.notEqual(await evaluate("document.querySelector('canvas').toDataURL()"), movingLake, 'Lake surface should move in normal motion');
  await evaluate("document.querySelector('#motion').checked = true; true");
  await new Promise(resolve => setTimeout(resolve, 150));
  const frozen = await evaluate("document.querySelector('canvas').toDataURL()");
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(await evaluate("document.querySelector('canvas').toDataURL()"), frozen, 'Freeze water must hold the canvas still');
  console.log(`Keyboard movement (${distance} units in 0.5s) and frozen water passed.`);
  await evaluate("document.querySelector('#seed').value='alder'; document.querySelector('#seed').dispatchEvent(new Event('change')); document.querySelector('#walk').click(); true");
  const tourStarted = performance.now();
  console.log('Walking the full bank route in real time at 108 units/second…');
  await waitFor("document.querySelector('#status').textContent.includes('Bank walk complete') || document.querySelector('#status').textContent.includes('defect')");
  const report = await evaluate("document.querySelector('#status').textContent");
  assert.ok(report.includes('Bank walk complete'), report);
  console.log(`${report.replace(/\s+/g, ' ')} · wall time ${((performance.now() - tourStarted) / 1000).toFixed(1)}s`);
  assert.deepEqual(errors, []);
  console.log(`Water study browser check passed. Screenshots: ${output}`);
} finally {
  if (ws?.readyState === WebSocket.OPEN) { try { await send('session.end'); } catch { /* process cleanup below */ } ws.close(); }
  browser.kill('SIGTERM'); server.kill('SIGTERM');
  for (const request of pending.values()) clearTimeout(request.timer);
  await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
}
