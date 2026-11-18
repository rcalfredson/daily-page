// Local development accounts only. Deployment/public enablement is a separate release step.
export function homesteadDevelopmentEnvironment(environment = process.env) {
  if (environment.NODE_ENV === 'production'
    || ['1', 'true', 'yes', 'on'].includes(String(environment.USE_PRODUCTION_DB).trim().toLowerCase())) return false;
  return true;
}
export function forestHomesteadDevelopmentEnabled(ownerUserId, environment = process.env) {
  if (!homesteadDevelopmentEnvironment(environment)) return false;
  return String(environment.FOREST_HOMESTEAD_DEV_OWNER_IDS || '').split(',')
    .map(id => id.trim()).filter(id => /^[a-f0-9]{24}$/.test(id)).includes(String(ownerUserId));
}
