// Browser review of the main forest page, using only the reserved local integration owner.
/* global WebSocket */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = `http://127.0.0.1:${process.env.FOREST_APPLICATION_PREVIEW_PORT || 4185}`;
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
  const choose = (name, value) => evaluate(`(()=>{
    const select = document.querySelector('[data-design-field="${name}"]');
    select.value = '${value}'; select.dispatchEvent(new Event('change', { bubbles: true }));
    return select.value;
  })()`);
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click();true`);
  const read = () => evaluate(`fetch('/api/v1/forest/homestead').then(r=>r.text())`).then(JSON.parse);
  const navigate = () => send('browsingContext.navigate', { context, url: `${base}/en/forest`, wait: 'complete' });
  const enabled = selector => `Boolean(document.querySelector('${selector}')?.getClientRects().length)
    && !document.querySelector('${selector}').disabled`;
  const holdKeys = (keys, duration) => send('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions: [
    ...keys.map(value => ({ type: 'keyDown', value })),
    { type: 'pause', duration },
    ...keys.map(value => ({ type: 'keyUp', value }))
  ] }] });
  async function guideTo(id) {
    await evaluate(`(()=>{
      if(document.querySelector('[data-owner-forest-more-panel]').hidden) document.querySelector('[data-owner-forest-more]').click();
      document.querySelector('.forest-navigation-picker').open=true;
      const select=document.querySelector('[data-forest-navigation-destination]');
      select.value='${id}';select.dispatchEvent(new Event('change'));return true;
    })()`);
    await click('[data-forest-navigation-go]');
  }
  async function followCompass(until, duration = 220) {
    await evaluate(`document.querySelector('[data-owner-forest-viewport]').focus();true`);
    for (let step = 0; step < 35 && !await evaluate(until); step++) {
      const bearing = await evaluate(`document.querySelector('[data-forest-navigation-arrow]').getAttribute('aria-label')`);
      const keys = [['east', 'd'], ['west', 'a'], ['south', 's'], ['north', 'w']]
        .filter(([direction]) => bearing.includes(direction)).map(([, key]) => key);
      assert.ok(keys.length, 'Compass direction is missing');
      await holdKeys(keys, duration);
    }
    await wait(until);
  }
  await send('browsingContext.setViewport', { context, viewport: { width: 1280, height: 880 }, devicePixelRatio: 1 });
  await navigate();
  const initial = await read(); assert.equal(initial.ownerUserId, '64b00000000000000000a097');
  assert.equal(await evaluate(`Boolean(window.homeCartStudy)`), false);
  const travelerMemory = () => evaluate(`document.querySelector('#owner-forest-bootstrap').textContent`)
    .then(payload => JSON.parse(payload).traveler);
  const talk = '[data-forest-traveler-talk]', dialog = '[data-forest-traveler-dialog]';
  const line = () => evaluate(`document.querySelector('[data-forest-traveler-line]').textContent`);
  async function approachTansy() {
    await wait(`Boolean(document.querySelector('[data-forest-navigation-destination] option[value="tansy"]'))`);
    await guideTo('tansy');
    await followCompass(enabled(talk));
    await click(talk);
    await wait(`document.querySelector('${dialog}').open`);
  }
  const beforeTraveler = await read();
  const reviewDir = '/tmp/forest-homestead-application-review';
  fs.mkdirSync(reviewDir, { recursive: true });
  await send('browsingContext.setViewport', { context, viewport: { width: 320, height: 820 }, devicePixelRatio: 1 });
  async function checkDialoguePlacement() {
    assert.equal(await evaluate(`(()=>{
      const stage=document.querySelector('[data-owner-forest-viewport]').getBoundingClientRect();
      const panel=document.querySelector('${dialog}').getBoundingClientRect();
      return panel.left>=stage.left && panel.right<=stage.right && panel.width>=stage.width-24
        && stage.bottom-panel.bottom<=12 && panel.top-stage.top>=stage.height*.4;
    })()`), true);
  }
  const initialMemory = await travelerMemory();
  if (!initialMemory.introduced) {
    await approachTansy();
    assert.match(await line(), /That cart’s outlasted every pair/);
    assert.equal(await evaluate(`document.querySelector('[data-forest-traveler-ask]').textContent`), 'Did you make that canopy?');
    await click('[data-forest-traveler-ask]');
    assert.match(await line(), /Every patch/);
    await checkDialoguePlacement();
    await evaluate(`document.querySelector('[data-owner-forest-viewport]').scrollIntoView({block:'center'});true`);
    const shot = await send('browsingContext.captureScreenshot', { context });
    fs.writeFileSync(`${reviewDir}/tansy-canopy-320.png`, Buffer.from(shot.data, 'base64'));
    await send('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions: [
      { type: 'keyDown', value: '\uE00C' }, { type: 'keyUp', value: '\uE00C' }
    ] }] });
    await wait(`!document.querySelector('${dialog}').open && document.activeElement.matches('[data-owner-forest-viewport]')`);
    await navigate();
    assert.equal((await travelerMemory()).introduced, false);
    await approachTansy();
    assert.match(await line(), /Name’s Tansy Rook/);
    await click('[data-forest-traveler-ask]');
    await click('[data-forest-traveler-finish]');
    await wait(`!document.querySelector('${dialog}').open`);
    await navigate();
    assert.equal((await travelerMemory()).introduced, true);
    assert.equal((await travelerMemory()).frameOwned, false);
    console.log('PASS Tansy first greeting, Escape, leaving the offer for later and introduction save');
  }
  await approachTansy();
  if (!beforeTraveler.cartDesign || beforeTraveler.cartDesign.supports !== 'ridge') {
    assert.doesNotMatch(await line(), /You fitted/);
  }
  if (!initialMemory.frameOwned) {
    assert.match(await line(), /canopy inspector/);
    assert.equal(await evaluate(`document.querySelector('[data-forest-traveler-ask]').hidden`), true);
    await checkDialoguePlacement();
    await click('[data-forest-traveler-accept]');
    await wait(`document.querySelector('[data-forest-traveler-line]').textContent.includes('It’s yours')`);
  }
  await click('[data-forest-traveler-leave]');
  const accepted = await read();
  assert.deepEqual(accepted.cartDesign, beforeTraveler.cartDesign);
  assert.equal(accepted.revision, beforeTraveler.revision);
  const replay = await evaluate(`fetch('/api/v1/forest/traveler', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forestId: '${accepted.forestId}', action: 'accept-frame' })
  }).then(r => r.text())`);
  assert.deepEqual(JSON.parse(replay), { introduced: true, frameOwned: true });
  await send('browsingContext.setViewport', { context, viewport: { width: 1280, height: 880 }, devicePixelRatio: 1 });
  await navigate();
  assert.equal((await travelerMemory()).frameOwned, true);
  assert.deepEqual(await read(), accepted);
  console.log(`PASS ${initialMemory.frameOwned ? 'owned frame' : accepted.cartDesign ? 'frame acceptance with a cart'
    : 'frame acceptance before building'}, exact retry and reload`);
  const silhouettes = JSON.parse(await evaluate(`(async () => {
    const { DEFAULT_CART_DESIGN } = await import('/js/forest-construction-design.js');
    const { paintStudyCart } = await import('/js/forest-homestead-paint.js');
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 125;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const tops = [['bows', 'patched'], ['ridge', 'patched'], ['posts', 'none'], ['ridge', 'none']]
      .map(([supports, canopy], index) => {
        const x = index * 160;
        paintStudyCart(ctx, { worldX: x + 53, worldY: 100, heading: -.3,
          design: { ...DEFAULT_CART_DESIGN, supports, canopy } }, { x: 0, y: 0 }, false);
        const pixels = ctx.getImageData(x, 0, 160, 125).data;
        return Math.floor(pixels.findIndex((alpha, i) => i % 4 === 3 && alpha > 0) / (4 * 160));
      });
    return JSON.stringify({ tops, image: canvas.toDataURL().split(',')[1] });
  })()`));
  const [bowsTop, coveredRidgeTop, postsTop, openRidgeTop] = silhouettes.tops;
  assert.ok(coveredRidgeTop > 0 && coveredRidgeTop < bowsTop - 8, `Covered silhouettes: ${bowsTop}, ${coveredRidgeTop}`);
  assert.ok(openRidgeTop > 0 && openRidgeTop < postsTop - 15, `Open silhouettes: ${postsTop}, ${openRidgeTop}`);
  fs.writeFileSync(`${reviewDir}/tansy-frame.png`, Buffer.from(silhouettes.image, 'base64'));

  if (!initial.established) {
    const start = '[data-homestead-start-action]';
    await wait(enabled(start));
    await click(start);
    await wait(`document.querySelector('[data-forest-navigation-copy]').textContent.includes('Suggested clearing')`);
    assert.equal((await read()).established, false);
    await followCompass(`document.querySelector('${start}').textContent==='Make my clearing'`);
    await click('[data-homestead-start-action]');
  }
  await wait(`document.querySelector('[data-forest-navigation-destination]') && document.querySelector('[data-homestead-start]').hidden`);
  const saved = await read(); assert.equal(saved.established, true);
  if (saved.schemaVersion === 3 && (!saved.cartDesign || saved.companion?.stage !== 'joined')) {
    if (!saved.cartDesign) {
      await guideTo('home');
      await followCompass(enabled('[data-study-edit="home"]'));
      if (!saved.starterSuppliesClaimed) {
        await click('[data-homestead-supplies]');
        await wait(enabled('[data-study-edit="cart"]'));
        assert.deepEqual((await read()).holdings, { timber: 96, cloth: 24 });
      }
      await click('[data-study-edit="cart"]');
      assert.equal(await choose('supports', 'ridge'), 'ridge');
      await wait(enabled('[data-design-apply]'));
      await click('[data-design-cancel]');
      assert.equal((await read()).cartDesign, null);
      await click('[data-study-edit="cart"]');
      await click('[data-design-apply]');
      await wait(`document.querySelector('.home-study-editor').hidden`);
      assert.ok((await read()).cartDesign);
    }
    if (saved.companion?.stage !== 'joined') {
      assert.equal(await evaluate(enabled('[data-study-mount]')), false);
      await guideTo('mallow');
      await followCompass(enabled('[data-companion-action]'));
      if (!saved.companion) {
        await click('[data-companion-action]');
        await wait(enabled('[data-companion-follow]'));
        assert.equal((await read()).companion.stage, 'acquainted');
      }
      await click('[data-companion-follow]');
      await wait(`document.querySelector('[data-companion-follow]').textContent==='Wait here'`);
      assert.equal((await read()).companion.stage, 'joined');
    }
    await navigate();
    await wait(`document.querySelector('[data-forest-navigation-destination]') && document.querySelector('[data-homestead-start]').hidden`);
    console.log('PASS starter supplies, free preview cancellation, first assembly and Mallow invitation across reload');
  }
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
    return JSON.stringify({forged:forged.status,collision:collision.status,gardenRevision:garden.revision,plants:garden.plants,tree,inspection});
  })()`));
  assert.equal(compatibility.forged, 400); assert.equal(compatibility.collision, 409);
  assert.ok(compatibility.plants.length > 0); assert.equal(compatibility.inspection.writing.title, 'A first walk from home');
  console.log('PASS real garden/writing coexistence, reserved-house planting rejection and malformed-command rejection');

  assert.equal(await evaluate(`document.querySelector('[data-owner-forest-reset]').textContent`), 'Return to the center');
  assert.equal(await evaluate(`Boolean(document.querySelector('.home-study-note'))`), false);
  const bootstrap = JSON.parse(await evaluate(`document.querySelector('#owner-forest-bootstrap').textContent`));
  assert.equal(bootstrap.spawn.worldX, 0); assert.equal(bootstrap.spawn.worldY, 0);
  await wait(`document.querySelector('[data-study-edit="home"]').closest('div').hidden`);
  await click('[data-owner-forest-more]'); await evaluate(`(()=>{document.querySelector('.forest-navigation-picker').open=true;const s=document.querySelector('[data-forest-navigation-destination]');s.value='home';s.dispatchEvent(new Event('change'));return true;})()`);
  await click('[data-forest-navigation-go]');
  await wait(`document.querySelector('[data-forest-navigation-copy]').textContent.includes('Home')`);
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
  if ((await read()).cartDesign.supports === 'ridge') {
    await click('[data-study-edit="cart"]');
    assert.equal(await choose('supports', 'bows'), 'bows');
    await click('[data-design-apply]');
    await wait(`document.querySelector('.home-study-editor').hidden`);
  }
  const beforeDrive = await read();
  await click('[data-study-mount]');
  await wait(`document.querySelector('[data-owner-forest-viewport]').dataset.studyMounted==='true'`);
  await click('[data-study-careful]');
  await wait(`document.querySelector('[data-study-careful]').getAttribute('aria-pressed')==='true'`);
  await holdKeys(['w'], 450);
  await click('[data-study-mount]');
  await wait(`document.querySelector('[data-owner-forest-viewport]').dataset.studyMounted==='false'`);
  const parked = await read(); assert.equal(parked.cartId, saved.cartId);
  assert.notDeepEqual(parked.parking, beforeDrive.parking);
  await navigate();
  await wait(`document.querySelector('[data-forest-navigation-destination]')`);
  assert.equal((await read()).homeDesign.color, 'sage');
  assert.deepEqual((await read()).parking, parked.parking);
  console.log('PASS main page: boarding, careful driving, parking and reload through application endpoints');
  await click('[data-owner-forest-more]'); await click('[data-study-recover]');
  await wait(enabled('[data-study-edit="cart"]'));
  const basic = await read();
  await click('[data-study-edit="cart"]');
  assert.equal(await choose('supports', 'ridge'), 'ridge');
  await wait(enabled('[data-design-apply]'));
  await click('[data-design-cancel]');
  assert.deepEqual(await read(), basic);
  await click('[data-study-edit="cart"]');
  assert.equal(await choose('supports', 'ridge'), 'ridge');
  await click('[data-design-apply]');
  await wait(`document.querySelector('.home-study-editor').hidden`);
  assert.equal((await read()).cartDesign.supports, 'ridge');
  await click('[data-study-mount]');
  await wait(`document.querySelector('[data-owner-forest-viewport]').dataset.studyMounted==='true'`);
  // Back out along the yard first. Turning west toward Tansy from the workshop
  // would swing the mule into the house before the cart can drive clear of it.
  await click('[data-study-reverse]');
  await holdKeys(['a'], 1250);
  await click('[data-study-reverse]');
  await guideTo('tansy');
  await followCompass(`(() => {
    const copy = document.querySelector('[data-forest-navigation-copy]').textContent;
    return copy.includes('Nearby') || Number(copy.match(/(\\d+) steps/)?.[1]) <= 110;
  })()`, 170);
  await click('[data-study-mount]');
  await wait(`document.querySelector('[data-owner-forest-viewport]').dataset.studyMounted==='false'`);
  await click('[data-owner-forest-reset]');
  await approachTansy();
  assert.match(await line(), /You fitted the ridge frame/);
  await click('[data-forest-traveler-leave]');
  await navigate();
  assert.equal((await read()).cartDesign.supports, 'ridge');
  await approachTansy();
  assert.match(await line(), /You fitted the ridge frame/);
  console.log('PASS frame preview cancellation, fitting, driving, parking and recognition after reload');

  await send('browsingContext.navigate', {context,url:base+'/en/forest?returnTree='+compatibility.tree.id,wait:'complete'});
  await wait(`document.querySelector('[data-forest-navigation-destination]')`);
  const returned=JSON.parse(await evaluate(`document.querySelector('#owner-forest-bootstrap').textContent`));
  assert.equal(returned.returnDestination.treeId,compatibility.tree.id);
  assert.ok(Math.hypot(returned.returnDestination.spawn.worldX-saved.parking.worldX,returned.returnDestination.spawn.worldY-saved.parking.worldY)>50);
  const gardenAfter=JSON.parse(await evaluate(`fetch('/api/v1/forest/garden').then(r=>r.text())`));
  assert.deepEqual(gardenAfter.plants.map(p=>p.plantId),compatibility.plants.map(p=>p.plantId));
  console.log('PASS real writing-return locator remains active beside homestead loading; garden survives reload');

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
