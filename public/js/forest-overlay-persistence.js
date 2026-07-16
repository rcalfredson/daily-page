import {
  createEmptyForestOverlay,
  validateForestOverlay
} from './forest-world-overlay.js';

export const FOREST_DEV_OVERLAY_STORAGE_PREFIX = 'daily-page:activity-forest:overlay:';

function storageKey(baseIdentity) {
  return `${FOREST_DEV_OVERLAY_STORAGE_PREFIX}${baseIdentity.sceneVersion}:${
    baseIdentity.layoutKey}:${baseIdentity.seed}`;
}

export function createForestDevOverlayPersistence(storage) {
  return {
    load(baseIdentity) {
      const empty = createEmptyForestOverlay(baseIdentity);
      let raw;
      try {
        raw = storage.getItem(storageKey(baseIdentity));
        if (raw === null) return { overlay: empty, status: 'empty', error: null };
        const overlay = JSON.parse(raw);
        const validation = validateForestOverlay(overlay, baseIdentity);
        if (!validation.valid) {
          return { overlay: empty, status: 'recovered', error: validation.reason };
        }
        return { overlay, status: 'loaded', error: null };
      } catch (error) {
        return { overlay: empty, status: 'recovered', error: error.message };
      }
    },
    save(overlay) {
      const validation = validateForestOverlay(overlay, overlay?.baseIdentity);
      if (!validation.valid) throw new Error(`Cannot save forest overlay: ${validation.reason}.`);
      storage.setItem(storageKey(overlay.baseIdentity), JSON.stringify(overlay));
      return JSON.parse(JSON.stringify(overlay));
    },
    reset(baseIdentity) {
      storage.removeItem(storageKey(baseIdentity));
      return createEmptyForestOverlay(baseIdentity);
    }
  };
}
