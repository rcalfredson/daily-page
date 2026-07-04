import {
  buildQuestImportPlan,
  normalizeQuestItems,
  questItemKey,
  validateQuestManifest
} from '../scripts/lib/questImport.js';

function manifest(overrides = {}) {
  return {
    slug: 'virtual-road-trip',
    type: 'set',
    administratorUsername: 'admin',
    allowedRoomIds: ['united-states'],
    defaultRoomId: 'united-states',
    badgeAssetPath: '/assets/img/quests/virtual-road-trip.svg',
    itemsFile: './items.json',
    ...overrides
  };
}

function definition(overrides = {}) {
  return {
    slug: 'virtual-road-trip',
    type: 'set',
    status: 'draft',
    name_i18n: { en: 'Virtual road trip' },
    description_i18n: { en: 'Visit every county.' },
    instructions_i18n: { en: 'Write about one county.' },
    administratorUserId: 'user-1',
    allowedRoomIds: ['united-states'],
    defaultRoomId: 'united-states',
    badgeAssetPath: '/assets/img/quests/virtual-road-trip.svg',
    acceptingSubmissionsAfterCompletion: false,
    reservationDurationHours: 168,
    medalThresholds: { bronze: 0.25, silver: 0.5, gold: 0.75 },
    ...overrides
  };
}

describe('quest import tooling', () => {
  it('generates stable item keys and accepts explicit translated items', () => {
    expect(questItemKey('  Côte-d’Or, FR  ')).toBe('cote-d-or-fr');
    expect(normalizeQuestItems([
      'Tioga, PA',
      { key: 'centre-pa', label: 'Centre, PA', label_i18n: { fr: 'Comté de Centre' } }
    ])).toEqual([
      { key: 'tioga-pa', label: 'Tioga, PA' },
      { key: 'centre-pa', label: 'Centre, PA', label_i18n: { fr: 'Comté de Centre' } }
    ]);
  });

  it('rejects duplicate generated or explicit item keys', () => {
    expect(() => normalizeQuestItems(['Tioga, PA', { key: 'tioga-pa', label: 'Elsewhere' }]))
      .toThrowError(/Duplicate quest item key.*tioga-pa/);
  });

  it('requires item files only for set quests and rejects manifest typos', () => {
    expect(() => validateQuestManifest(manifest({ accidentalField: true }))).toThrowError(/unknown field/);
    expect(() => validateQuestManifest(manifest({ type: 'count', targetCount: 10 })))
      .toThrowError(/cannot define itemsFile/);
    expect(() => validateQuestManifest(manifest({ itemsFile: undefined }))).toThrowError(/require itemsFile/);
  });

  it('plans an idempotent re-import without altering workflow-only item fields', () => {
    const desired = definition();
    const existingQuest = { _id: 'quest-1', ...desired };
    const existingItems = [{
      _id: 'item-1',
      questId: 'quest-1',
      key: 'tioga-pa',
      label: 'Tioga, PA',
      active: false,
      reservedByUserId: 'user-2',
      activeSubmissionId: 'submission-1'
    }];
    const plan = buildQuestImportPlan({
      existingQuest,
      existingItems,
      definition: desired,
      items: [{ key: 'tioga-pa', label: 'Tioga, PA' }]
    });

    expect(plan.questAction).toBe('unchanged');
    expect(plan.itemUnchanged).toBe(1);
    expect(plan.itemUpdates).toBe(0);
    expect(plan.itemChanges[0].changedFields).toEqual([]);
  });

  it('preserves an existing lifecycle status unless status sync is requested', () => {
    const desired = definition({ status: 'active' });
    const existingQuest = { _id: 'quest-1', ...desired, status: 'completed' };

    const safePlan = buildQuestImportPlan({ existingQuest, definition: desired });
    const syncPlan = buildQuestImportPlan({ existingQuest, definition: desired, syncStatus: true });

    expect(safePlan.questAction).toBe('unchanged');
    expect(safePlan.questChangedFields).not.toContain('status');
    expect(syncPlan.questChangedFields).toContain('status');
  });

  it('updates only imported item presentation fields and never removes omitted items', () => {
    const desired = definition();
    const plan = buildQuestImportPlan({
      existingQuest: { _id: 'quest-1', ...desired },
      definition: desired,
      existingItems: [
        { _id: 'item-1', key: 'tioga-pa', label: 'Old label', active: true },
        { _id: 'item-2', key: 'omitted', label: 'Omitted', active: true }
      ],
      items: [{ key: 'tioga-pa', label: 'Tioga, PA' }]
    });

    expect(plan.itemUpdates).toBe(1);
    expect(plan.itemChanges).toHaveSize(1);
    expect(plan.itemChanges[0].changedFields).toEqual(['label']);
  });
});
