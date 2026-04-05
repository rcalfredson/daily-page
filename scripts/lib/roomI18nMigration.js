const DEFAULT_FIELDS = ['name', 'description', 'topic'];

function getMapValue(map, key) {
  if (!map || !key) return undefined;
  return typeof map.get === 'function' ? map.get(key) : map[key];
}

function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function getLocalizableRoomFields() {
  return [...DEFAULT_FIELDS];
}

export function resolveRoomSourceValue(room, field, sourceLang = 'en') {
  const baseValue = normalizeText(room && room[field]);
  if (baseValue) return baseValue;
  return normalizeText(getMapValue(room && room[`${field}_i18n`], sourceLang));
}

export function getExistingRoomTranslation(room, field, targetLang) {
  return normalizeText(getMapValue(room && room[`${field}_i18n`], targetLang));
}

export function parseRoomTranslationFilePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Translation payload must be a JSON object.');
  }

  if (Array.isArray(payload.rooms)) {
    return payload.rooms.reduce((acc, roomEntry) => {
      const roomId = String(
        (roomEntry && roomEntry.roomId)
        || (roomEntry && roomEntry._id)
        || (roomEntry && roomEntry.id)
        || ''
      ).trim();

      if (!roomId) return acc;

      const translation = roomEntry.translation || roomEntry.translations || {};
      acc[roomId] = { ...(acc[roomId] || {}), ...translation };
      return acc;
    }, {});
  }

  if (payload.translations && typeof payload.translations === 'object') {
    return payload.translations;
  }

  return payload;
}

export function createRoomTranslationTemplate({
  rooms = [],
  targetLang,
  sourceLang = 'en',
  fields = DEFAULT_FIELDS
}) {
  return {
    meta: {
      targetLang,
      sourceLang,
      fields,
      generatedAt: new Date().toISOString()
    },
    rooms: rooms.map((room) => {
      const source = {};
      fields.forEach((field) => {
        const value = resolveRoomSourceValue(room, field, sourceLang);
        if (value) {
          source[field] = value;
        }
      });

      return {
        roomId: String((room && room._id) || ''),
        source,
        translation: {}
      };
    })
  };
}

export function createRoomTranslationExport({
  rooms = [],
  targetLang,
  sourceLang = 'en',
  fields = DEFAULT_FIELDS,
  onlyMissing = true
}) {
  const exportedRooms = rooms.map((room) => {
    const source = {};
    const existing = {};
    const missingFields = [];

    fields.forEach((field) => {
      const sourceValue = resolveRoomSourceValue(room, field, sourceLang);
      const existingValue = getExistingRoomTranslation(room, field, targetLang);

      if (sourceValue) {
        source[field] = sourceValue;
      }

      if (existingValue) {
        existing[field] = existingValue;
      } else if (sourceValue) {
        missingFields.push(field);
      }
    });

    return {
      roomId: String((room && room._id) || ''),
      source,
      existing,
      missingFields,
      translation: {}
    };
  }).filter((room) => {
    if (!room.roomId) return false;
    if (!onlyMissing) return true;
    return room.missingFields.length > 0;
  });

  return {
    meta: {
      targetLang,
      sourceLang,
      fields,
      onlyMissing,
      generatedAt: new Date().toISOString(),
      roomCount: exportedRooms.length
    },
    rooms: exportedRooms
  };
}

export function buildRoomI18nMigrationPlan({
  rooms = [],
  targetLang,
  sourceLang = 'en',
  translationsByRoom = {},
  overwrite = false,
  fields = DEFAULT_FIELDS
}) {
  if (!targetLang) {
    throw new Error('targetLang is required.');
  }

  return rooms.map((room) => {
    const roomId = String((room && room._id) || '');
    const translations = translationsByRoom[roomId] || {};
    const fieldResults = fields.map((field) => {
      const source = resolveRoomSourceValue(room, field, sourceLang);
      const incoming = normalizeText(translations[field]);
      const existing = getExistingRoomTranslation(room, field, targetLang);
      const path = `${field}_i18n.${targetLang}`;

      if (!source) {
        return { field, path, status: 'missing-source', source, incoming, existing };
      }

      if (!incoming) {
        return { field, path, status: 'missing-translation', source, incoming, existing };
      }

      if (existing === incoming) {
        return { field, path, status: 'unchanged', source, incoming, existing };
      }

      if (existing && !overwrite) {
        return { field, path, status: 'blocked-existing', source, incoming, existing };
      }

      return {
        field,
        path,
        status: existing ? 'overwrite' : 'create',
        source,
        incoming,
        existing
      };
    });

    const updates = fieldResults
      .filter((result) => result.status === 'create' || result.status === 'overwrite')
      .reduce((acc, result) => {
        acc[result.path] = result.incoming;
        return acc;
      }, {});

    return {
      roomId,
      room,
      fieldResults,
      updates,
      willWrite: Object.keys(updates).length > 0
    };
  });
}
