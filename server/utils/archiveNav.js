const monthNavCache = new Map();
const dateNavCache = new Map();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

function setCache(map, key, value) {
  map.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}
function getCache(map, key) {
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    map.delete(key);
    return null;
  }
  return entry.value;
}

export async function getMonthNav(roomId, year, month, service) {
  const cacheKey = `month:${roomId || 'global'}:${year}-${month}`;
  const cached = getCache(monthNavCache, cacheKey);
  if (cached) return cached;

  const combos = await service.getAllBlockYearMonthCombos(roomId);
  const key = y => `${y.year}-${String(y.month).padStart(2, '0')}`;
  const id = `${year}-${month}`;
  const i = combos.findIndex(c => key(c) === id);
  const pick = offset => {
    const c = combos[i + offset];
    return c && { year: c.year, month: String(c.month).padStart(2, '0') };
  };
  const result = { prevMonth: pick(+1), nextMonth: pick(-1) };
  setCache(monthNavCache, cacheKey, result);
  return result;
}

export async function getDateNav(roomId, dateISO, Model) {
  const cacheKey = `date:${roomId || 'global'}:${dateISO}`;
  const cached = getCache(dateNavCache, cacheKey);
  if (cached) return cached;

  const baseQuery = roomId ? { roomId } : {};
  const prev = await Model.findOne({
    ...baseQuery,
    createdAt: { $lt: new Date(dateISO + 'T00:00:00Z') }
  }).sort({ createdAt: -1 }).lean();

  const next = await Model.findOne({
    ...baseQuery,
    createdAt: { $gt: new Date(dateISO + 'T23:59:59Z') }
  }).sort({ createdAt: 1 }).lean();

  const result = {
    prevDate: prev?.createdAt.toISOString().slice(0, 10) ?? null,
    nextDate: next?.createdAt.toISOString().slice(0, 10) ?? null,
  };
  setCache(dateNavCache, cacheKey, result);
  return result;
}
