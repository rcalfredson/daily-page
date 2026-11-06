import { forestReturnLocator } from '../../public/js/forest-writing-navigation.js';

// Context and tree identity are locators, not return URLs or grants of forest access.
export function forestWritingReturn(req, res, next) {
  res.locals.forestReturnPath = null;
  if (req.query.from === 'forest') {
    res.set('Cache-Control', 'private, no-store');
    res.vary('Cookie');
    if (req.user?.id) {
      const locator = forestReturnLocator(req.query);
      const suffix = locator?.returnMarkerId ? `?returnMarker=${locator.returnMarkerId}`
        : locator?.returnTreeId ? `?returnTree=${locator.returnTreeId}` : '';
      res.locals.forestReturnPath = `/forest${suffix}`;
    }
  }
  next();
}
