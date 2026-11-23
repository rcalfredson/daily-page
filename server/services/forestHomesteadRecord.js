import { validateConstructionDesign, constructionCartCost } from '../../public/js/forest-construction-design.js';
import { validateHomeLayout } from '../../public/js/forest-home-reservations.js';
import { validForestCompanion } from '../../public/js/forest-companion.js';
import { ORCHARD_STAGES, ORCHARD_FORK_DISTANCES, ORCHARD_BRANCH_DISTANCES, ORCHARD_DYE_PALETTES,
  availableOrchardDyes } from '../../public/js/forest-orchard.js';

export const HOMESTEAD_RECEIPT_LIMIT = 64;
export const HOMESTEAD_MATERIAL_CAPACITY = Object.freeze({ timber: 96, cloth: 24 });
export const hasHomesteadCart = record => record?.cartDesign != null;
export const canDriveHomesteadCart = record => hasHomesteadCart(record)
  && (record.schemaVersion !== 3 || record.companion?.stage === 'joined');
export const HOMESTEAD_UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const fields = ['schemaVersion', 'ownerUserId', 'forestId', 'layoutId', 'homeId', 'cartId', 'layout',
  'homeDesign', 'cartDesign', 'parking', 'holdings', 'cartCommitment', 'catalogVersion', 'revision', 'receipts', 'changedAt'];
const exact = (o, keys) => o && typeof o === 'object' && !Array.isArray(o)
  && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));
const materials = o => exact(o, ['timber', 'cloth']) && Object.entries(o).every(([k, v]) =>
  Number.isSafeInteger(v) && v >= 0 && v <= HOMESTEAD_MATERIAL_CAPACITY[k]);
export const validHomesteadParking = o => exact(o, ['worldX', 'worldY', 'heading'])
  && [o.worldX, o.worldY, o.heading].every(Number.isFinite)
  && Math.abs(o.worldX) <= 1e9 && Math.abs(o.worldY) <= 1e9 && Math.abs(o.heading) <= Math.PI;

function validOrchard(orchard, home) {
  const site = orchard?.site;
  return exact(orchard, ['site', 'stages']) && exact(site, ['version', 'forkDistance', 'branchDistance', 'plots'])
    && site.version === 1 && ORCHARD_FORK_DISTANCES.includes(site.forkDistance)
    && ORCHARD_BRANCH_DISTANCES.includes(site.branchDistance) && Array.isArray(site.plots) && site.plots.length === 2
    && site.plots.every(p => exact(p, ['x', 'y']) && Number.isSafeInteger(p.x) && Number.isSafeInteger(p.y)
      && Math.abs(p.x - home.x) <= 140 && Math.abs(p.y - home.y) <= 106)
    && Math.hypot(site.plots[0].x - site.plots[1].x, site.plots[0].y - site.plots[1].y) >= 52
    && Array.isArray(orchard.stages) && orchard.stages.length === 2 && orchard.stages.every(stage => ORCHARD_STAGES.includes(stage));
}

export class ForestHomesteadError extends Error {
  constructor(code) { super(code); this.name = 'ForestHomesteadError'; this.code = code; }
}
export function validateHomestead(record, scope) {
  if (!record) return null;
  if (![1, 2, 3].includes(record.schemaVersion) || record.catalogVersion !== 1) throw new ForestHomesteadError('HOME_MIGRATION_REQUIRED');
  const onboarding = record.schemaVersion === 3;
  const hasCompanion = record.schemaVersion === 2 || onboarding && Object.hasOwn(record, 'companion');
  const hasOrchard = Object.hasOwn(record, 'orchard');
  const expected = [...fields, ...(onboarding ? ['starterSuppliesClaimed'] : []), ...(hasCompanion ? ['companion'] : []),
    ...(hasOrchard ? ['orchard'] : [])];
  const built = hasHomesteadCart(record);
  if (!exact(Object.fromEntries(Object.entries(record).filter(([k]) => k !== '_id')), expected)
    || onboarding && (typeof record.starterSuppliesClaimed !== 'boolean'
      || built && !record.starterSuppliesClaimed || !built && record.cartDesign !== null)
    || hasCompanion && (!validForestCompanion(record.companion)
      || [record.layoutId, record.homeId, record.cartId].includes(record.companion.id))
    || record.ownerUserId !== scope.ownerUserId || record.forestId !== scope.forestId
    || !/^[a-f0-9]{24}$/.test(record.ownerUserId) || !HOMESTEAD_UUID.test(record.forestId)
    || !['layoutId', 'homeId', 'cartId'].every(k => HOMESTEAD_UUID.test(record[k]))
    || new Set([record.layoutId, record.homeId, record.cartId]).size !== 3
    || !validateHomeLayout(record.layout) || !validateConstructionDesign('home', record.homeDesign)
    || ((!onboarding || built) && !validateConstructionDesign('cart', record.cartDesign)) || !validHomesteadParking(record.parking)
    || hasOrchard && !validOrchard(record.orchard, record.layout.home)
    || built && Object.hasOwn(ORCHARD_DYE_PALETTES, record.cartDesign.cloth) && !availableOrchardDyes(record).includes(record.cartDesign.cloth)
    || !materials(record.holdings) || !materials(record.cartCommitment)
    || !Object.keys(HOMESTEAD_MATERIAL_CAPACITY).every(k =>
      (built || record.cartCommitment[k] === 0)
      && record.holdings[k] + record.cartCommitment[k] === (onboarding && !record.starterSuppliesClaimed ? 0 : HOMESTEAD_MATERIAL_CAPACITY[k]))
    || !Number.isSafeInteger(record.revision) || record.revision < 1
    || !Array.isArray(record.receipts) || !record.receipts.length || record.receipts.length > HOMESTEAD_RECEIPT_LIMIT
    || record.receipts.length > record.revision
    || new Set(record.receipts.map(r => r?.operationId)).size !== record.receipts.length
    || record.receipts.some((r, i) => !exact(r, ['operationId', 'digest', 'revision'])
      || !HOMESTEAD_UUID.test(r.operationId) || !/^[A-Za-z0-9_-]{43}$/.test(r.digest)
      || r.revision !== record.revision - record.receipts.length + i + 1)
    || !(record.changedAt instanceof Date) || !Number.isFinite(record.changedAt.getTime())) {
    throw new ForestHomesteadError('HOME_UNAVAILABLE');
  }
  return record;
}

// Version-1 finishes for the house are immediately available. The initial material grant
// covers every cart; committed costs are stored separately and never recalculated for refunds.
export function homesteadCartCost(design) {
  if (!validateConstructionDesign('cart', design)) throw new ForestHomesteadError('HOME_INVALID_INPUT');
  return constructionCartCost(design);
}
