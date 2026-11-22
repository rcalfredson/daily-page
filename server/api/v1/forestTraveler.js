import ForestOwnerWorld from '../../db/models/ForestOwnerWorld.js';
import { forestHomesteadDevelopmentEnabled } from '../../services/forestHomesteadAvailability.js';

export function buildForestTravelerRouteHandler({
  WorldModel = ForestOwnerWorld, enabled = forestHomesteadDevelopmentEnabled
} = {}) {
  return async (req, res) => {
    const ownerUserId = req.user?.id;
    if (!ownerUserId) return res.status(401).json({ code: 'AUTHENTICATION_REQUIRED' });
    if (!enabled(ownerUserId)) return res.status(403).json({ code: 'TRAVELER_DISABLED' });
    const { forestId, action } = req.body || {};
    const acceptingFrame = action === 'accept-frame';
    const savingClue = action === 'remember-amber-clearing';
    if (Object.keys(req.query).length
      || Object.keys(req.body || {}).length !== (acceptingFrame || savingClue ? 2 : 1)
      || action !== undefined && !acceptingFrame && !savingClue
      || typeof forestId !== 'string'
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(forestId)) {
      return res.status(400).json({ code: 'TRAVELER_INVALID_INPUT' });
    }
    try {
      // Each choice sets a durable fact on the forest, including before homestead creation.
      const facts = savingClue ? { tansyAmberClearingClue: true }
        : { tansyIntroduced: true, ...(acceptingFrame ? { tansyFrameAccepted: true } : {}) };
      const result = await WorldModel.updateOne({
        ownerUserId, forestId, worldRole: 'primary', status: 'active', schemaVersion: { $in: [1, 2] }
      }, { $set: facts },
      { timestamps: false, runValidators: true });
      if (!result.matchedCount) return res.status(409).json({ code: 'TRAVELER_FOREST_CHANGED' });
      return res.json(savingClue ? { amberClearingClue: true }
        : { introduced: true, ...(acceptingFrame ? { frameOwned: true } : {}) });
    } catch {
      return res.status(503).json({ code: 'TRAVELER_UNAVAILABLE' });
    }
  };
}
