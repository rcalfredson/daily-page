import { JSDOM } from 'jsdom';
import { performance } from 'node:perf_hooks';
import { setImmediate } from 'node:timers/promises';
import { createOwnerForestGarden } from '../public/js/owner-forest-garden.js';

const PLANT = '22222222-2222-4222-8222-222222222222';
const NOW = '2026-11-09T12:00:00Z';
const camera = { x: -200, y: -200, width: 400, height: 400 };
let restore;
let dom;
async function garden({ stage = 'rooted', cuttings = 1, ready = false, placements = [],
  player = { worldX: 0, worldY: 0 }, plantPosition = { worldX: 0, worldY: 40 } } = {}) {
  const fields = ['open', 'toolbar', 'close', 'status', 'count', 'plants', 'plant', 'acquire',
    'start', 'save', 'cancel', 'refresh', 'preview', 'guide', 'near', 'harvest', 'move', 'lift',
    'navigation', 'navigation-copy', 'navigation-arrow', 'navigation-stop',
    'confirm', 'confirm-lift', 'keep', 'notice', 'near-copy', 'near-actions', 'action-help', 'lift-copy'];
  dom = new JSDOM(`<div data-owner-forest-viewport tabindex="0"><section data-forest-garden hidden></section>
    <canvas data-garden-cutting></canvas>${fields.map(f => `<button type="button" data-garden-${f}></button>`).join('')}</div>`);
  const names = ['window', 'document', 'fetch'];
  const previous = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  restore = () => previous.forEach(([name, descriptor]) => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  dom.window.matchMedia = () => ({ matches: true });
  const ctx = { save() {}, restore() {}, translate() {}, scale() {}, fillRect() {} };
  dom.window.HTMLCanvasElement.prototype.getContext = () => ctx;
  let stored = { version: 1, acquired: true, revision: 1, cuttings, serverNow: NOW,
    plants: [{ plantId: PLANT, ...plantPosition, plantedAt: NOW,
      readyAt: NOW, stage, ready }] };
  const commands = [];
  globalThis.fetch = async (path, options) => {
    if (options?.method === 'POST') {
      const command = JSON.parse(options.body); commands.push(command);
      stored = { ...stored, revision: stored.revision + 1, cuttings: stored.cuttings + 1,
        plants: command.action === 'lift' ? [] : stored.plants.map(p => ({ ...p, ready: false })) };
    }
    return { ok: true, json: async () => globalThis.structuredClone(stored) };
  };
  const terrain = { ready: () => true, sample: jasmine.createSpy('sample').and.returnValue({ placeable: true }) };
  const controller = createOwnerForestGarden({ terrainToken: null, terrain,
    requestRender() {}, focusViewport() {}, state: () => ({ player,
      placements, markers: [], facingRadians: Math.PI / 2, available: true }) });
  await setImmediate();
  controller.update(performance.now(), true);
  const find = name => document.querySelector(`[data-garden-${name}]`);
  return { controller, find, terrain, commands,
    preview: () => controller.depthItems(camera).find(item => item.id === '~garden-preview')?.plant,
    carrying: () => controller.depthItems(camera).some(item => item.id === '~carried-cutting') };
}
describe('owner garden move preview and stored cuttings', () => {
  afterEach(() => { restore?.(); restore = null; dom?.window.close(); dom = null; });
  for (const stage of ['rooted', 'sprout', 'flowering']) {
    it(`previews the actual ${stage} plant when moving`, async () => {
      const g = await garden({ stage, ready: false });
      g.find('move').click();
      expect(g.preview().stage).toBe(stage);
      expect(g.preview().ready).toBeFalse();
      expect(g.preview().preserveAppearance).toBeTrue();
      expect(g.carrying()).toBeFalse();
      expect(g.terrain.sample).toHaveBeenCalledWith(jasmine.objectContaining({ radius: 17 }));
    });
  }
  it('keeps mature clearance for an immature move preview', async () => {
    const g = await garden({ placements: [{ worldX: 0, worldY: 65, collisionRadius: 13 }] });
    g.find('move').click();
    expect(g.preview().stage).toBe('rooted');
    expect(g.preview().valid).toBeFalse();
  });
  it('loads stored cuttings without putting one in hand; planting equips and cancelling stows it', async () => {
    const g = await garden();
    expect(g.carrying()).toBeFalse();
    g.find('plant').click();
    expect(g.carrying()).toBeTrue();
    g.find('cancel').click();
    expect(g.carrying()).toBeFalse();
    expect(g.find('count').textContent).toContain('1 / 8');
    expect(g.commands).toEqual([]);
  });
  it('fresh harvest equips a cutting, while packing a plant stores the resulting cutting', async () => {
    const g = await garden({ stage: 'flowering', ready: true, cuttings: 0 });
    g.find('harvest').click(); await setImmediate();
    expect(g.carrying()).toBeTrue();
    g.find('lift').click(); g.find('confirm-lift').click(); await setImmediate();
    expect(g.carrying()).toBeFalse();
    expect(g.find('count').textContent).toContain('2 / 8');
    g.find('refresh').click(); await setImmediate();
    expect(g.carrying()).toBeFalse();
  });
  it('opening the satchel stows a held cutting and hides the underlying satchel action', async () => {
    const g = await garden({ stage: 'flowering', ready: true, cuttings: 0 });
    g.find('harvest').click(); await setImmediate();
    expect(g.carrying()).toBeTrue();
    g.find('open').click();
    expect(g.carrying()).toBeFalse();
    expect(g.find('open').hidden).toBeTrue();
    expect(g.find('plant').hidden).toBeTrue();
    g.find('close').click();
    expect(g.find('open').hidden).toBeFalse();
    expect(g.carrying()).toBeFalse();
  });
  it('Escape puts a freshly collected cutting away without spending it', async () => {
    const g = await garden({ stage: 'flowering', ready: true, cuttings: 0 });
    g.find('harvest').click(); await setImmediate();
    const viewport = document.querySelector('[data-owner-forest-viewport]');
    viewport.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(g.carrying()).toBeFalse();
    expect(g.find('count').textContent).toContain('1 / 8');
    expect(g.commands.length).toBe(1);
  });
  it('expires collection feedback while keeping the result in the satchel', async () => {
    const g = await garden({ stage: 'flowering', ready: true, cuttings: 0 });
    g.find('harvest').click(); await setImmediate();
    expect(g.find('notice').hidden).toBeFalse();
    g.controller.update(performance.now() + 5000, true);
    expect(g.find('notice').hidden).toBeTrue();
    expect(g.find('status').textContent).toBe('Cutting collected · +1');
    expect(g.find('count').textContent).toContain('1 / 8');
    expect(g.find('plant').hidden).toBeFalse();
  });
  it('keeps failure feedback until a successful refresh resolves it', async () => {
    const g = await garden();
    const workingFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('Unavailable'); };
    g.find('refresh').click(); await setImmediate();
    g.controller.update(performance.now() + 5000, true);
    expect(g.find('notice').hidden).toBeFalse();
    expect(g.find('notice').textContent).toContain('Garden unavailable');
    globalThis.fetch = workingFetch;
    g.find('refresh').click(); await setImmediate();
    expect(g.find('notice').hidden).toBeTrue();
    expect(g.find('notice').textContent).toBe('');
  });
  it('guides outside the satchel, updates bearing and distance, and clears on arrival', async () => {
    const player = { worldX: 0, worldY: 0 };
    const g = await garden({ player, plantPosition: { worldX: 200, worldY: 0 } });
    g.find('open').click();
    g.find('plants').querySelector('button').click();
    expect(document.querySelector('[data-forest-garden]').hidden).toBeTrue();
    expect(g.find('navigation').hidden).toBeFalse();
    expect(g.find('navigation-copy').textContent).toBe('Lanternbell 1 · 200 steps east');
    expect(g.find('navigation-arrow').style.transform).toBe('rotate(90deg)');
    player.worldX = 100; player.worldY = 100;
    g.controller.update(performance.now(), true);
    expect(g.find('navigation-copy').textContent).toBe('Lanternbell 1 · 141 steps northeast');
    expect(g.find('navigation-arrow').style.transform).toBe('rotate(45deg)');
    player.worldX = 160; player.worldY = 0;
    g.controller.update(performance.now(), true);
    expect(g.find('navigation').hidden).toBeTrue();
    expect(g.find('near').hidden).toBeFalse();
    expect(g.find('notice').textContent).toBe('Lanternbell 1 reached.');
    player.worldX = 0;
    g.controller.update(performance.now(), true);
    expect(g.find('navigation').hidden).toBeTrue();
    expect(g.commands).toEqual([]);
  });
  it('pauses the guide behind the satchel and allows dismissing it without changing the garden', async () => {
    const g = await garden({ plantPosition: { worldX: 200, worldY: 0 } });
    g.find('plants').querySelector('button').click();
    expect(g.find('navigation').hidden).toBeFalse();
    g.find('open').click();
    expect(g.find('navigation').hidden).toBeTrue();
    g.find('close').click();
    expect(g.find('navigation').hidden).toBeFalse();
    g.find('navigation-stop').click();
    expect(g.find('navigation').hidden).toBeTrue();
    g.find('open').click(); g.find('close').click();
    expect(g.find('navigation').hidden).toBeTrue();
    expect(g.commands).toEqual([]);
  });

  for (const lateResult of ['success', 'failure']) {
    it(`keeps controls responsive during polling and ignores a late read ${lateResult} after a command`, async () => {
      const g = await garden({ stage: 'flowering', ready: true, cuttings: 0 });
      const workingFetch = globalThis.fetch;
      const snapshot = await (await workingFetch()).json();
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      let finishRead;
      globalThis.fetch = (path, options) => options?.method === 'POST' ? workingFetch(path, options)
        : new Promise((resolve, reject) => {
          finishRead = () => lateResult === 'success'
            ? resolve({ ok: true, json: async () => snapshot }) : reject(new Error('Late read failure'));
        });
      g.controller.update(performance.now() + 21000, true);
      expect(g.find('refresh').disabled).toBeTrue();
      expect(g.find('harvest').disabled).toBeFalse();
      expect(g.find('move').disabled).toBeFalse();
      g.find('harvest').click();
      expect(g.find('harvest').disabled).toBeTrue();
      await setImmediate();
      expect(g.carrying()).toBeTrue();
      expect(g.find('count').textContent).toContain('1 / 8');
      finishRead(); await setImmediate();
      expect(g.carrying()).toBeTrue();
      expect(g.find('count').textContent).toContain('1 / 8');
      expect(g.find('status').textContent).toBe('Cutting collected · +1');
      expect(g.find('refresh').disabled).toBeFalse();
      expect(g.find('plant').disabled).toBeFalse();
      expect(g.commands.length).toBe(1);
    });
  }

});
