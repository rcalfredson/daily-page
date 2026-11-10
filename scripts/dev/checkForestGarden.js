// Browser QA against forestGardenFixture.js serve --write and Firefox BiDi on port 9225.
/* global WebSocket */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.FOREST_GARDEN_QA === 'true' ? 'http://127.0.0.1:4182' : 'http://127.0.0.1:4181';
const ws = new WebSocket('ws://127.0.0.1:9225/session');
let nextId = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 20000);
    pending.set(id, { resolve, reject, timeout }); ws.send(JSON.stringify({ id, method, params }));
  });
}
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data), request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id); clearTimeout(request.timeout);
  if (message.type === 'error') request.reject(new Error(message.message));
  else request.resolve(message.result);
};
let started = false;
try {
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  await send('session.new', { capabilities: {} }); started = true;
  const { context } = await send('browsingContext.create', { type: 'tab' });
  const evaluate = async (expression, awaitPromise = false) => {
    const result = await send('script.evaluate', { target: { context }, expression, awaitPromise });
    assert.equal(result.type, 'success', JSON.stringify(result)); return result.result.value;
  };
  const wait = condition => evaluate(`new Promise((resolve,reject) => {
    const start = Date.now(); const check = () => { if (${condition}) resolve(true);
      else if (Date.now()-start>12000) reject(new Error('UI wait failed: '+${JSON.stringify(condition)}));
      else setTimeout(check,50); }; check(); })`, true);
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const go = () => send('browsingContext.navigate', { context, url: `${base}/en/forest`, wait: 'complete' });
  const capture = async name => {
    await evaluate(`document.documentElement.dataset.theme='dark'`);
    await send('input.performActions', { context, actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' },
      actions: [{ type: 'pointerMove', x: 350, y: 350 }] }] });
    const result = await send('browsingContext.captureScreenshot', { context });
    fs.mkdirSync('/tmp/forest-garden-review', { recursive: true });
    fs.writeFileSync(`/tmp/forest-garden-review/${name}.png`, Buffer.from(result.data, 'base64'));
  };
  await send('browsingContext.setViewport', { context, viewport: { width: 1280, height: 900 } });
  await go();
  if (await evaluate(`Boolean(document.querySelector('[data-garden-establish]'))`)) {
    await click('[data-garden-establish]');
    await wait(`Boolean(document.querySelector('[data-forest-garden]'))`);
  }
  await wait(`!document.querySelector('[data-garden-acquire]').disabled`);
  assert.equal(await evaluate(`document.querySelector('[data-garden-count]').textContent.includes('0 / 8')`), true);
  await evaluate(`document.querySelector('[data-owner-forest-viewport]').scrollIntoView({block:'center'});document.querySelector('[data-owner-forest-viewport]').focus({preventScroll:true})`);
  await capture('desktop-wild-proximity');
  const walk = async key => send('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions: [
    { type: 'keyDown', value: key }, { type: 'pause', duration: 700 }, { type: 'keyUp', value: key }
  ] }] });
  await walk('a');
  await wait(`document.querySelector('[data-garden-near]').hidden`);
  await walk('d');
  await wait(`!document.querySelector('[data-garden-near]').hidden`);
  await send('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions: [
    { type: 'keyDown', value: 'e' }, { type: 'keyUp', value: 'e' }
  ] }] });
  await wait(`!document.querySelector('[data-garden-start]').disabled`);
  await wait(`document.querySelector('[data-garden-notice]').textContent.includes('Cutting collected')`);
  await capture('desktop-collected-cutting');
  await click('[data-garden-open]');
  assert.equal(await evaluate(`document.querySelector('[data-forest-garden]').getBoundingClientRect().bottom <= document.querySelector('[data-owner-forest-viewport]').getBoundingClientRect().bottom`), true);
  await capture('desktop-first-cutting');
  await click('[data-garden-close]');
  await evaluate(`document.querySelector('[data-owner-forest-viewport]').focus({preventScroll:true})`);
  await send('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions: [
    { type: 'keyDown', value: 'p' }, { type: 'keyUp', value: 'p' }
  ] }] });
  await wait(`!document.querySelector('[data-garden-toolbar]').hidden`);
  await capture('desktop-mature-preview');
  assert.equal(await evaluate(`document.querySelector('[data-garden-save]').disabled`), false);
  await click('[data-garden-save]');
  await wait(`document.querySelector('[data-garden-count]').textContent.includes('1 / 24')`);
  await capture('desktop-rooted');
  await evaluate(`advance('sprout')`, true);
  await wait(`document.querySelector('[data-garden-plants]').textContent.includes('sprout')`);
  await capture('desktop-sprout');
  await evaluate(`advance('bloom')`, true);
  await wait(`!document.querySelector('[data-garden-harvest]').disabled`);
  await capture('desktop-flowering');
  await click('[data-garden-harvest]');
  await wait(`document.querySelector('[data-garden-count]').textContent.includes('1 / 8')`);
  // Preserve the parent and arrange a second shrub east of the first.
  await click('[data-garden-plant]');
  await send('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions: [
    { type: 'keyDown', value: '\uE014' }, { type: 'pause', duration: 420 }, { type: 'keyUp', value: '\uE014' }
  ] }] });
  await wait(`!document.querySelector('[data-garden-save]').disabled`);
  await click('[data-garden-save]');
  await wait(`document.querySelector('[data-garden-count]').textContent.includes('2 / 24')`);
  const before = await evaluate(`fetch('/api/v1/forest/garden').then(r=>r.json()).then(r=>JSON.stringify(r.plants.map(p=>[p.plantId,p.worldX,p.worldY,p.plantedAt])))`, true);
  await go();
  await wait(`document.querySelector('[data-garden-count]').textContent.includes('2 / 24')`);
  const after = await evaluate(`fetch('/api/v1/forest/garden').then(r=>r.json()).then(r=>JSON.stringify(r.plants.map(p=>[p.plantId,p.worldX,p.worldY,p.plantedAt])))`, true);
  assert.equal(after, before);
  await click('[data-garden-open]');
  await evaluate(`document.querySelector('[data-owner-forest-viewport]').scrollIntoView({block:'center'})`);
  await capture('desktop-pair');
  await click('[data-garden-close]');
  await send('browsingContext.setViewport', { context, viewport: { width: 390, height: 844 } });
  await evaluate(`document.querySelector('[data-owner-forest-viewport]').scrollIntoView({block:'center'})`);
  await new Promise(resolve => setTimeout(resolve, 350));
  await capture('narrow-pair');
  await click('[data-garden-move]');
  await capture('narrow-move-preview');
  await click('[data-garden-cancel]');
  await click('[data-garden-open]');
  await capture('narrow-satchel');
  await click('[data-garden-close]');
  await click('[data-garden-move]');
  await click('[data-garden-cancel]');
  await click('[data-garden-lift]');
  await wait(`!document.querySelector('[data-garden-confirm]').hidden`);
  assert.equal(await evaluate(`document.querySelector('[data-garden-confirm]').getBoundingClientRect().bottom <= document.querySelector('[data-owner-forest-viewport]').getBoundingClientRect().bottom`), true);
  await capture('narrow-lift-confirm');
  await click('[data-garden-keep]');
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`), true);
  await evaluate(`advance('harvest')`, true);
  await wait(`!document.querySelector('[data-garden-harvest]').disabled`);
  await evaluate(`window.nativeGardenFetch=window.fetch; window.fetch=async (...args)=> {
    const result=await window.nativeGardenFetch(...args);
    if(args[0]==='/api/v1/forest/garden' && args[1]?.method==='POST') throw new Error('lost response');
    return result;
  }`);
  const tapPoint = JSON.parse(await evaluate(`(async () => {
    const data=await fetch('/api/v1/forest/garden').then(r=>r.json());
    const p=data.plants.find(p=>p.plantId===document.querySelector('[data-garden-near]').dataset.plantId);
    const r=document.querySelector('[data-owner-forest-viewport]').getBoundingClientRect();
    const spawn=JSON.parse(document.getElementById('owner-forest-bootstrap').textContent).spawn;
    return JSON.stringify({x:Math.round(r.left+r.width/2+p.worldX-spawn.worldX),
      y:Math.round(r.top+r.height/2+p.worldY-spawn.worldY-10)});
  })()`, true));
  await send('input.performActions', { context, actions: [{ type:'pointer', id:'mouse',
    parameters:{pointerType:'mouse'}, actions:[{type:'pointerMove',x:tapPoint.x,y:tapPoint.y},
      {type:'pointerDown',button:0},{type:'pointerUp',button:0}] }] });
  await wait(`document.querySelector('[data-garden-status]').textContent.includes('could not be confirmed')`);
  assert.equal(await evaluate(`document.querySelector('[data-garden-start]').disabled`), true);
  await evaluate(`window.fetch=window.nativeGardenFetch`);
  await click('[data-garden-open]');
  await click('[data-garden-refresh]');
  await wait(`document.querySelector('[data-garden-count]').textContent.includes('1 / 8')`);
  // A separate browsing context reads the same account-backed plant identities.
  const second = await send('browsingContext.create', { type: 'tab' });
  await send('browsingContext.navigate', { context: second.context, url: `${base}/en/forest`, wait: 'complete' });
  const separate = await send('script.evaluate', { target: { context: second.context }, awaitPromise: true,
    expression: `fetch('/api/v1/forest/garden').then(r=>r.json()).then(r=>JSON.stringify(r.plants.map(p=>[p.plantId,p.worldX,p.worldY,p.plantedAt])))` });
  assert.equal(separate.result.value, before);
  const preload = await send('script.addPreloadScript', { functionDeclaration: `() => {
    const native=window.matchMedia.bind(window); window.matchMedia=query=>{
      const result=native(query); if(query==='(prefers-reduced-motion: reduce)')
        Object.defineProperty(result,'matches',{value:true}); return result; };
  }` });
  await go(); await wait(`document.querySelector('[data-garden-count]').textContent.includes('2 / 24')`);
  await evaluate(`document.querySelector('[data-owner-forest-viewport]').scrollIntoView({block:'center'})`);
  const frozen = await evaluate(`document.querySelector('canvas').toDataURL()`);
  await new Promise(resolve => setTimeout(resolve, 700));
  assert.equal(await evaluate(`document.querySelector('canvas').toDataURL()`), frozen);
  await capture('narrow-reduced-motion');
  await send('script.removePreloadScript', { script: preload.script });
  // Emulated touch drag uses the production pointer movement handler.
  const beforeDrag = await evaluate(`fetch('/api/v1/forest/garden').then(r=>r.json()).then(r=>r.revision)`, true);
  await send('input.performActions', { context, actions: [{ type: 'pointer', id: 'finger',
    parameters: { pointerType: 'touch' }, actions: [
      { type: 'pointerMove', x: 120, y: 350 }, { type: 'pointerDown', button: 0 },
      { type: 'pointerMove', x: 170, y: 350, duration: 100 }, { type: 'pause', duration: 250 },
      { type: 'pointerUp', button: 0 }
    ] }] });
  assert.equal(await evaluate(`fetch('/api/v1/forest/garden').then(r=>r.json()).then(r=>r.revision)`, true), beforeDrag, 'Walking must not gather a cutting');
  console.log('PASS real-template desktop/narrow: first cutting, mature preview, rooted/sprout/flowering, harvest/replant pair, reload and separate context persistence, move cancellation, lift confirmation, lost-response recovery, reduced motion, emulated touch drag, no horizontal overflow. Screenshots: /tmp/forest-garden-review');
} finally {
  if (started) await send('session.end').catch(() => {});
  ws.close();
}
