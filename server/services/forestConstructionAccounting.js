// Inventory arithmetic for transactional construction. Costs are supplied by a versioned catalog;
// callers must use recorded commitments for refunds, never today's price of an old design.
export class ForestConstructionAccountingError extends Error {
  constructor(code) { super(code); this.code = code; this.name = 'ForestConstructionAccountingError'; }
}
const fail = code => { throw new ForestConstructionAccountingError(code); };
function amounts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 32
    || Object.entries(value).some(([key, count]) => !/^[a-z][a-z0-9-]{0,47}$/.test(key)
      || !Number.isSafeInteger(count) || count < 0)) fail('CONSTRUCTION_INVALID_AMOUNTS');
  return value;
}

export function replaceConstructionCommitment({ holdings, previousCommitment, nextCost, capacity, otherCommitments = {} }) {
  [holdings, previousCommitment, nextCost, capacity, otherCommitments].forEach(amounts);
  const keys = new Set([...Object.keys(holdings), ...Object.keys(previousCommitment), ...Object.keys(nextCost), ...Object.keys(otherCommitments)]);
  const nextHoldings = {};
  for (const key of keys) {
    const available = (holdings[key] || 0) + (previousCommitment[key] || 0);
    if (!Number.isSafeInteger(available)) fail('CONSTRUCTION_INVALID_AMOUNTS');
    if (available < (nextCost[key] || 0)) fail('CONSTRUCTION_INSUFFICIENT_MATERIAL');
    // Capacity counts loose AND committed material, so every promised refund always fits.
    const total = available + (otherCommitments[key] || 0);
    if (!Number.isSafeInteger(total) || !Object.hasOwn(capacity, key) || total > capacity[key]) fail('CONSTRUCTION_CAPACITY');
    nextHoldings[key] = available - (nextCost[key] || 0);
  }
  return { holdings: nextHoldings, commitment: { ...nextCost } };
}

export function checkConstructionRevision(actual, expected) {
  if (![actual, expected].every(v => Number.isSafeInteger(v) && v >= 0 && v < Number.MAX_SAFE_INTEGER)) {
    fail('CONSTRUCTION_INVALID_REVISION');
  }
  if (actual !== expected) fail('CONSTRUCTION_CONFLICT');
  return actual + 1;
}
