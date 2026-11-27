import { JSDOM } from 'jsdom';
import { createForestOrchardScene } from '../public/js/forest-orchard-scene.js';
import { orchardRoad } from '../public/js/forest-orchard.js';
import { preservingHearth, quincePickingDay, walledOrchardSite } from '../public/js/forest-orchard-outing.js';
import { QUINCE_JAM, TANSY_OFFER, WOVEN_TRIM } from '../public/js/forest-village-goods.js';

const layout = { home: { x: 400, y: 0 }, route: [{ x: 400, y: 90 }, { x: 1600, y: 90 }, { x: 1600, y: 990 }] };
const site = { forkDistance: 840, branchDistances: [490, 490],
  plots: [{ x: 525, y: -54 }, { x: 275, y: -54 }] };
const road = orchardRoad(layout, site), wall = walledOrchardSite(layout, site, 580);

describe('Orchard tree interactions', () => {
  let dom, previous, player, record, scene, save, say, action;

  beforeEach(() => {
    dom = new JSDOM('<div data-owner-forest-viewport><div id="dock"></div></div><section data-forest-garden hidden><button data-garden-close></button><p data-orchard-satchel></p></section>');
    previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
    globalThis.document = dom.window.document;
    record = { forestId: '11111111-1111-4111-8111-111111111111', orchard: { site,
      stages: ['undiscovered', 'undiscovered'], outing: { provisionerSide: -1, spurLength: 580 } } };
    say = jasmine.createSpy('say');
    save = jasmine.createSpy('save').and.callFake(async (_action, { branch }) => {
      const stages = [...record.orchard.stages];
      stages[branch] = 'seed';
      record = { ...record, orchard: { ...record.orchard, stages } };
      return true;
    });
    scene = createForestOrchardScene({ api: { amberClearingEnabled: true, regionLoaded: () => true,
      state: () => ({ player }), focus() {} }, dock: document.getElementById('dock'), layout, read: () => record,
    canAct: () => true, canEat: () => true, blocked: () => false, save, say });
    action = document.querySelector('[data-orchard-action]');
  });

  afterEach(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous); else delete globalThis.document;
    dom.window.close();
  });

  function approach(point) {
    player = { worldX: point.x + 28, worldY: point.y };
    scene.update(player);
  }

  it('makes the old quince a clue and keeps the walled tree interactive after seed collection', async () => {
    approach(road.branches[1].tree);
    expect(action.textContent).toMatch(/^Collect the .*damson seed$/);
    approach(road.branches[0].tree);
    expect(action.textContent).toBe('Look at the old quince');
    action.click();
    expect(say).toHaveBeenCalledWith(jasmine.stringContaining('track beyond the cairn'));
    expect(save).not.toHaveBeenCalled();

    approach(wall.tree);
    expect(action.textContent).toMatch(/^Collect the .*quince seed$/);
    action.click();
    await Promise.resolve();
    expect(save).toHaveBeenCalledOnceWith('orchard-collect', { branch: 0 });
    scene.update(player);
    expect(action.textContent).toBe('Look at the walled quince');
    action.click();
    expect(say).toHaveBeenCalledWith(jasmine.stringContaining('seed is in your Satchel'));
    expect(save.calls.count()).toBe(1);
  });

  it('lets players check their own tree after harvest and points them toward the workshop', () => {
    record.orchard.stages = ['harvested', 'undiscovered'];
    approach(site.plots[0]);
    expect(action.textContent).toMatch(/^Check your .*quince tree$/);
    action.click();
    expect(say).toHaveBeenCalledWith(jasmine.stringContaining('cloth cover at the workshop'));
    expect(save).not.toHaveBeenCalled();
    expect(scene.progress()).toEqual(jasmine.objectContaining({ stage: 'harvested', destination: 'home' }));
  });

  it('keeps both seeds collectible on the original route and guides to each planting spot', async () => {
    delete record.orchard.outing;
    approach(road.branches[0].tree);
    expect(action.textContent).toMatch(/^Collect the .*quince seed$/);
    action.click();
    await Promise.resolve();
    approach(road.branches[1].tree);
    expect(action.textContent).toMatch(/^Collect the .*damson seed$/);
    action.click();
    await Promise.resolve();
    scene.update(player);
    expect(action.textContent).toMatch(/^Look at the wild .*damson$/);
    const plots = scene.destinations(false).filter(destination => destination.id.startsWith('orchard-plot-'));
    expect(plots.map(({ id, label }) => [id, label])).toEqual([
      ['orchard-plot-0', jasmine.stringMatching(/^Plant .*quince$/)],
      ['orchard-plot-1', jasmine.stringMatching(/^Plant .*damson$/)]
    ]);
    expect(scene.progress()).toEqual(jasmine.objectContaining({ stage: 'seed', destination: 'orchard-plot-0' }));
  });

  it('shows the hearth before the orchard is mapped, and offers a choice when a quince is carried', async () => {
    const orchard = record.orchard, hearth = preservingHearth(layout, -1);
    const button = document.querySelector('[data-village-action]');
    const keep = document.querySelector('[data-keep-quince]');
    const satchel = document.querySelector('[data-orchard-satchel]');
    const bench = { x: hearth.walk.at(-1).x - 28, y: hearth.walk.at(-1).y };
    record = { forestId: record.forestId, provisionerSide: -1, preservingHearthAvailable: true };
    save.and.callFake(async () => true);
    approach(bench);
    expect(button.hidden).toBeFalse();
    expect(button.textContent).toBe('Set out a clean jar');
    button.click();
    await Promise.resolve();
    expect(save).toHaveBeenCalledOnceWith('village-set-jar', { provisionerSide: -1 });
    expect(say).toHaveBeenCalledWith(jasmine.stringContaining('ready by the pot'));
    record = { ...record, orchard, village: { cleanJar: true } };
    approach(wall.tree);
    expect(button.textContent).toBe('Pick a quince');
    expect(action.textContent).toMatch(/^Collect the .*quince seed$/);
    button.click();
    await Promise.resolve();
    expect(save.calls.mostRecent().args).toEqual(['village-pick-quince', { provisionerSide: -1 }]);
    record = { ...record, village: { cleanJar: true, carryingQuince: true, pickedDay: quincePickingDay() } };
    approach(bench);
    expect(satchel.textContent).toContain('1 quince');
    expect(button.textContent).toBe('Make quince jam');
    expect(keep.hidden).toBeFalse();
    keep.click();
    expect(button.hidden).toBeTrue();
    expect(save.calls.count()).toBe(2);
    approach(wall.tree);
    expect(button.hidden).toBeTrue();
    approach(bench);
    button.click();
    await Promise.resolve();
    expect(save.calls.mostRecent().args).toEqual(['village-make-preserves', { provisionerSide: -1 }]);
    record = { ...record, village: { cleanJar: false, carryingQuince: false, batches: 1, pickedDay: quincePickingDay() } };
    approach(wall.tree);
    expect(button.hidden).toBeTrue();
    expect(satchel.textContent).not.toContain('1 quince');
  });

  it('shows where the remaining jar is after Tansy’s one trade and lets the player display it', async () => {
    const approachPoint = preservingHearth(layout, -1).walk.at(-1);
    record = { ...record, preservingHearthAvailable: true, village: { standArrangement: 'barter-mat',
      acceptedOffers: [TANSY_OFFER.id], goods: { satchel: { [QUINCE_JAM]: 1 }, 'cart-trim': { [WOVEN_TRIM]: 1 } } } };
    const put = document.querySelector('[data-display-jar]'), take = document.querySelector('[data-pack-item]');
    const trade = document.querySelector('[data-barter-jar]'), display = document.querySelector('[data-display-item]');
    save.and.callFake(async (_action, { item, from, to }) => {
      const goods = { ...record.village.goods, [to]: { [item]: 1 } };
      delete goods[from];
      record = { ...record, village: { ...record.village, goods } };
      return true;
    });
    approach({ x: approachPoint.x - 28, y: approachPoint.y });
    document.querySelector('[aria-controls="forest-village-stand"]').click();
    expect(display.textContent).toBe('The barter mat is empty. 1 jar in your Satchel.');
    expect(document.querySelector('[data-customer]').textContent).toContain('Anything you display here stays yours.');
    expect(trade.hidden).toBeTrue();
    expect(put.textContent).toBe('Display quince jam');
    put.click();
    await Promise.resolve();
    expect(save).toHaveBeenCalledOnceWith('village-move-item', { provisionerSide: -1, item: QUINCE_JAM, from: 'satchel', to: 'stand' });
    expect(display.textContent).toBe('Quince jam on the barter mat. 0 jars in your Satchel.');
    expect(trade.hidden).toBeTrue();
    take.click();
    await Promise.resolve();
    expect(display.textContent).toBe('The barter mat is empty. 1 jar in your Satchel.');
  });
});
