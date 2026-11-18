// Browser review of the main forest page, using only the reserved local integration owner.
/* global WebSocket */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = 'http://127.0.0.1:4185';
const ws = new WebSocket(process.argv[2] || 'ws://127.0.0.1:9239/session');
const pending = new Map(); let id = 0, started = false;
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const key = ++id, timer = setTimeout(() => reject(new Error(method)), 45000);
  pending.set(key, { resolve, reject, timer }); ws.send(JSON.stringify({ id: key, method, params }));
});
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data), call = pending.get(message.id); if (!call) return;
  pending.delete(message.id); clearTimeout(call.timer);
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
    if(${condition}){clearInterval(timer);resolve(true);}else if(Date.now()-start>25000){clearInterval(timer);reject(new Error(${JSON.stringify(condition)}));}},50);})`);
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click();true`);
  const read = () => evaluate(`fetch('/api/v1/forest/homestead').then(r=>r.text())`).then(JSON.parse);
  const navigate = () => send('browsingContext.navigate', { context, url: `${base}/en/forest`, wait: 'complete' });
  await send('browsingContext.setViewport', { context, viewport: { width: 1280, height: 880 }, devicePixelRatio: 1 });
  await navigate();
  const initial = await read(); assert.equal(initial.ownerUserId, '64b00000000000000000a097');
  assert.equal(await evaluate(`Boolean(window.homeCartStudy)`), false);
  if (!initial.established) {
    await wait(`!document.querySelector('[data-homestead-start-action]').disabled`);
    await click('[data-homestead-start-action]');
  }
  await wait(`document.querySelector('[data-homestead-guide]') && document.querySelector('[data-homestead-start]').hidden`);
  const saved = await read(); assert.equal(saved.established, true);
  const compatibility = JSON.parse(await evaluate(`(async()=>{
    const homes=await fetch('/api/v1/forest/homestead').then(r=>r.json());
    const post=async(path,body)=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
    const forged=await post('/api/v1/forest/homestead',{action:'recover',ownerUserId:'forged'});
    let garden=await fetch('/api/v1/forest/garden').then(r=>r.json());
    if(!garden.acquired) {const result=await post('/api/v1/forest/garden',{action:'acquire',expectedRevision:garden.revision,terrainToken:null});if(result.status!==200)throw new Error(JSON.stringify(result));garden=result.body;}
    const collision=await post('/api/v1/forest/garden',{action:'plant',expectedRevision:garden.revision,terrainToken:null,plantId:crypto.randomUUID(),worldX:homes.layout.home.x,worldY:homes.layout.home.y-30});
    if(!garden.plants.length) for(const [x,y] of [[-200,200],[-250,200],[-250,-200]]){
      const result=await post('/api/v1/forest/garden',{action:'plant',expectedRevision:garden.revision,terrainToken:null,plantId:crypto.randomUUID(),worldX:x,worldY:y});
      if(result.status===200){garden=result.body;break;}
    }
    const manifest=await fetch('/api/v1/forest/regions?cells=-1:-2,0:-2,1:-2,-1:-1,0:-1,1:-1,-1:0,0:0,1:0').then(r=>r.json());
    const tree=manifest.placements[0]; if(!tree)throw new Error('Real writing tree missing');
    const inspection=await fetch('/api/v1/forest/trees/'+tree.id+'/inspection').then(r=>r.json());
    return JSON.stringify({forged:forged.status,collision:collision.status,plants:garden.plants,tree,inspection});
  })()`));
  assert.equal(compatibility.forged, 400); assert.equal(compatibility.collision, 409);
  assert.ok(compatibility.plants.length > 0); assert.equal(compatibility.inspection.writing.title, 'A first walk from home');
  console.log('PASS real garden/writing coexistence, reserved-house planting rejection and malformed-command rejection');

  assert.equal(await evaluate(`document.querySelector('[data-owner-forest-reset]').textContent`), 'Return to the center');
  assert.equal(await evaluate(`Boolean(document.querySelector('.home-study-note'))`), false);
  const bootstrap = JSON.parse(await evaluate(`document.querySelector('#owner-forest-bootstrap').textContent`));
  assert.equal(bootstrap.spawn.worldX, 0); assert.equal(bootstrap.spawn.worldY, 0);
  await wait(`document.querySelector('[data-study-edit="home"]').closest('div').hidden`);
  await click('[data-owner-forest-more]'); await click('[data-homestead-guide]');
  await wait(`document.querySelector('[data-study-guide]').textContent.includes('Home')`);
  let beforeRecovery = (await read()).revision;
  await click('[data-owner-forest-more]'); await click('[data-study-recover]');
  await wait(`document.querySelector('[data-save-status]').textContent===''`);
  assert.ok((await read()).revision > beforeRecovery);
  await wait(`!document.querySelector('[data-study-edit="home"]').disabled`);
  await click('[data-study-edit="home"]');
  await wait(`!document.querySelector('.home-study-editor').hidden`);
  await evaluate(`(()=>{const s=document.querySelector('[data-design-field="color"]');s.value='sage';s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
  await click('[data-design-apply]');
  await wait(`document.querySelector('.home-study-editor').hidden`);
  assert.equal((await read()).homeDesign.color, 'sage');
  console.log('PASS main page: explicit establishment, ordinary entrance, contextual workshop, home guide and durable design');
  await click('[data-study-mount]');
  await wait(`document.querySelector('[data-owner-forest-viewport]').dataset.studyMounted==='true'`);
  await click('[data-study-careful]');
  await wait(`document.querySelector('[data-study-careful]').getAttribute('aria-pressed')==='true'`);
  await click('[data-study-mount]');
  await wait(`document.querySelector('[data-owner-forest-viewport]').dataset.studyMounted==='false'`);
  const parked = await read(); assert.equal(parked.cartId, saved.cartId);
  await navigate();
  await wait(`document.querySelector('[data-homestead-guide]')`);
  assert.equal((await read()).homeDesign.color, 'sage');
  assert.deepEqual((await read()).parking, parked.parking);
  console.log('PASS main page: boarding, careful driving, parking and reload through application endpoints');
  await send('browsingContext.navigate', {context,url:base+'/en/forest?returnTree='+compatibility.tree.id,wait:'complete'});
  await wait(`document.querySelector('[data-homestead-guide]')`);
  const returned=JSON.parse(await evaluate(`document.querySelector('#owner-forest-bootstrap').textContent`));
  assert.equal(returned.returnDestination.treeId,compatibility.tree.id);
  assert.ok(Math.hypot(returned.returnDestination.spawn.worldX-saved.parking.worldX,returned.returnDestination.spawn.worldY-saved.parking.worldY)>50);
  const gardenAfter=JSON.parse(await evaluate(`fetch('/api/v1/forest/garden').then(r=>r.text())`));
  assert.deepEqual(gardenAfter.plants.map(p=>p.plantId),compatibility.plants.map(p=>p.plantId));
  console.log('PASS real writing-return locator remains active beside homestead loading; garden survives reload');

  fs.mkdirSync('/tmp/forest-homestead-application-review', { recursive: true });
  for (const width of [1280, 390, 320]) {
    await send('browsingContext.setViewport', { context, viewport: { width, height: width < 700 ? 820 : 880 }, devicePixelRatio: 1 });
    beforeRecovery = (await read()).revision;
    await click('[data-owner-forest-more]'); await click('[data-study-recover]');
    await wait(`document.querySelector('[data-save-status]').textContent===''`);
    assert.ok((await read()).revision > beforeRecovery);
    await wait(`!document.querySelector('[data-study-edit="home"]').disabled`);
    await evaluate(`new Promise(r=>setTimeout(r,400))`);
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=window.innerWidth`), true);
    await evaluate(`document.querySelector('[data-owner-forest-viewport]').scrollIntoView({block:'center'});true`);
    const shot = await send('browsingContext.captureScreenshot', { context });
    fs.writeFileSync(`/tmp/forest-homestead-application-review/${width}.png`, Buffer.from(shot.data, 'base64'));
  }
  console.log('PASS main page: desktop, 390px and 320px containment; screenshots saved');
} finally {
  if (started) await send('session.end'); ws.close();
}
