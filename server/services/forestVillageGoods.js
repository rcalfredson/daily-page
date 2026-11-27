import { CART_WORKSHOP_RADIUS, GOODS_LOCATIONS, QUINCE_JAM, STAND_ARRANGEMENTS, TANSY_OFFER, VILLAGE_ITEMS, WOVEN_TRIM,
  itemCount, locationAccepts, offerAvailable } from '../../public/js/forest-village-goods.js';

export const GOODS_ARGUMENTS = {
  'village-arrange': ['arrangement'],
  'village-move-item': ['item', 'from', 'to'],
  'village-eat': ['item'],
  'village-barter': ['offer']
};
const object = value => value && typeof value === 'object' && !Array.isArray(value);

export function villageGoodsView(village) {
  if (!village || village.version === 2) return village;
  return { ...village, version: 2, goods: village.batches ? { 'stall-shelf': { [QUINCE_JAM]: 1 } } : {},
    standArrangement: 'shelf', acceptedOffers: [], effects: {} };
}

export function validVillageGoods({ goods, standArrangement, acceptedOffers, effects, batches }) {
  if (!STAND_ARRANGEMENTS.includes(standArrangement) || !Array.isArray(acceptedOffers)
    || acceptedOffers.length > 1 || [...acceptedOffers].some(id => id !== TANSY_OFFER.id)
    || !object(goods) || !object(effects)) return false;
  if (!Object.entries(effects).every(([id, expires]) => id === 'quick-step' && Number.isSafeInteger(expires) && expires > 0)) return false;
  let jars = 0, trims = 0;
  for (const [location, stack] of Object.entries(goods)) {
    if (!Object.hasOwn(GOODS_LOCATIONS, location) || !object(stack) || !Object.keys(stack).length) return false;
    let size = 0;
    for (const [item, count] of Object.entries(stack)) {
      if (!locationAccepts(location, item) || !Number.isSafeInteger(count) || count < 1) return false;
      size += count;
      if (item === QUINCE_JAM) jars += count;
      if (item === WOVEN_TRIM) trims += count;
    }
    if (size > (GOODS_LOCATIONS[location].capacity ?? Number.MAX_SAFE_INTEGER)) return false;
  }
  return jars <= batches && trims === acceptedOffers.length;
}

export function validGoodsCommand({ action, arrangement, item, from, to, offer }) {
  switch (action) {
    case 'village-arrange': return STAND_ARRANGEMENTS.includes(arrangement);
    case 'village-move-item': return from !== to && to !== 'stall-shelf' && (from === 'satchel' || to === 'satchel')
      && locationAccepts(from, item) && locationAccepts(to, item);
    case 'village-eat': return typeof item === 'string' && Object.hasOwn(VILLAGE_ITEMS, item) && Boolean(VILLAGE_ITEMS[item].food);
    case 'village-barter': return offer === TANSY_OFFER.id;
    default: return false;
  }
}

function moveOne(village, item, from, to, changed) {
  if (from && !itemCount(village, from, item)) changed();
  if (to) {
    const stack = village.goods[to] ??= {};
    const size = Object.values(stack).reduce((sum, count) => sum + count, 0);
    if (size >= (GOODS_LOCATIONS[to].capacity ?? Number.MAX_SAFE_INTEGER)) changed();
    stack[item] = (stack[item] ?? 0) + 1;
  }
  if (from) {
    const stack = village.goods[from];
    if (--stack[item] === 0) delete stack[item];
    if (!Object.keys(stack).length) delete village.goods[from];
  }
}

export function addPreserves(village, changed) {
  moveOne(village, QUINCE_JAM, null, 'satchel', changed);
}

export function applyVillageGoodsCommand(record, { action, arrangement, item, from, to }, time, changed) {
  const { village, parking, layout } = record;
  switch (action) {
    case 'village-arrange':
      if (village.standArrangement === arrangement) changed();
      village.standArrangement = arrangement;
      break;
    case 'village-move-item':
      if ((from === 'cart-trim' || to === 'cart-trim')
        && Math.hypot(parking.worldX - layout.parking.x, parking.worldY - layout.parking.y) >= CART_WORKSHOP_RADIUS) changed();
      moveOne(village, item, from, to, changed);
      break;
    case 'village-eat': {
      const { effect, durationMs } = VILLAGE_ITEMS[item].food;
      const now = time.getTime();
      if (village.effects[effect] > now) changed();
      moveOne(village, item, 'satchel', null, changed);
      village.effects[effect] = now + durationMs;
      break;
    }
    case 'village-barter':
      if (!offerAvailable(village)) changed();
      moveOne(village, TANSY_OFFER.wants, TANSY_OFFER.display, null, changed);
      moveOne(village, TANSY_OFFER.gives, null, 'satchel', changed);
      village.acceptedOffers.push(TANSY_OFFER.id);
      break;
  }
}
