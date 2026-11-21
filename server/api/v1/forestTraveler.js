import ForestOwnerWorld from '../../db/models/ForestOwnerWorld.js';
import { forestHomesteadDevelopmentEnabled } from '../../services/forestHomesteadAvailability.js';

export function buildForestTravelerRouteHandler({
  WorldModel = ForestOwnerWorld, enabled = forestHomesteadDevelopmentEnabled
} = {}) {
  return async (req, res) => {
    const ownerUserId = req.user?.id;
    if (!ownerUserId) return res.status(401).json({ code: 'AUTHENTICATION_REQUIRED' });
    if (!enabled(ownerUserId)) return res.status(403).json({ code: 'TRAVELER_DISABLED' });
    const { forestId } = req.body || {};
    if (Object.keys(req.query).length || Object.keys(req.body || {}).length !== 1
      || typeof forestId !== 'string'
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(forestId)) {
      return res.status(400).json({ code: 'TRAVELER_INVALID_INPUT' });
    }
    try {
      // This fact only moves one way. An identical retry after a lost response is a no-op.
      const result = await WorldModel.updateOne({
        ownerUserId, forestId, worldRole: 'primary', status: 'active', schemaVersion: { $in: [1, 2] }
      }, { $set: { tansyIntroduced: true } }, { timestamps: false, runValidators: true });
      if (!result.matchedCount) return res.status(409).json({ code: 'TRAVELER_FOREST_CHANGED' });
      return res.json({ introduced: true });
    } catch {
      return res.status(503).json({ code: 'TRAVELER_UNAVAILABLE' });
    }
  };
}
