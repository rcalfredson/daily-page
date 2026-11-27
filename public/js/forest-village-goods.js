export const QUINCE_JAM = 'quince-jam';
export const WOVEN_TRIM = 'woven-trim';
export const CART_WORKSHOP_RADIUS = 100;
export const STAND_ARRANGEMENTS = ['shelf', 'barter-mat'];
export const TANSY_OFFER = Object.freeze({ id: 'tansy-woven-trim', display: 'stand', arrangement: 'barter-mat',
  wants: QUINCE_JAM, gives: WOVEN_TRIM });

export const VILLAGE_ITEMS = Object.freeze({
  [QUINCE_JAM]: { food: { effect: 'quick-step', durationMs: 20_000 } },
  [WOVEN_TRIM]: { fits: 'cart-trim' }
});
export const GOODS_LOCATIONS = Object.freeze({
  satchel: {},
  stand: { capacity: 1 },
  'stall-shelf': { capacity: 1, accepts: QUINCE_JAM },
  'cart-trim': { capacity: 1, fitting: true }
});

export const itemCount = (village, location, item) => village?.goods?.[location]?.[item] ?? 0;
export const displayedItem = (village, location) => Object.keys(village?.goods?.[location] ?? {})[0];
export const hasWovenTrim = village => itemCount(village, 'cart-trim', WOVEN_TRIM) > 0;
export function quickStepSeconds(village, time = Date.now()) {
  return Math.max(0, Math.ceil(((village?.effects?.['quick-step'] ?? 0) - time) / 1000));
}
export const quickStepMultiplier = (village, time) => quickStepSeconds(village, time) > 0 ? 1.25 : 1;

export function locationAccepts(location, item) {
  if (typeof location !== 'string' || typeof item !== 'string'
    || !Object.hasOwn(GOODS_LOCATIONS, location) || !Object.hasOwn(VILLAGE_ITEMS, item)) return false;
  const destination = GOODS_LOCATIONS[location];
  return (!destination.accepts || destination.accepts === item)
    && (!destination.fitting || VILLAGE_ITEMS[item].fits === location);
}

export function offerAvailable(village, offer = TANSY_OFFER) {
  return !village?.acceptedOffers?.includes(offer.id) && village?.standArrangement === offer.arrangement
    && displayedItem(village, offer.display) === offer.wants;
}
