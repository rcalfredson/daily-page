import { forestReturnTreeId } from '../../public/js/forest-writing-navigation.js';

// Context and tree identity are locators, not return URLs or grants of forest access.
export function forestWritingReturn(req, res, next) {
  res.locals.forestReturnPath = null;
  if (req.query.from === 'forest') {
    res.set('Cache-Control', 'private, no-store');
    res.vary('Cookie');
    if (req.user?.id) {
      const treeId = forestReturnTreeId(req.query.returnTree);
      res.locals.forestReturnPath = `/forest${treeId ? `?returnTree=${treeId}` : ''}`;
    }
  }
  next();
}
