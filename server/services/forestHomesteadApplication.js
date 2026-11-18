import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import { buildForestHomesteadService } from './forestHomestead.js';
import { buildForestHomesteadGeography } from './forestHomesteadGeography.js';
import { forestHomesteadDevelopmentEnabled, homesteadDevelopmentEnvironment } from './forestHomesteadAvailability.js';
import { ForestHomesteadError } from './forestHomesteadRecord.js';

export function buildForestHomesteadApplication({ geography = buildForestHomesteadGeography(),
  service = buildForestHomesteadService({ ...geography, enabled: () => true }),
  enabled = forestHomesteadDevelopmentEnabled, WorldModel = ForestOwnerWorld } = {}) {
  async function decorate(ownerUserId, record) {
    if (!record.established) return { ...record, ownerUserId };
    const world = await WorldModel.findOne({ ownerUserId, worldRole: 'primary' }).lean();
    const arrival = await geography.arrival({ ownerUserId, world, next: record, session: null });
    return { ...record, arrival, recoveryRequired: !arrival };
  }
  async function authorize(ownerUserId) {
    if (!enabled(ownerUserId) && !(homesteadDevelopmentEnvironment()
      && (await service.read({ ownerUserId })).established)) throw new ForestHomesteadError('HOME_DISABLED');
  }
  return {
    async read({ ownerUserId }) {
      await authorize(ownerUserId);
      return decorate(ownerUserId, await service.read({ ownerUserId }));
    },
    async mutate({ ownerUserId, command }) {
      await authorize(ownerUserId);
      return decorate(ownerUserId, await service.mutate({ ownerUserId, command }));
    }
  };
}
export const forestHomesteadApplication = buildForestHomesteadApplication();
