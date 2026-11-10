// Layout review against forestGardenFixture.js serve --write and Firefox BiDi on port 9225.
// Garden responses are intercepted in the browser; this does not change saved fixture data.
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
  const click = async selector => {
    const point=JSON.parse(await evaluate(`JSON.stringify((()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})())`));
    await send('input.performActions',{context,actions:[{type:'pointer',id:'clicker',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',...point},{type:'pointerDown',button:0},{type:'pointerUp',button:0}]}]});
  };
  const go = () => send('browsingContext.navigate', { context, url: `${base}/en/forest`, wait: 'complete' });
  const capture = async name => {
    await evaluate(`document.documentElement.dataset.theme='dark'`);
    await send('input.performActions', { context, actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' },
      actions: [{ type: 'pointerMove', x: 150, y: 350 }] }] });
    const result = await send('browsingContext.captureScreenshot', { context });
    fs.mkdirSync('/tmp/forest-garden-review', { recursive: true });
    fs.writeFileSync(`/tmp/forest-garden-review/${name}.png`, Buffer.from(result.data, 'base64'));
  };
  const preload=await send('script.addPreloadScript',{functionDeclaration:`() => {
    const native=window.fetch.bind(window);
    let data={version:1,acquired:false,revision:0,cuttings:0,serverNow:'2026-11-09T12:00:00Z',plants:[]};
    window.reviewPlant=(x=0)=>{data.plants=[{plantId:'22222222-2222-4222-8222-222222222222',worldX:x,worldY:40,plantedAt:data.serverNow,readyAt:'2026-11-09T12:20:00Z',stage:'rooted',ready:false}]};
    window.fetch=async(url,options)=>{
      if(url!=='/api/v1/forest/garden')return native(url,options);
      if(options?.method==='POST'){
        const c=JSON.parse(options.body);data.revision++;
        if(c.action==='acquire'){data.acquired=true;data.cuttings=1}
        else throw new Error('Unexpected review mutation');
      }
      return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
    };
  }`});
  for(const width of [390,320,1280]) {
    await send('browsingContext.setViewport',{context,viewport:{width,height:900}});
    await go();
    await wait(`!document.querySelector('[data-garden-refresh]').disabled`);
    await evaluate(`document.querySelector('#main-menu-close').click()`);
    await new Promise(r=>setTimeout(r,300));
    await evaluate(`document.querySelector('[data-owner-forest-viewport]').scrollIntoView({block:'center'})`);
    await wait(`!document.querySelector('[data-garden-acquire]').disabled`);
    const check=()=>evaluate(`(()=>{
      const view=document.querySelector('[data-owner-forest-viewport]').getBoundingClientRect();
      const dock=document.querySelector('[data-owner-forest-dock]').getBoundingClientRect();
      return dock.left>=view.left && dock.right<=view.right && dock.bottom<=view.bottom && dock.top>=view.top
        && document.querySelector('[data-owner-forest-dock]').scrollWidth<=document.querySelector('[data-owner-forest-dock]').clientWidth
        && document.documentElement.scrollWidth<=innerWidth;
    })()`);
    assert.equal(await check(),true,'dock fits before collection');
    await capture(`dock-${width}-wild`);
    await click('[data-garden-acquire]');
    await wait(`document.querySelector('[data-garden-count]').textContent.includes('1 / 8')`);
    await wait(`document.querySelector('[data-garden-near]').hidden`);
    assert.equal(await check(),true,'dock fits after collection');
    await capture(`dock-${width}-collected`);
    await new Promise(r=>setTimeout(r,4800));
    assert.equal(await evaluate(`document.querySelector('[data-garden-notice]').hidden`),true,'feedback expires');
    await capture(`dock-${width}-carrying`);
    await click('[data-owner-forest-more]');
    assert.equal(await evaluate(`document.querySelector('[data-owner-forest-more]').getAttribute('aria-expanded')`),'true');
    await capture(`dock-${width}-more`);
    await click('[data-owner-forest-place-marker]');
    await wait(`!document.querySelector('[data-owner-forest-placement]').hidden`);
    assert.equal(await evaluate(`document.querySelector('[data-owner-forest-more-panel]').hidden`),true);
    assert.equal(await check(),true,'marker placement fits');
    await capture(`dock-${width}-marker`);
    await click('[data-owner-forest-placement-cancel]');
    await wait(`!document.querySelector('[data-garden-plant]').disabled`);
    await click('[data-garden-plant]');
    await wait(`!document.querySelector('[data-garden-toolbar]').hidden`);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.owner-forest__hud-actions')).display`),'none');
    assert.equal(await check(),true,'planting fits');
    await capture(`dock-${width}-planting`);
    await click('[data-garden-cancel]');
    await click('[data-garden-open]');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('[data-owner-forest-dock]')).display`),'none');
    assert.equal(await evaluate(`(()=>{const p=document.querySelector('[data-forest-garden]').getBoundingClientRect(),v=document.querySelector('[data-owner-forest-viewport]').getBoundingClientRect();return p.top>=v.top && p.bottom<=v.bottom})()`),true);
    await capture(`dock-${width}-satchel`);
    await click('[data-garden-close]');
    await click('[data-owner-forest-more]');
    await send('input.performActions',{context,actions:[{type:'key',id:'keys',actions:[{type:'keyDown',value:'\uE00C'},{type:'keyUp',value:'\uE00C'}]}]});
    assert.equal(await evaluate(`document.querySelector('[data-owner-forest-more-panel]').hidden`),true,'Escape closes More');
    await evaluate(`window.reviewPlant();document.querySelector('[data-garden-refresh]').click()`);
    await wait(`!document.querySelector('[data-garden-near]').hidden`);
    assert.equal(await check(),true,'immature plant actions fit');
    await capture(`dock-${width}-immature`);
    await click('[data-owner-forest-more]');
    await click('.owner-forest__more summary');
    assert.equal(await check(),true,'expanded Help fits');
    await capture(`dock-${width}-help`);
    await click('[data-owner-forest-more]');
    await evaluate(`window.reviewPlant(240);document.querySelector('[data-garden-refresh]').click()`);
    await wait(`document.querySelector('[data-garden-refresh]').disabled===false`);
    await click('[data-garden-open]');
    await click('[data-forest-garden] details summary');
    await click('[data-garden-plants] button');
    await wait(`!document.querySelector('[data-garden-navigation]').hidden`);
    assert.equal(await evaluate(`document.querySelector('[data-forest-garden]').hidden`),true);
    assert.equal(await check(),true,'navigation fits');
    await capture(`dock-${width}-navigation`);
    const initialBearing=await evaluate(`document.querySelector('[data-garden-navigation-copy]').textContent`);
    const walk = async duration => send('input.performActions',{context,actions:[{type:'key',id:'walking',actions:[{type:'keyDown',value:'d'},{type:'pause',duration},{type:'keyUp',value:'d'}]}]});
    await walk(500);
    assert.notEqual(await evaluate(`document.querySelector('[data-garden-navigation-copy]').textContent`),initialBearing);
    await walk(1800);
    await wait(`document.querySelector('[data-garden-navigation]').hidden`);
    console.log(`PASS dock at ${width}px: collection, expiring feedback, More, marker placement, planting, satchel, Escape, bounds`);
  }
  await send('script.removePreloadScript',{script:preload.script});
} finally {
  if(started) await send('session.end');
  ws.close();
}
