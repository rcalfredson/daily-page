import { authenticateRequest } from '../services/authSessions.js';
import { updateUserPreferredUiLang } from '../db/userService.js';
import { isSupportedUiLang } from '../services/localeContext.js';

export async function rememberPreferredUiLang(
  auth,
  preferredUiLang,
  updatePreferredUiLang = updateUserPreferredUiLang
) {
  if (
    !auth
    || !isSupportedUiLang(preferredUiLang)
    || auth.dbUser.preferredUiLang === preferredUiLang
  ) {
    return false;
  }

  await updatePreferredUiLang(auth.user.id, preferredUiLang);
  auth.dbUser.preferredUiLang = preferredUiLang;
  auth.user.preferredUiLang = preferredUiLang;
  return true;
}

async function optionalAuth(req, res, next) {
  try {
    const auth = await authenticateRequest(req, res);
    if (auth) {
      req.user = auth.user;
      req.authSession = auth.session;
      req.dbUser = auth.dbUser;

      await rememberPreferredUiLang(auth, res.locals.uiLang);
    }
  } catch (error) {
    console.error('Optional auth error:', error);
  }

  next();
}

export default optionalAuth;
