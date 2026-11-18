// Shared route adapter; the application service enforces development account availability.
export function buildForestHomesteadRouteHandler({ service }) {
  return async (req, res) => {
    res.set('Cache-Control', 'private, no-store'); res.vary('Cookie');
    if (!req.user?.id) return res.status(401).json({ code: 'AUTHENTICATION_REQUIRED' });
    try {
      if (Object.keys(req.query).length) return res.status(400).json({ code: 'HOME_INVALID_INPUT' });
      const result = req.method === 'GET' ? await service.read({ ownerUserId: req.user.id })
        : await service.mutate({ ownerUserId: req.user.id, command: req.body });
      return res.json(result);
    } catch (error) {
      const code = error.code || error.message;
      const invalid = ['HOME_INVALID_INPUT', 'CONSTRUCTION_INVALID_AMOUNTS'].includes(code);
      const conflict = ['HOME_CONFLICT', 'CONSTRUCTION_CONFLICT', 'HOME_TERRAIN_CHANGED', 'HOME_FOREST_CHANGED',
        'HOME_OPERATION_CONFLICT', 'HOME_ALREADY_ESTABLISHED', 'HOME_PLACEMENT_COLLISION', 'HOME_NOT_ESTABLISHED',
        'CONSTRUCTION_INSUFFICIENT_MATERIAL', 'CONSTRUCTION_CAPACITY', 'COMPANION_ENCOUNTER_CHANGED'].includes(code);
      const disabled = code === 'HOME_DISABLED';
      return res.status(invalid ? 400 : conflict ? 409 : disabled ? 403 : 503)
        .json({ code: invalid || conflict || disabled ? code : 'HOME_UNAVAILABLE' });
    }
  };
}
