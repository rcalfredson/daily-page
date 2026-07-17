import {
  createEmptyForestDiscoveryState,
  validateForestDiscoveryState
} from './forest-discoveries.js';

export const FOREST_DEV_DISCOVERY_STORAGE_PREFIX = 'daily-page:activity-forest:discoveries:';

function storageKey(baseIdentity) {
  return `${FOREST_DEV_DISCOVERY_STORAGE_PREFIX}${baseIdentity.sceneVersion}:${
    baseIdentity.layoutKey}:${baseIdentity.seed}`;
}

export function createForestDevDiscoveryPersistence(storage) {
  return {
    load(baseIdentity) {
      const empty = createEmptyForestDiscoveryState(baseIdentity);
      try {
        const raw = storage.getItem(storageKey(baseIdentity));
        if (raw === null) return { state: empty, status: 'empty', error: null };
        const state = JSON.parse(raw);
        const validation = validateForestDiscoveryState(state, baseIdentity);
        if (!validation.valid) {
          return { state: empty, status: 'recovered', error: validation.reason };
        }
        return { state, status: 'loaded', error: null };
      } catch (error) {
        return { state: empty, status: 'recovered', error: error.message };
      }
    },
    save(state) {
      const validation = validateForestDiscoveryState(state, state?.baseIdentity);
      if (!validation.valid) throw new Error(`Cannot save forest discoveries: ${validation.reason}.`);
      storage.setItem(storageKey(state.baseIdentity), JSON.stringify(state));
      return JSON.parse(JSON.stringify(state));
    },
    reset(baseIdentity) {
      storage.removeItem(storageKey(baseIdentity));
      return createEmptyForestDiscoveryState(baseIdentity);
    }
  };
}
