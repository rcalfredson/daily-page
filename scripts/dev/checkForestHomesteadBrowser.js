/* global WebSocket */
// Run only against the loopback saved preview (reserved daily-page-test identity).
import assert from 'node:assert/strict';
const ws = new WebSocket(process.argv[2] || 'ws://127.0.0.1:9228/session');
let id = 0;
const calls = new Map();
ws.onmessage = ({ data }) => {
  const m = JSON.parse(data), call = calls.get(m.id);
  if (!call) return;
  calls.delete(m.id); clearTimeout(call.timer);
  if (m.type === 'error') call.reject(new Error(m.message)); else call.resolve(m.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const key = ++id, timer = setTimeout(() => reject(new Error(`Timed out: ${method}`)), 45000);
  calls.set(key, { resolve, reject, timer }); ws.send(JSON.stringify({ id: key, method, params }));
});
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
await send('session.new', { capabilities: {} });
try {
  const { context } = await send('browsingContext.create', { type: 'tab' });
  const evaluate = async expression => {
    const result = await send('script.evaluate', { target: { context }, expression, awaitPromise: true });
    assert.equal(result.type, 'success', JSON.stringify(result)); return result.result.value;
  };
  const wait = expression => evaluate(`new Promise((resolve,reject)=>{
    const start=Date.now(), timer=setInterval(()=>{if(${expression}){clearInterval(timer);resolve(true);}
    else if(Date.now()-start>20000){clearInterval(timer);reject(new Error(${JSON.stringify(expression)}));}},50);})`);
  const snapshot = async () => JSON.parse(await evaluate('JSON.stringify(homeCartStudy.snapshot())'));
  const click = s => evaluate(`document.querySelector(${JSON.stringify(s)}).click();true`);
  const choose = (name, value) => evaluate(`(()=>{const e=document.querySelector('[data-design-field="${name}"]');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
  const reload = async () => {
    await send('browsingContext.navigate', { context, url: 'http://127.0.0.1:4184/en/forest', wait: 'complete' });
    await wait('window.homeCartStudy && homeCartStudy.snapshot().regionReady');
  };
  await send('browsingContext.setViewport', { context, viewport: { width: 1280, height: 880 }, devicePixelRatio: 1 });
  await reload();
  assert.equal((await snapshot()).save.record.ownerUserId, '64b00000000000000000a095');
  await click('[data-study-recover]'); await wait('homeCartStudy.snapshot().save.status === "saved" && !homeCartStudy.snapshot().save.busy');
  await wait('!document.querySelector("[data-study-edit=home]").disabled');
  const before = (await snapshot()).save.record;
  const color = before.homeDesign.color === 'sage' ? 'clay' : 'sage';
  await click('[data-study-edit=home]'); await choose('color', color); await click('[data-design-apply]');
  await wait('!homeCartStudy.snapshot().editor');
  assert.equal((await snapshot()).homeDesign.color, color);
  await reload(); assert.equal((await snapshot()).homeDesign.color, color);
  assert.equal((await snapshot()).save.record.homeId, before.homeId);
  console.log('PASS actual workshop save, reload and stable home identity');

  // Commit a request but lose its response, then reload with the pending operation in session storage.
  await evaluate(`window.testFetch=window.fetch;window.loseOne=true;window.fetch=async(...args)=>{const r=await testFetch(...args);
    if(loseOne&&String(args[0]).endsWith('/homestead')&&args[1]?.method==='POST'){loseOne=false;throw new Error('lost response');}return r;};true`);
  await click('[data-study-edit=cart]'); await choose('canopy', 'linen'); await click('[data-design-apply]');
  await wait('homeCartStudy.snapshot().save.status === "unresolved"');
  const lost = (await snapshot()).save.pending;
  assert.ok(lost.operationId); assert.ok((await snapshot()).editor);
  await reload(); assert.equal((await snapshot()).save.pending.operationId, lost.operationId);
  const afterCommit = (await snapshot()).save.record;
  await click('[data-save-retry]'); await wait('homeCartStudy.snapshot().save.status === "saved"');
  const retried = (await snapshot()).save.record;
  assert.equal(retried.revision, afterCommit.revision); assert.deepEqual(retried.holdings, afterCommit.holdings);
  assert.equal(retried.operation.replayed, true);
  console.log('PASS lost committed response, retained draft, reload and duplicate-safe retry');

  // A second tab commits after this tab loaded; stale editor must preserve its draft.
  const second = await send('browsingContext.create', { type: 'tab' });
  await send('browsingContext.navigate', { context: second.context, url: 'http://127.0.0.1:4184/en/forest', wait: 'complete' });
  const secondResult = await send('script.evaluate', { target: { context: second.context }, awaitPromise: true,
    expression: `(async()=>{const s=await (await fetch('/api/v1/forest/homestead')).json();return (await fetch('/api/v1/forest/homestead',
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'home',operationId:crypto.randomUUID(),
    forestId:s.forestId,terrainToken:s.terrainToken,expectedRevision:s.revision,design:{...s.homeDesign,color:'cream'}})})).status;})()` });
  assert.equal(secondResult.result.value, 200);
  await send('browsingContext.close', { context: second.context });
  await click('[data-study-edit=home]'); await choose('color', 'honey'); await click('[data-design-apply]');
  await wait('homeCartStudy.snapshot().save.status === "conflict" && !homeCartStudy.snapshot().save.busy');
  assert.equal((await snapshot()).editor.draft.color, 'honey');
  assert.equal((await snapshot()).homeDesign.color, 'cream');
  await click('[data-design-apply]'); await wait('!homeCartStudy.snapshot().editor');
  assert.equal((await snapshot()).homeDesign.color, 'honey');
  console.log('PASS competing tab conflict, authoritative refresh, retained draft and explicit resave');

  await wait('!document.querySelector("[data-study-mount]").disabled');
  await click('[data-study-mount]'); await wait('homeCartStudy.snapshot().mounted');
  const oldParking = (await snapshot()).save.record.parking;
  await evaluate(`new Promise(resolve=>{const v=document.querySelector('[data-owner-forest-viewport]');v.focus();
    v.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));setTimeout(()=>{
    v.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowRight',bubbles:true}));resolve(true);},1800);})`);
  assert.deepEqual((await snapshot()).save.record.parking, oldParking);
  await click('[data-study-mount]'); await wait('!homeCartStudy.snapshot().mounted && homeCartStudy.snapshot().save.status === "saved"');
  const parked = (await snapshot()).save.record;
  assert.ok(Math.hypot(parked.parking.worldX - oldParking.worldX, parked.parking.worldY - oldParking.worldY) > 30);
  await reload(); assert.deepEqual((await snapshot()).save.record.parking, parked.parking);
  assert.equal((await snapshot()).mounted, false);
  await click('[data-study-recover]'); await wait(`homeCartStudy.snapshot().save.record.revision > ${parked.revision}`);
  const recovered = (await snapshot()).save.record;
  assert.deepEqual(recovered.holdings, parked.holdings); assert.deepEqual(recovered.cartDesign, parked.cartDesign);
  assert.equal(recovered.parking.worldX, recovered.layout.parking.x);
  console.log('PASS driving keeps confirmed parking, step-out saves, reload arrives safely, recovery preserves design/materials');
} finally { await send('session.end'); ws.close(); }
