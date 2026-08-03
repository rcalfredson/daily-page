import User from '../db/models/User.js';

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

export class ForestLedgerFenceError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ForestLedgerFenceError';
    this.code = code;
  }
}

export async function acquireForestLedgerFence({
  ownerUserId,
  session,
  UserModel = User
}) {
  const owner = String(ownerUserId || '').toLowerCase();
  if (!OBJECT_ID_PATTERN.test(owner)) {
    throw new ForestLedgerFenceError('INVALID_FOREST_OWNER_ID');
  }
  if (!session) {
    throw new ForestLedgerFenceError('FOREST_LEDGER_TRANSACTION_REQUIRED');
  }

  const result = await UserModel.updateOne(
    { _id: owner },
    { $inc: { forestLedgerFence: 1 } },
    { session }
  );
  if (Number(result?.matchedCount || 0) !== 1) {
    throw new ForestLedgerFenceError('FOREST_OWNER_UNAVAILABLE');
  }

  return { ownerUserId: owner, acquired: true };
}
