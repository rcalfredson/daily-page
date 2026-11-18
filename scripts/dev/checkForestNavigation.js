// Read-only main-preview navigation review plus an isolated fixture with mutable target responses.
/* global WebSocket */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { once } from 'node:events';
import { createHomeCartStudyApp } from './forestHomeCartFixture.js';
const { app } = createHomeCartStudyApp({ generation: 4, occupancy: 'mixed' });
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
const fixture = `http://127.0.0.1:${server.address().port}`;
const ws = new WebSocket(process.argv[2] || 'ws://127.0.0.1:9241/session');
const calls = new Map(); let next = 0, started = false;
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++next, timer = setTimeout(() => reject(new Error(method)), 45000);
  calls.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
});
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data), call = calls.get(message.id); if (!call) return;
  calls.delete(message.id); clearTimeout(call.timer);
  if (message.type === 'error') call.reject(new Error(message.message)); else call.resolve(message.result);
};
try {
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  await send('session.new', { capabilities: {} }); started = true;
  const { context } = await send('browsingContext.create', { type: 'tab' });
  const evaluate = async expression => {
    const result = await send('script.evaluate', { target: { context }, expression, awaitPromise: true });
    assert.equal(result.type, 'success', JSON.stringify(result)); return result.result.value;
  };
  const wait = condition => evaluate(`new Promise((resolve,reject)=>{const start=Date.now(),timer=setInterval(()=>{
    if(${condition}){clearInterval(timer);resolve(true);}else if(Date.now()-start>18000){clearInterval(timer);reject(new Error(${JSON.stringify(condition)}));}},40);})`);
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click();true`);
  const navigate = base => send('browsingContext.navigate', { context, url: `${base}/en/forest`, wait: 'complete' });
  const choose = async id => {
    await evaluate(`(()=>{if(document.querySelector('[data-owner-forest-more-panel]').hidden)document.querySelector('[data-owner-forest-more]').click();document.querySelector('.forest-navigation-picker').open=true;
      const select=document.querySelector('[data-forest-navigation-destination]');select.value=${JSON.stringify(id)};select.dispatchEvent(new Event('change'));return true;})()`);
    await click('[data-forest-navigation-go]');
  };
  await send('browsingContext.setViewport', { context, viewport: { width: 1280, height: 880 }, devicePixelRatio: 1 });
  await navigate('http://127.0.0.1:4185');
  await wait(`document.querySelector('[data-forest-navigation-destination]')?.options.length>2`);
  const before = await evaluate(`fetch('/api/v1/forest/homestead').then(r=>r.text())`);
  await choose('home'); await wait(`!document.querySelector('[data-forest-navigation]').hidden`);
  assert.equal(await evaluate(`document.querySelector('[data-forest-navigation-copy]').textContent.startsWith('Home')`), true);
  await send('browsingContext.setViewport', { context, viewport: { width: 390, height: 880 }, devicePixelRatio: 1 });
  await evaluate(`document.querySelector('[data-owner-forest-viewport]').scrollIntoView({block:'center'});true`);
  fs.mkdirSync('/tmp/forest-navigation-review', { recursive: true });
  await evaluate(`document.querySelector('#main-menu-close')?.click();document.querySelector('[data-owner-forest-viewport]').focus();true`);
  await evaluate(`new Promise(r=>setTimeout(r,350))`);
  const mainImage=await send('browsingContext.captureScreenshot',{context});
  fs.writeFileSync('/tmp/forest-navigation-review/main-390.png',Buffer.from(mainImage.data,'base64'));
  await choose('cart');
  assert.equal(await evaluate(`document.querySelector('[data-forest-navigation-copy]').textContent.startsWith('Parked cart')`), true);
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-homestead-guide], [data-homestead-cart-guide]'))`), false);
  await click('[data-forest-navigation-stop]');
  assert.equal(await evaluate(`document.querySelector('[data-forest-navigation]').hidden`), true);
  await choose('home'); await navigate('http://127.0.0.1:4185');
  await wait(`document.querySelector('[data-forest-navigation-destination]')?.options.length>2`);
  assert.equal(await evaluate(`document.querySelector('[data-forest-navigation]').hidden`), true);
  assert.equal(await evaluate(`fetch('/api/v1/forest/homestead').then(r=>r.text())`), before);
  console.log('PASS main forest: shared home/cart selection, Stop, visit-local reload and unchanged saved homestead');

  await navigate(fixture); await wait(`window.homeCartStudy?.snapshot().regionReady && document.querySelector('[data-forest-navigation-destination]').options.length>3`);
  await evaluate(`(async()=>{window.navigationGarden=await fetch('/api/v1/forest/garden').then(r=>r.json());const original=window.fetch.bind(window);
    window.fetch=(url,options)=>typeof url==='string'&&url.startsWith('/api/v1/forest/garden')?Promise.resolve(new Response(JSON.stringify(navigationGarden),{headers:{'Content-Type':'application/json'}})):original(url,options);return true;})()`);
  const plant = await evaluate(`navigationGarden.plants[0].plantId`);
  await choose('home'); await click('[data-garden-open]');
  await wait(`document.querySelector('[data-forest-navigation]').hidden`);
  await click(`[data-garden-plants] [data-plant-id="${plant}"]`);
  await wait(`!document.querySelector('[data-forest-navigation]').hidden`);
  assert.equal(await evaluate(`document.querySelector('[data-forest-navigation-destination]').value`), `garden:${plant}`);
  assert.equal(await evaluate(`document.querySelector('[data-garden-navigation]').hidden`), true);
  const oldText = await evaluate(`document.querySelector('[data-forest-navigation-copy]').textContent`);
  await evaluate(`navigationGarden.plants[0].worldX+=400;true`);
  await click('[data-garden-open]'); await click('[data-garden-refresh]'); await click('[data-garden-close]');
  await wait(`document.querySelector('[data-forest-navigation-copy]').textContent!==${JSON.stringify(oldText)}`);
  await evaluate(`navigationGarden.plants.shift();true`);
  await click('[data-garden-open]'); await click('[data-garden-refresh]'); await click('[data-garden-close]');
  await wait(`document.querySelector('[data-forest-navigation]').hidden`);
  assert.equal(await evaluate(`document.querySelector('[data-forest-navigation-notice]').textContent.includes('no longer available')`), true);
  console.log('PASS shared fixture: contextual plant replaces home, moved plant updates, removed plant stops, no duplicate compass');
  await choose('cart'); await click('[data-study-mount]');
  await wait(`homeCartStudy.snapshot().mounted`);
  const beforeDrive=await evaluate(`homeCartStudy.snapshot().cart.worldX`);
  await evaluate(`(()=>{const v=document.querySelector('[data-owner-forest-viewport]');v.focus();v.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));return true;})()`);
  await evaluate(`new Promise(r=>setTimeout(r,1100))`);
  await evaluate(`document.querySelector('[data-owner-forest-viewport]').dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowRight',bubbles:true}));true`);
  assert.ok(await evaluate(`homeCartStudy.snapshot().cart.worldX>${beforeDrive}+40`));
  await wait(`document.querySelector('[data-forest-navigation-copy]').textContent==='Parked cart · Nearby'`);
  console.log('PASS cart destination follows actual cart motion rather than its original parked coordinates');
  await click('[data-study-mount]'); await wait(`!homeCartStudy.snapshot().mounted`);

  fs.mkdirSync('/tmp/forest-navigation-review', { recursive: true });
  for (const width of [1280, 390, 320]) {
    await send('browsingContext.setViewport', { context, viewport: { width, height: 880 }, devicePixelRatio: 1 });
    await choose('home'); await evaluate(`document.querySelector('[data-owner-forest-viewport]').scrollIntoView({block:'center'});true`);
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true);
    const image = await send('browsingContext.captureScreenshot', { context });
    fs.writeFileSync(`/tmp/forest-navigation-review/compass-${width}.png`, Buffer.from(image.data, 'base64'));
    await click('[data-owner-forest-more]'); await evaluate(`document.querySelector('.forest-navigation-picker').open=true;true`);
    const picker = await send('browsingContext.captureScreenshot', { context });
    fs.writeFileSync(`/tmp/forest-navigation-review/picker-${width}.png`, Buffer.from(picker.data, 'base64'));
  }
  console.log('PASS desktop, 390px and 320px compass/picker containment; screenshots saved');
} finally {
  if (started) await send('session.end'); ws.close(); await new Promise(resolve => server.close(resolve));
}
