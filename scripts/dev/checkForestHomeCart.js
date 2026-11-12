// Firefox BiDi review of the isolated owner-template fixture. No account or database access.
/* global WebSocket */
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
const screenshotDir = '/tmp/forest-home-cart-review'; fs.mkdirSync(screenshotDir, { recursive: true });
try {
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  await send('session.new', { capabilities: {} }); started = true;
  const { context } = await send('browsingContext.create', { type: 'tab' });
  const evaluate = async expression => {
    const result = await send('script.evaluate', { target: { context }, expression, awaitPromise: true });
    assert.equal(result.type, 'success', JSON.stringify(result)); return result.result.value;
  };
  const wait = expression => evaluate(`new Promise((resolve, reject) => {
    const started = performance.now(); const timer = setInterval(() => {
      if (${expression}) { clearInterval(timer); resolve(true); }
      else if (performance.now() - started > 12000) { clearInterval(timer); reject(new Error('Condition: ' + ${JSON.stringify(expression)})); }
    }, 40);
  })`);
  const snapshot = async () => JSON.parse(await evaluate('JSON.stringify(window.homeCartStudy.snapshot())'));
  const key = key => evaluate(`document.querySelector('[data-owner-forest-viewport]').dispatchEvent(new KeyboardEvent('keydown', {key:${JSON.stringify(key)},bubbles:true})); true`);
  const choose = (selector, value) => evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); el.value=${JSON.stringify(value)}; el.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click(); true`);
  const holdKey = async (value, milliseconds) => {
    await key(value); await evaluate(`new Promise(resolve=>setTimeout(resolve,${milliseconds}))`);
    await evaluate(`document.querySelector('[data-owner-forest-viewport]').dispatchEvent(new KeyboardEvent('keyup',{key:${JSON.stringify(value)},bubbles:true}));true`);
  };
  const capture = async name => {
    await evaluate(`document.querySelector('[data-owner-forest-viewport]').scrollIntoView({block:'center'}); true`);
    const shot = await send('browsingContext.captureScreenshot', { context });
    fs.writeFileSync(`${screenshotDir}/${name}.png`, Buffer.from(shot.data, 'base64'));
  };
  const drive = async target => evaluate(`new Promise((resolve, reject) => {
    const v=document.querySelector('[data-owner-forest-viewport]'); v.focus();
    const target=${JSON.stringify(target)}, started=performance.now();
    const release=()=>['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].forEach(key=>v.dispatchEvent(new KeyboardEvent('keyup',{key,bubbles:true})));
    const timer=setInterval(()=>{
      const s=window.homeCartStudy.snapshot(); const dx=target.x-s.cart.worldX,dy=target.y-s.cart.worldY;
      release();
      if(Math.hypot(dx,dy)<24){clearInterval(timer);resolve(JSON.stringify(s));return;}
      if(performance.now()-started>30000){clearInterval(timer);reject(new Error('Drive timed out '+JSON.stringify(s)));return;}
      const keys=[]; if(Math.abs(dx)>14)keys.push(dx>0?'ArrowRight':'ArrowLeft'); if(Math.abs(dy)>14)keys.push(dy>0?'ArrowDown':'ArrowUp');
      keys.forEach(key=>v.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true})));
    },45);
  })`);

  await send('browsingContext.setViewport', { context, viewport: { width: 1280, height: 880 }, devicePixelRatio: 1 });
  await send('browsingContext.navigate', { context, url: `${base}/en/forest`, wait: 'complete' });
  await wait('window.homeCartStudy && window.homeCartStudy.snapshot().regionReady');
  const renderCheck = JSON.parse(await evaluate(`import('/__study/render-check.js').then(module => JSON.stringify(module.checkCartRendering()))`));
  fs.writeFileSync(`${screenshotDir}/cart-rotation-sheet.png`, Buffer.from(renderCheck.image, 'base64'));
  console.log(`PASS ${renderCheck.checks} rider/floor pixel checks; rotation sheet: ${screenshotDir}/cart-rotation-sheet.png`);
  if (process.env.FOREST_CART_RENDER_ONLY !== 'true') {
  await capture('01-home-large');
  await key('c'); await wait('window.homeCartStudy.snapshot().mounted');
  for (const p of plan.route.slice(1)) await drive(p);
  await capture('02-destination-cart');
  await key('c'); await wait('window.homeCartStudy.snapshot().visited');
  await capture('03-destination-on-foot');
  await key('c'); await wait('window.homeCartStudy.snapshot().mounted');
  for (const p of [...plan.route].reverse().slice(1)) await drive(p);
  await wait('window.homeCartStudy.snapshot().completed');
  console.log('PASS large-cart round trip:', JSON.stringify(await snapshot()));
  if (process.env.FOREST_CART_QUICK === 'true') {
    console.log('PASS alternate geography delivery:', JSON.stringify(app.locals.studyDelivery));
  } else {
  assert.equal(await evaluate('document.querySelector("[data-study-edit=cart]").disabled'), true, 'Cannot rebuild while riding');
  await key('c'); await wait('!window.homeCartStudy.snapshot().mounted');
  await wait('!document.querySelector("[data-study-edit=home]").disabled');
  const original = await snapshot();
  await click('[data-study-edit=home]');
  await choose('[data-design-field=width]', '120'); await choose('[data-design-field=depth]', '72');
  await choose('[data-design-field=walls]', 'shingles'); await choose('[data-design-field=color]', 'clay');
  await choose('[data-design-field=roof]', 'tiles'); await choose('[data-design-field=roofColor]', 'rust');
  assert.deepEqual((await snapshot()).homeDesign, original.homeDesign, 'Preview does not commit');
  await key('ArrowRight'); await evaluate('new Promise(resolve=>setTimeout(resolve,150))');
  assert.deepEqual((await snapshot()).player, original.player, 'Editor suspends scene movement');
  await capture('07-house-workshop');
  await click('[data-design-cancel]');
  assert.deepEqual((await snapshot()).homeDesign, original.homeDesign, 'Cancel keeps applied house');
  assert.equal(await evaluate('document.activeElement.matches("[data-study-edit=home]")'), true, 'Cancel returns focus');
  await click('[data-study-edit=home]');
  await choose('[data-design-field=width]', '150'); await choose('[data-design-field=depth]', '86');
  await choose('[data-design-field=walls]', 'shingles'); await choose('[data-design-field=color]', 'cream');
  await choose('[data-design-field=roof]', 'tiles'); await choose('[data-design-field=roofColor]', 'rust');
  await click('[data-design-apply]');
  assert.equal((await snapshot()).editor, null);
  assert.equal((await snapshot()).homeDesign.width, 150);
  assert.equal((await snapshot()).homeDesign.color, 'cream');
  await click('[data-study-edit=cart]');
  await choose('[data-design-field=length]', '44'); await choose('[data-design-field=width]', '30');
  await choose('[data-design-field=body]', 'rails'); await choose('[data-design-field=wheels]', 'solid');
  await choose('[data-design-field=supports]', 'posts'); await choose('[data-design-field=canopy]', 'linen');
  await choose('[data-design-field=wood]', 'walnut'); await choose('[data-design-field=cloth]', 'ochre');
  assert.deepEqual((await snapshot()).cart, original.cart, 'Cart previews leave pose and applied design alone');
  await capture('08-cart-workshop');
  await click('[data-design-apply]');
  assert.equal((await snapshot()).editor, null);
  assert.equal((await snapshot()).cart.design.length, 44);
  assert.equal((await snapshot()).cart.design.wheels, 'solid');
  await key('c'); await wait('window.homeCartStudy.snapshot().mounted');
  const wheelBefore = (await snapshot()).presentation.wheel;
  for (const p of plan.route.slice(1)) await drive(p);
  assert.notEqual((await snapshot()).presentation.wheel, wheelBefore, 'Travel advances wheels');
  const stoppedMotion = (await snapshot()).presentation;
  await evaluate('new Promise(resolve=>setTimeout(resolve,180))');
  assert.deepEqual((await snapshot()).presentation, stoppedMotion, 'Animation stops with travel');
  await capture('09-custom-cart-rider');
  for (const p of [...plan.route].reverse().slice(1)) await drive(p);
  assert.equal((await snapshot()).cart.design.wood, 'walnut', 'Trip retains applied design');
  console.log('PASS home/cart preview, cancel, apply, focus restoration and custom-cart round trip');
  await choose('[data-study-network]', 'failed');
  const before = (await snapshot()).cart;
  await key('ArrowRight');
  await evaluate('new Promise(resolve=>setTimeout(resolve,700))');
  await evaluate(`document.querySelector('[data-owner-forest-viewport]').dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowRight',bubbles:true}));true`);
  assert.deepEqual((await snapshot()).cart, before, 'Unavailable regions stop movement');
  await choose('[data-study-network]', 'slow');
  await wait('!document.querySelector("[data-owner-forest-place-marker]").disabled');
  await choose('[data-study-network]', 'normal');
  await wait('!document.querySelector("[data-owner-forest-place-marker]").disabled');
  await choose('[data-study-cart]', 'compact'); await choose('[data-study-house]', 'compact');
  await key('c'); await wait('window.homeCartStudy.snapshot().mounted');
  await key('r'); await key('ArrowLeft');
  await evaluate('new Promise(resolve=>setTimeout(resolve,200))');
  await evaluate(`document.querySelector('[data-owner-forest-viewport]').dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowLeft',bubbles:true}));true`);
  assert.ok((await snapshot()).cart.worldX < plan.parking.x, 'Reverse moves backward');
  await key('r');
  await capture('04-compact-home-cart');
  for (const p of plan.route.slice(1)) await drive(p);
  for (const p of [...plan.route].reverse().slice(1)) await drive(p);
  console.log('PASS compact cart, reverse and region failure/recovery:', JSON.stringify(await snapshot()));
  await click('[data-study-recover]'); await holdKey('ArrowRight', 180);
  await wait('!document.querySelector("[data-study-edit=cart]").disabled');
  await click('[data-study-edit=cart]');
  await choose('[data-design-field=length]', '52'); await choose('[data-design-field=width]', '36');
  assert.equal((await snapshot()).editor.valid, false, 'Cannot enlarge cart through the standing player');
  await click('[data-design-apply]');
  assert.equal((await snapshot()).cart.design.length, 36, 'Refused cart enlargement preserves design');
  await click('[data-design-cancel]'); await click('[data-study-recover]');
  await holdKey('ArrowLeft', 130); await holdKey('ArrowUp', 1400);
  await wait('!document.querySelector("[data-study-edit=home]").disabled');
  await click('[data-study-edit=home]'); await choose('[data-design-field=width]', '180');
  assert.equal((await snapshot()).editor.valid, false, 'Cannot enlarge house over the standing player');
  await capture('11-occupied-footprint');
  await click('[data-design-apply]'); assert.equal((await snapshot()).homeDesign.width, 120);
  await click('[data-design-cancel]'); await click('[data-study-recover]');
  console.log('PASS occupied-space enlargement refusals preserve house, cart and player');
  for (const width of [390, 320]) {
    await send('browsingContext.setViewport', { context, viewport: { width, height: 850 }, devicePixelRatio: 1 });
    await evaluate(`document.querySelector('[data-study-recover]').click();true`);
    await wait('!window.homeCartStudy.snapshot().mounted');
    await wait('!document.querySelector("[data-study-edit=home]").disabled');
    await click('[data-study-edit=home]');
    await choose('[data-design-field=color]', 'sage');
    assert.equal(await evaluate(`(() => { const v=document.querySelector('[data-owner-forest-viewport]').getBoundingClientRect(); const p=document.querySelector('.home-study-editor').getBoundingClientRect(); return p.left>=v.left && p.right<=v.right && p.bottom<=v.bottom && p.top>v.top && document.documentElement.scrollWidth<=innerWidth; })()`), true, 'Editor fits narrow viewport');
    await capture(`10-editor-${width}`);
    await evaluate(`document.querySelector('.home-study-editor h2').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));true`);
    assert.equal((await snapshot()).editor, null, 'Escape cancels preview');
    await evaluate(`document.querySelector('[data-study-mount]').click();true`);
    assert.equal((await snapshot()).mounted, true);
    assert.equal(await evaluate(`(() => { const v=document.querySelector('[data-owner-forest-viewport]').getBoundingClientRect();const b=document.querySelector('.home-study-bar').getBoundingClientRect();return b.left>=v.left && b.right<=v.right && b.bottom<=v.bottom && document.documentElement.scrollWidth<=innerWidth; })()`), true);
    // Native touch pointer input through BiDi exercises the ordinary floating joystick.
    await evaluate(`document.querySelector('[data-owner-forest-viewport]').scrollIntoView({block:'center'});true`);
    const pos = JSON.parse(await evaluate(`JSON.stringify((()=>{const r=document.querySelector('[data-owner-forest-canvas]').getBoundingClientRect();return {x:Math.round(r.left+80),y:Math.round(r.top+110)}})())`));
    const xBefore = (await snapshot()).cart.worldX;
    await send('input.performActions', { context, actions: [{ type: 'pointer', id: 'touch-study', parameters: { pointerType: 'touch' },
      actions: [{ type: 'pointerMove', x: pos.x, y: pos.y }, { type: 'pointerDown', button: 0 },
        { type: 'pointerMove', x: pos.x + 65, y: pos.y, duration: 200 }, { type: 'pause', duration: 500 }, { type: 'pointerUp', button: 0 }] }] });
    assert.ok((await snapshot()).cart.worldX > xBefore + 10, 'Touch drag drives cart');
    await capture(`05-touch-${width}`);
  }
  await send('browsingContext.navigate', { context, url: `${base}/en/forest`, wait: 'complete' });
  await wait('window.homeCartStudy');
  assert.equal((await snapshot()).mounted, false); assert.equal((await snapshot()).cart.worldX, plan.parking.x);
  assert.equal((await snapshot()).homeDesign.color, 'honey', 'Reload resets temporary house');
  assert.equal((await snapshot()).cart.design.wheels, 'spoked', 'Reload resets temporary cart');
  const preload = await send('script.addPreloadScript', { functionDeclaration: `() => {
    const original=window.matchMedia.bind(window);window.matchMedia=query=>{
      const result=original(query);if(query==='(prefers-reduced-motion: reduce)')Object.defineProperty(result,'matches',{value:true});return result;
    };
  }` });
  await send('browsingContext.navigate', { context, url: `${base}/en/forest`, wait: 'complete' });
  await wait('window.homeCartStudy && window.homeCartStudy.snapshot().regionReady');
  await key('c'); await wait('window.homeCartStudy.snapshot().mounted');
  await key('ArrowRight'); await evaluate('new Promise(resolve=>setTimeout(resolve,250))');
  await evaluate(`document.querySelector('[data-owner-forest-viewport]').dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowRight',bubbles:true}));true`);
  assert.ok((await snapshot()).cart.worldX > plan.parking.x, 'Reduced motion retains driving');
  assert.deepEqual((await snapshot()).presentation, { wheel: 0, gait: 0 }, 'Reduced motion suppresses decorative animation');
  await capture('06-reduced-motion');
  await send('script.removePreloadScript', { script: preload.script });
  console.log('PASS reload, reduced motion, 320/390px containment and native emulated touch. Screenshots:', screenshotDir);
  console.log('Delivery:', JSON.stringify(app.locals.studyDelivery));
  }
  }
} finally {
  if (started) await send('session.end').catch(() => {});
  ws.close(); server.close(); server.closeAllConnections();
  for (const p of pending.values()) clearTimeout(p.timeout);
}
