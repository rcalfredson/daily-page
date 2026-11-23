import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import { buildForestHomesteadService } from './forestHomestead.js';
import { buildForestHomesteadGeography } from './forestHomesteadGeography.js';
import { forestHomesteadDevelopmentEnabled, homesteadDevelopmentEnvironment } from './forestHomesteadAvailability.js';
import { ForestHomesteadError } from './forestHomesteadRecord.js';
import { forestTerrainDescriptor } from './forestOwnerTerrainRegion.js';
import { assertForestTerrainPlacementReady } from './forestOwnerTerrain.js';

export function buildForestHomesteadApplication({ enabled = forestHomesteadDevelopmentEnabled,
  geography = buildForestHomesteadGeography({ amberClearingEnabled: enabled }),
  service = buildForestHomesteadService({ ...geography, enabled: () => true, guidedStart: true, orchardEnabled: enabled }),
  WorldModel = ForestOwnerWorld } = {}) {
  async function decorate(ownerUserId, record) {
    if (!record.established) return { ...record, ownerUserId };
    if (record.cartDesign === null) return { ...record, arrival: null, recoveryRequired: false };
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
    async suggest({ ownerUserId }) {
      if (!enabled(ownerUserId)) throw new ForestHomesteadError('HOME_DISABLED');
      const record = await service.read({ ownerUserId });
      if (record.established) throw new ForestHomesteadError('HOME_ALREADY_ESTABLISHED');
      const world = await WorldModel.findOne({ ownerUserId, worldRole: 'primary' }).lean();
      if (!world || world.forestId !== record.forestId
        || (forestTerrainDescriptor(world)?.token || null) !== record.terrainToken) {
        throw new ForestHomesteadError('HOME_TERRAIN_CHANGED');
      }
      assertForestTerrainPlacementReady(world);
      const plan = await geography.planSite({ ownerUserId, world, session: null });
      return { site: plan.parking, forestId: record.forestId, terrainToken: record.terrainToken };
    },
    async mutate({ ownerUserId, command }) {
      await authorize(ownerUserId);
      return decorate(ownerUserId, await service.mutate({ ownerUserId, command }));
    }
  };
}
export const forestHomesteadApplication = buildForestHomesteadApplication();
