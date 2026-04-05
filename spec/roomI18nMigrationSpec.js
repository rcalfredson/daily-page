import {
  buildRoomI18nMigrationPlan,
  createRoomTranslationExport,
  createRoomTranslationTemplate,
  parseRoomTranslationFilePayload,
  resolveRoomSourceValue
} from '../scripts/lib/roomI18nMigration.js';

describe('roomI18nMigration helpers', () => {
  it('prefers the legacy base English field as the source of truth', () => {
    const room = {
      _id: 'physics',
      name: 'Physics',
      name_i18n: { en: 'Physics from map' }
    };

    expect(resolveRoomSourceValue(room, 'name', 'en')).toBe('Physics');
  });

  it('falls back to source-lang map content when the legacy field is empty', () => {
    const room = {
      _id: 'poetry',
      description: '   ',
      description_i18n: { en: 'Writing about poems.' }
    };

    expect(resolveRoomSourceValue(room, 'description', 'en')).toBe('Writing about poems.');
  });

  it('plans creates, skips unchanged translations, and blocks overwrites by default', () => {
    const plan = buildRoomI18nMigrationPlan({
      rooms: [{
        _id: 'physics',
        name: 'Physics',
        description: 'A place for physics writing.',
        topic: 'Science',
        name_i18n: { ru: 'Физика' },
        description_i18n: { ru: 'Старый перевод.' }
      }],
      targetLang: 'ru',
      translationsByRoom: {
        physics: {
          name: 'Физика',
          description: 'Место для текстов о физике.',
          topic: 'Наука'
        }
      }
    });

    expect(plan).toEqual([{
      roomId: 'physics',
      room: jasmine.any(Object),
      fieldResults: [
        {
          field: 'name',
          path: 'name_i18n.ru',
          status: 'unchanged',
          source: 'Physics',
          incoming: 'Физика',
          existing: 'Физика'
        },
        {
          field: 'description',
          path: 'description_i18n.ru',
          status: 'blocked-existing',
          source: 'A place for physics writing.',
          incoming: 'Место для текстов о физике.',
          existing: 'Старый перевод.'
        },
        {
          field: 'topic',
          path: 'topic_i18n.ru',
          status: 'create',
          source: 'Science',
          incoming: 'Наука',
          existing: null
        }
      ],
      updates: {
        'topic_i18n.ru': 'Наука'
      },
      willWrite: true
    }]);
  });

  it('allows overwrites when explicitly enabled', () => {
    const [roomPlan] = buildRoomI18nMigrationPlan({
      rooms: [{
        _id: 'history',
        name: 'History',
        name_i18n: { ru: 'История (старый)' }
      }],
      targetLang: 'ru',
      translationsByRoom: {
        history: {
          name: 'История'
        }
      },
      overwrite: true,
      fields: ['name']
    });

    expect(roomPlan.fieldResults[0].status).toBe('overwrite');
    expect(roomPlan.updates).toEqual({
      'name_i18n.ru': 'История'
    });
  });

  it('creates a translator-ready template payload', () => {
    const template = createRoomTranslationTemplate({
      rooms: [{
        _id: 'math',
        name: 'Math',
        description: 'Numbers and proofs.',
        topic: 'STEM'
      }],
      targetLang: 'ru'
    });

    expect(template.meta.targetLang).toBe('ru');
    expect(template.rooms).toEqual([{
      roomId: 'math',
      source: {
        name: 'Math',
        description: 'Numbers and proofs.',
        topic: 'STEM'
      },
      translation: {}
    }]);
  });

  it('exports only the fields still missing for the target language by default', () => {
    const exported = createRoomTranslationExport({
      rooms: [{
        _id: 'math',
        name: 'Math',
        description: 'Numbers and proofs.',
        topic: 'STEM',
        name_i18n: { ru: 'Математика' }
      }],
      targetLang: 'ru'
    });

    expect(exported.meta.roomCount).toBe(1);
    expect(exported.rooms).toEqual([{
      roomId: 'math',
      source: {
        name: 'Math',
        description: 'Numbers and proofs.',
        topic: 'STEM'
      },
      existing: {
        name: 'Математика'
      },
      missingFields: ['description', 'topic'],
      translation: {}
    }]);
  });

  it('parses both supported translation payload shapes', () => {
    expect(parseRoomTranslationFilePayload({
      physics: { name: 'Физика' }
    })).toEqual({
      physics: { name: 'Физика' }
    });

    expect(parseRoomTranslationFilePayload({
      rooms: [{
        roomId: 'math',
        translation: { name: 'Математика' }
      }]
    })).toEqual({
      math: { name: 'Математика' }
    });
  });
});
