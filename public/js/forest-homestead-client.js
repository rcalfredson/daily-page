// One unresolved command at a time. Exact retries remain safe across a page reload.
export function createHomesteadClient({ initial, request = (...args) => globalThis.fetch(...args),
  storage = globalThis.sessionStorage, uuid = () => globalThis.crypto.randomUUID(), onChange = () => {} }) {
  let record = initial, pending = null, busy = false, status = 'saved', message = 'Saved. Ready for your next visit.';
  const key = `forest-homestead:${initial.ownerUserId}:${initial.forestId}`;
  try { pending = JSON.parse(storage.getItem(key) || 'null'); } catch { /* Storage may be disabled. */ }
  if (pending) { status = 'unresolved'; message = 'A previous save needs confirmation. Choose Retry save.'; }
  const snapshot = () => ({ record, pending, busy, status, message });
  const publish = () => onChange(snapshot());
  function remember() {
    try { if (pending) storage.setItem(key, JSON.stringify(pending)); else storage.removeItem(key); } catch { /* In-memory retries remain safe. */ }
  }
  async function send(method, body) {
    const controller = new globalThis.AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await request('/api/v1/forest/homestead', { method, signal: controller.signal,
        credentials: 'same-origin', cache: 'no-store', ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      const result = await response.json();
      if (!response.ok) throw Object.assign(new Error(result.code), { status: response.status });
      if ((method === 'POST' || initial.established) && !result.established
        || result.forestId !== initial.forestId || !Number.isSafeInteger(result.revision)) throw new Error('Invalid saved state');
      return result;
    } finally { clearTimeout(timer); }
  }
  function checkTerrain() {
    if (record.terrainToken !== initial.terrainToken) {
      status = 'reload'; message = 'The forest terrain changed. Reload the forest before continuing.';
    }
  }
  async function retry() {
    if (busy || !pending) return false;
    busy = true; status = 'saving'; message = 'Saving…'; publish();
    try {
      record = await send('POST', pending); pending = null; remember();
      status = 'saved'; message = 'Saved. Ready for your next visit.'; checkTerrain(); return true;
    } catch (error) {
      if ([400, 403, 409].includes(error.status)) {
        const action = pending.action;
        pending = null; remember();
        status = 'conflict'; message = action === 'establish' ? 'Find the suggested clearing again.'
          : action === 'companion' ? 'This encounter changed in another visit or could not be saved. Review the current encounter and try again.'
          : error.message === 'HOME_ORCHARD_UNAVAILABLE' ? 'There’s no clear orchard road and planting space off this homestead.'
          : error.message === 'HOME_OUTING_UNAVAILABLE' ? 'There’s no clear way from this road to the walled orchard.'
          : error.message === 'HOME_VILLAGE_UNAVAILABLE' ? 'The preserving hearth is unavailable. Your Satchel is unchanged.'
          : error.message === 'HOME_VILLAGE_CHANGED' ? 'The hearth or quince tree has changed. Check what’s available and try again.'
          : error.message === 'HOME_ORCHARD_PLANTING_BLOCKED' ? 'That spot is blocked. Your seed is still in the Satchel. Try another spot.'
          : error.message === 'HOME_ORCHARD_CHANGED' ? 'The orchard changed in another visit. Review what’s available and try again.'
          : error.message === 'CONSTRUCTION_CONFLICT' ? 'Another visit changed this save. Your draft is still here; review it and save again.' : 'The save was declined. Your draft is still here; review it and try again.';
        try { record = await send('GET'); checkTerrain(); }
        catch { status = 'stale'; message = 'Could not load the current save. Retry loading before making another change.'; }
      } else {
        status = 'unresolved'; message = pending.action === 'companion'
          ? 'This moment is not confirmed yet. Retry save to check the same request.'
          : 'Save not confirmed. Your draft is kept. Retry save to check the same request.';
      }
      return false;
    } finally { busy = false; publish(); }
  }
  async function refresh() {
    if (busy || pending) return false;
    busy = true; publish();
    try { record = await send('GET'); status = 'saved'; message = 'Current save loaded. Review your draft before saving.'; checkTerrain(); return true; }
    catch { status = 'stale'; message = 'Could not load the current save. Try again.'; return false; }
    finally { busy = false; publish(); }
  }
  return { snapshot, retry, refresh,
    async save(action, extra = {}) {
      if (busy || pending || ['stale', 'reload'].includes(status)) return false;
      pending = { action, operationId: uuid(), forestId: record.forestId, expectedRevision: record.revision,
        terrainToken: record.terrainToken, ...extra };
      remember(); return retry();
    }
  };
}
