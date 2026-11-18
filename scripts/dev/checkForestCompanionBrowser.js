/* global WebSocket */
// Real saves and browser interactions, isolated from Robert's persistent preview.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { once } from 'node:events';
import mongoose from 'mongoose';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import User from '../../server/db/models/User.js';
import ForestHomestead from '../../server/db/models/ForestHomestead.js';
import ForestOwnerWorld from '../../server/db/models/ForestOwnerWorld.js';
import ForestTerrainProtection from '../../server/db/models/ForestTerrainProtection.js';
import { createSavedHomesteadPreview, COMPANION_CHECK_OWNER as OWNER } from './forestHomesteadPreview.js';

if (process.env.NODE_ENV === 'production' || ['1', 'true', 'yes', 'on'].includes(String(process.env.USE_PRODUCTION_DB).toLowerCase())) {
  throw new Error('Companion checks require the development database.');
}
await initMongooseConnection({ useProductionDb: false, quiet: true });
async function cleanup() {
  assert.equal(mongoose.connection.name, 'daily-page-test');
  const user = await User.findById(OWNER).lean();
  if (user) assert.equal(user.username, 'forest_companion_browser_check');
  for (const Model of [ForestHomestead, ForestTerrainProtection, ForestOwnerWorld]) await Model.deleteMany({ ownerUserId: OWNER });
  await User.deleteOne({ _id: OWNER, username: 'forest_companion_browser_check' });
}
await cleanup();
const { app, raw } = await createSavedHomesteadPreview({ profile: 'companion-check' });
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const ws = new WebSocket(process.argv[2] || 'ws://127.0.0.1:9235/session');
let id = 0, started = false;
let inspectFailure = async () => {};
const pending = new Map();
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data), call = pending.get(message.id);
  if (!call) return;
  pending.delete(message.id); clearTimeout(call.timer);
  if (message.type === 'error') call.reject(new Error(message.message)); else call.resolve(message.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const key = ++id, timer = setTimeout(() => { pending.delete(key); reject(new Error(`Timed out: ${method}`)); }, 45000);
  pending.set(key, { resolve, reject, timer }); ws.send(JSON.stringify({ id: key, method, params }));
});
try {
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  await send('session.new', { capabilities: {} }); started = true;
  const { context } = await send('browsingContext.create', { type: 'tab' });
  const evaluate = async expression => {
    const result = await send('script.evaluate', { target: { context }, expression, awaitPromise: true });
    assert.equal(result.type, 'success', JSON.stringify(result)); return result.result.value;
  };
  const wait = expression => evaluate(`new Promise((resolve,reject)=>{
    const start=Date.now(), timer=setInterval(()=>{if(${expression}){clearInterval(timer);resolve(true);}
    else if(Date.now()-start>20000){clearInterval(timer);reject(new Error(${JSON.stringify(expression)}));}},50);})`);
  const snapshot = async () => JSON.parse(await evaluate('JSON.stringify(homeCartStudy.snapshot())'));
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click();true`);
  const key = async value => {
    await send('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions: [
      { type: 'keyDown', value }, { type: 'keyUp', value }
    ] }] });
  };
  const reload = async () => {
    await send('browsingContext.navigate', { context, url: `${base}/en/forest`, wait: 'complete' });
    await wait('window.homeCartStudy && homeCartStudy.snapshot().regionReady');
  };
  const available = () => wait('!document.querySelector(".forest-companion-actions").hidden && !document.querySelector("[data-companion-action]").disabled');
  const hold = async (value, duration) => {
    await evaluate(`document.querySelector('[data-owner-forest-viewport]').focus();true`);
    await send('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions: [
      { type: 'keyDown', value }, { type: 'pause', duration }, { type: 'keyUp', value }
    ] }] });
  };
  const capture = async name => {
    await evaluate('document.querySelector("[data-owner-forest-viewport]").scrollIntoView({block:"center"});true');
    const shot = await send('browsingContext.captureScreenshot', { context });
    fs.mkdirSync('/tmp/forest-companion-review', { recursive: true });
    fs.writeFileSync(`/tmp/forest-companion-review/${name}.png`, Buffer.from(shot.data, 'base64'));
  };
  inspectFailure = async () => { console.log('FAILED SCENE', JSON.stringify(await snapshot())); await capture('failure'); };
  await send('browsingContext.setViewport', { context, viewport: { width: 1280, height: 880 }, devicePixelRatio: 1 });
  await reload(); const initial = await snapshot();
  assert.equal(initial.save.record.ownerUserId, OWNER); assert.equal(initial.companion, null);
  await available(); await click('[data-companion-action]');
  await wait('homeCartStudy.snapshot().actor.gesture?.type === "offer"');
  await capture('01-offer-hand');
  await hold('\uE015', 350);
  assert.equal((await snapshot()).actor.gesture, null);
  assert.equal((await snapshot()).companion, null);
  assert.equal((await snapshot()).save.record.revision, initial.save.record.revision);
  assert.equal(await evaluate('document.querySelector("[aria-modal=true]:not([hidden])") === null'), true);
  await click('[data-study-recover]'); await wait('!homeCartStudy.snapshot().save.busy');
  await wait('!document.querySelector("[data-study-mount]").disabled');
  await click('[data-study-mount]'); await wait('homeCartStudy.snapshot().mounted');
  await click('[data-study-mount]'); await wait('!homeCartStudy.snapshot().mounted && !homeCartStudy.snapshot().save.busy');
  console.log('PASS physical offer, movement cancellation without a save, no modal and existing cart access');

  await available(); const beforeMeeting = await snapshot();
  await evaluate(`window.realFetch=window.fetch;window.loseOne=true;window.fetch=async(...args)=>{
    const r=await realFetch(...args);if(loseOne&&String(args[0]).endsWith('/homestead')&&args[1]?.method==='POST'){
    loseOne=false;throw new Error('lost response');}return r;};true`);
  await click('[data-companion-action]'); await wait('homeCartStudy.snapshot().save.status === "unresolved"');
  const atContact = await snapshot();
  assert.ok(Math.hypot(atContact.actor.worldX-beforeMeeting.actor.worldX,atContact.actor.worldY-beforeMeeting.actor.worldY)>8);
  const lost = atContact.save.pending; assert.equal(lost.encounter, 'meet');
  await reload(); const committed = await snapshot();
  assert.equal(committed.companion.stage, 'acquainted');
  assert.equal(committed.save.pending.operationId, lost.operationId);
  await click('[data-save-retry]'); await wait('homeCartStudy.snapshot().save.status === "saved"');
  const retried = await snapshot();
  assert.equal(retried.save.record.revision, committed.save.record.revision);
  assert.equal(retried.save.record.operation.replayed, true);
  for (const property of ['homeId', 'cartId', 'homeDesign', 'cartDesign', 'holdings', 'parking']) {
    assert.deepEqual(retried.save.record[property], beforeMeeting.save.record[property]);
  }
  console.log('PASS actual approach/contact, lost response/reload/exact retry and unchanged construction');

  await available(); await key('e');
  await wait('homeCartStudy.snapshot().actor.gesture?.type === "scratch"');
  await wait('homeCartStudy.snapshot().actor.responding'); await capture('02-scratch');
  await wait('!homeCartStudy.snapshot().actor.gesture');
  const beforeInvite = await snapshot(), saved = beforeInvite.save.record;
  await raw.mutate({ ownerUserId: OWNER, command: { action: 'home', operationId: crypto.randomUUID(),
    forestId: saved.forestId, terrainToken: saved.terrainToken, expectedRevision: saved.revision, design: saved.homeDesign } });
  await click('[data-companion-follow]');
  await wait('homeCartStudy.snapshot().save.status === "conflict" && !homeCartStudy.snapshot().save.busy && !homeCartStudy.snapshot().actor.pending');
  assert.equal((await snapshot()).companion.stage, 'acquainted');
  await available(); await click('[data-companion-follow]');
  await wait('homeCartStudy.snapshot().companion?.stage === "joined" && !homeCartStudy.snapshot().actor.pending');
  const joined = await snapshot(); assert.equal(joined.companion.id, retried.companion.id);
  assert.deepEqual(joined.player, beforeInvite.player, 'Encounter saves must not teleport the player');
  assert.equal(joined.actor.following, true);
  await hold('\uE015', 1200);
  await wait('Math.hypot(homeCartStudy.snapshot().actor.worldX-homeCartStudy.snapshot().player.worldX,homeCartStudy.snapshot().actor.worldY-homeCartStudy.snapshot().player.worldY)<52');
  const followed = await snapshot();
  assert.ok(Math.hypot(followed.actor.worldX-joined.actor.worldX,followed.actor.worldY-joined.actor.worldY)>45);
  await capture('03-follow');
  await available(); await click('[data-companion-follow]');
  const waiting = await snapshot(); await hold('\uE015', 500);
  assert.equal((await snapshot()).actor.following, false);
  assert.equal((await snapshot()).actor.worldY, waiting.actor.worldY);
  await hold('\uE013', 1700);
  await wait('!document.querySelector("[data-study-mount]").disabled');
  await click('[data-study-mount]'); await wait('homeCartStudy.snapshot().mounted');
  await click('[data-study-mount]'); await wait('!homeCartStudy.snapshot().mounted && !homeCartStudy.snapshot().save.busy');
  await reload();
  await wait('homeCartStudy.snapshot().actor.responding');
  assert.deepEqual((await snapshot()).companion, joined.companion);
  console.log('PASS scratching, explicit invitation retry, following, waiting, physical boarding and remembered reunion');

  for (const width of [320, 390]) {
    await send('browsingContext.setViewport', { context, viewport: { width, height: 844 }, devicePixelRatio: 1 });
    await available();
    assert.equal(await evaluate(`(()=>{const p=document.querySelector('.forest-companion-actions'),r=p.getBoundingClientRect(),
      v=document.querySelector('[data-owner-forest-viewport]').getBoundingClientRect();
      return r.left>=v.left&&r.right<=v.right&&r.top>=v.top&&r.bottom<=v.bottom&&p.scrollWidth<=p.clientWidth;})()`), true);
    const point = JSON.parse(await evaluate(`(()=>{const e=document.querySelector('[data-companion-action]');e.scrollIntoView({block:'nearest'});
      const r=e.getBoundingClientRect();return JSON.stringify({x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)});})()`));
    await send('input.performActions', { context, actions: [{ type: 'pointer', id: 'finger', parameters: { pointerType: 'touch' }, actions: [
      { type: 'pointerMove', x: point.x, y: point.y, duration: 0 }, { type: 'pointerDown', button: 0 }, { type: 'pointerUp', button: 0 }
    ] }] });
    await wait('homeCartStudy.snapshot().actor.gesture?.type === "scratch"');
    await wait(`(()=>{const s=homeCartStudy.snapshot(),dock=document.querySelector('[data-owner-forest-dock]').getBoundingClientRect(),
      v=document.querySelector('[data-owner-forest-viewport]').getBoundingClientRect();
      return s.player.worldY-s.camera.y<dock.top-v.top-20&&s.actor.worldY-s.camera.y<dock.top-v.top-8;})()`);
    await capture(`04-touch-${width}`); await key('\uE00C');
  }
  console.log('PASS 320px/390px contextual controls and native emulated touch gesture');
  const preload = await send('script.addPreloadScript', { functionDeclaration: `() => {
    const original=window.matchMedia.bind(window);window.matchMedia=query=>{
      const result=original(query);if(query==='(prefers-reduced-motion: reduce)')Object.defineProperty(result,'matches',{value:true});return result;
    }; }` });
  await reload(); await available(); await click('[data-companion-action]');
  await wait('homeCartStudy.snapshot().actor.responding');
  const reduced = await snapshot();
  assert.equal(reduced.companionMotion.attentive, true);
  assert.equal(reduced.companionMotion.greeting, 0); assert.equal(reduced.companionMotion.walking, false);
  await capture('05-reduced-motion');
  await send('script.removePreloadScript', { script: preload.script });
  console.log('PASS reduced motion retains physical approach, interaction pose and brief caption');

  // The Satchel shows the confirmed balances before and after a cart redesign.
  const checkMaterials = async record => {
    await click('[data-garden-open]');
    const actual = JSON.parse(await evaluate(`(() => {
      const section = document.querySelector('[data-homestead-materials]');
      if (section.hidden) throw new Error('Building materials is missing from the Satchel');
      section.open = true;
      return JSON.stringify(['available-timber', 'available-cloth', 'cart-timber', 'cart-cloth']
        .map(field => Number(section.querySelector('[data-' + field + ']').textContent)));
    })()`));
    assert.deepEqual(actual, [record.holdings.timber, record.holdings.cloth,
      record.cartCommitment.timber, record.cartCommitment.cloth]);
    await click('[data-garden-close]');
  };
  await click('[data-study-recover]');
  await wait('!homeCartStudy.snapshot().save.busy && !document.querySelector("[data-study-edit=cart]").disabled');
  const previous = (await snapshot()).save.record;
  await checkMaterials(previous);
  const canopy = previous.cartDesign.canopy === 'none' ? 'linen' : 'none';
  await click('[data-study-edit=cart]');
  await evaluate(`(() => {
    const field = document.querySelector('[data-design-field="canopy"]');
    field.value = ${JSON.stringify(canopy)};
    field.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await click('[data-design-apply]');
  await wait('!homeCartStudy.snapshot().editor');
  const rebuilt = (await snapshot()).save.record;
  assert.equal(rebuilt.cartDesign.canopy, canopy);
  assert.notEqual(rebuilt.cartCommitment.cloth, previous.cartCommitment.cloth);
  await checkMaterials(rebuilt);
  await reload();
  await checkMaterials(rebuilt);
  console.log('PASS Satchel balances update after redesign and persist across reload');
} catch (error) { await inspectFailure(); throw error; } finally {
  if (started) await send('session.end'); ws.close();
  await new Promise(resolve => server.close(resolve)); await cleanup(); await mongoose.disconnect();
}
