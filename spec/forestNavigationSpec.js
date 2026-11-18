import { JSDOM } from 'jsdom';
import { createForestNavigationState, createForestNavigation } from '../public/js/forest-navigation.js';
const player = { worldX: 0, worldY: 0 };
describe('shared forest destination authority', () => {
  it('selects exactly one destination and uses the latest moving target position', () => {
    const nav = createForestNavigationState();
    let cart = { id: 'cart', label: 'Cart', worldX: 200, worldY: 0 };
    nav.register('home', () => [{ id: 'home', label: 'Home', worldX: 0, worldY: -300 }]);
    nav.register('cart', () => [cart]);
    expect(nav.select('home')).toBeTrue(); expect(nav.snapshot(player).degrees).toBe(0);
    nav.select('cart'); expect(nav.snapshot(player).distance).toBe(200);
    cart = { ...cart, worldX: 0, worldY: 400 };
    expect(nav.snapshot(player).active).toBe('cart'); expect(nav.snapshot(player).distance).toBe(400);
    expect(nav.snapshot(player).degrees).toBe(180);
    nav.stop(); expect(nav.snapshot(player).active).toBeNull();
  });
  it('updates a moved plant and stops guidance when its stable identity disappears', () => {
    const nav = createForestNavigationState();
    let plants = [{ id: 'plant:one', label: 'Lanternbell 1', worldX: 200, worldY: 0 }];
    nav.register('garden', () => plants); nav.select('plant:one');
    plants = [{ ...plants[0], worldX: 30 }]; expect(nav.snapshot(player).nearby).toBeTrue();
    plants = []; expect(nav.snapshot(player)).toEqual({ active: null, removed: true });
    plants = [{ id: 'plant:two', label: 'Lanternbell 1', worldX: 200, worldY: 0 }];
    expect(nav.snapshot(player).active).toBeNull();
    expect(nav.select('plant:one')).toBeFalse();
  });
  it('keeps navigation visit-local and refuses destinations without a valid position', () => {
    const nav = createForestNavigationState(); nav.register('invalid', () => [{ id: 'bad', label: 'Bad', worldX: NaN, worldY: 0 }]);
    expect(nav.destinations()).toEqual([]); expect(nav.select('bad')).toBeFalse();
    expect(createForestNavigationState().snapshot(player).active).toBeNull();
  });
});
describe('shared forest navigation controls', () => {
  let dom, previous, nav, available, focus;
  beforeEach(() => {
    dom = new JSDOM('<div id="dock"><section id="more"></section></div>');
    previous = ['window', 'document'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
    globalThis.window = dom.window; globalThis.document = dom.window.document;
    available = true; focus = jasmine.createSpy('focus');
    nav = createForestNavigation({ dock: document.querySelector('#dock'), more: document.querySelector('#more'),
      state: () => ({ player, available }), focus });
    nav.register('targets', () => [{ id: 'home', label: 'Home', worldX: 300, worldY: 0 },
      { id: 'cart', label: 'Parked cart', worldX: 0, worldY: -200 }]);
    nav.update(0, true);
  });
  afterEach(() => { previous.forEach(([k, descriptor]) => {
    if (descriptor) Object.defineProperty(globalThis, k, descriptor); else delete globalThis[k];
  }); dom.window.close(); });
  const el = name => document.querySelector(`[data-forest-navigation-${name}]`);
  it('uses the same compass for picker and contextual destination selection, with one Stop action', () => {
    const select = el('destination'); select.value = 'home'; select.dispatchEvent(new window.Event('change'));
    el('go').click(); expect(el('copy').textContent).toBe('Home · 300 steps');
    nav.navigate('cart'); expect(select.value).toBe('cart'); expect(el('copy').textContent).toBe('Parked cart · 200 steps');
    expect(document.querySelectorAll('[data-forest-navigation]').length).toBe(1);
    el('stop').click(); expect(document.querySelector('[data-forest-navigation]').hidden).toBeTrue();
    expect(focus).toHaveBeenCalled();
  });
  it('temporarily hides guidance during another interaction without clearing the selection', () => {
    nav.navigate('home'); available = false; nav.update(0, true);
    expect(document.querySelector('[data-forest-navigation]').hidden).toBeTrue();
    available = true; nav.update(0, true);
    expect(document.querySelector('[data-forest-navigation]').hidden).toBeFalse();
    expect(el('copy').textContent).toContain('Home');
  });
  it('keeps a pending picker choice when target positions update', () => {
    el('destination').value = 'cart'; nav.update(200);
    expect(el('destination').value).toBe('cart');
    nav.register('targets', () => []); nav.update(400);
    expect(el('destination').value).toBe(''); expect(el('go').disabled).toBeTrue();
  });
});
