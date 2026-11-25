import { JSDOM } from 'jsdom';
import { createForestOrchardScene } from '../public/js/forest-orchard-scene.js';
import { orchardRoad } from '../public/js/forest-orchard.js';
import { walledOrchardSite } from '../public/js/forest-orchard-outing.js';

const layout = { home: { x: 400, y: 0 }, route: [{ x: 400, y: 90 }, { x: 1600, y: 90 }, { x: 1600, y: 990 }] };
const site = { forkDistance: 840, branchDistances: [490, 490],
  plots: [{ x: 525, y: -54 }, { x: 275, y: -54 }] };
const road = orchardRoad(layout, site), wall = walledOrchardSite(layout, site, 580);

describe('Orchard tree interactions', () => {
  let dom, previous, player, record, scene, save, say, action;

  beforeEach(() => {
    dom = new JSDOM('<div data-owner-forest-viewport><div id="dock"></div></div><p data-orchard-satchel></p>');
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
    canAct: () => true, blocked: () => false, save, say });
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
});
