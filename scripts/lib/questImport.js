import mongoose from 'mongoose';
import Quest from '../../server/db/models/Quest.js';
import QuestItem from '../../server/db/models/QuestItem.js';
import User from '../../server/db/models/User.js';
import Room from '../../server/db/models/Room.js';

const MANIFEST_FIELDS = new Set([
  'slug',
  'type',
  'status',
  'name_i18n',
  'description_i18n',
  'instructions_i18n',
  'administratorUsername',
  'allowedRoomIds',
  'defaultRoomId',
  'badgeAssetPath',
  'acceptingSubmissionsAfterCompletion',
  'reservationDurationHours',
  'medalThresholds',
  'targetCount',
  'itemsFile'
]);

const QUEST_DEFINITION_FIELDS = [
  'name_i18n',
  'description_i18n',
  'instructions_i18n',
  'administratorUserId',
  'allowedRoomIds',
  'defaultRoomId',
  'badgeAssetPath',
  'acceptingSubmissionsAfterCompletion',
  'reservationDurationHours',
  'medalThresholds',
  'targetCount'
];

function normalizeObject(value) {
  if (value instanceof Map) return Object.fromEntries(value);
  if (Array.isArray(value)) return value.map(normalizeObject);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalizeObject(child)])
    );
  }
  return value;
}

function valuesEqual(left, right) {
  return JSON.stringify(normalizeObject(left)) === JSON.stringify(normalizeObject(right));
}

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

export function questItemKey(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeQuestItems(payload) {
  if (!Array.isArray(payload)) throw new Error('Quest items must be a JSON array.');

  const items = payload.map((entry, index) => {
    const source = typeof entry === 'string' ? { label: entry } : entry;
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new Error(`Quest item ${index + 1} must be a string or object.`);
    }

    const label = requireText(source.label || source.label_i18n?.en, `Quest item ${index + 1} label`);
    const key = questItemKey(source.key || label);
    if (!key) throw new Error(`Quest item ${index + 1} does not produce a valid key.`);

    const unknown = Object.keys(source).filter(field => !['key', 'label', 'label_i18n'].includes(field));
    if (unknown.length) throw new Error(`Quest item ${key} has unknown field(s): ${unknown.join(', ')}.`);

    return {
      key,
      label,
      ...(source.label_i18n === undefined ? {} : { label_i18n: source.label_i18n })
    };
  });

  const duplicates = items.filter((item, index) => items.findIndex(other => other.key === item.key) !== index);
  if (duplicates.length) {
    throw new Error(`Duplicate quest item key(s): ${[...new Set(duplicates.map(item => item.key))].join(', ')}.`);
  }
  return items;
}

export function validateQuestManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Quest manifest must be a JSON object.');
  }
  const unknown = Object.keys(manifest).filter(field => !MANIFEST_FIELDS.has(field));
  if (unknown.length) throw new Error(`Quest manifest has unknown field(s): ${unknown.join(', ')}.`);

  requireText(manifest.slug, 'slug');
  requireText(manifest.administratorUsername, 'administratorUsername');
  requireText(manifest.badgeAssetPath, 'badgeAssetPath');
  requireText(manifest.defaultRoomId, 'defaultRoomId');
  if (!Array.isArray(manifest.allowedRoomIds) || !manifest.allowedRoomIds.length) {
    throw new Error('allowedRoomIds must be a non-empty array.');
  }
  if (!['count', 'set'].includes(manifest.type)) throw new Error('type must be "count" or "set".');
  if (manifest.type === 'set' && !manifest.itemsFile) throw new Error('Set quests require itemsFile.');
  if (manifest.type === 'count' && manifest.itemsFile) throw new Error('Count quests cannot define itemsFile.');
  return manifest;
}

function changedFields(existing, desired, fields) {
  return fields.filter(field => !valuesEqual(existing?.[field], desired[field]));
}

export function buildQuestImportPlan({ existingQuest, existingItems = [], definition, items = [], syncStatus = false }) {
  if (existingQuest && existingQuest.type !== definition.type) {
    throw new Error(`Cannot change quest type from ${existingQuest.type} to ${definition.type}.`);
  }

  const questFields = [...QUEST_DEFINITION_FIELDS];
  if (!existingQuest || syncStatus) questFields.push('status');
  const questChanges = existingQuest ? changedFields(existingQuest, definition, questFields) : questFields;
  const existingByKey = new Map(existingItems.map(item => [item.key, item]));
  const itemChanges = items.map((item) => {
    const existing = existingByKey.get(item.key);
    if (!existing) return { action: 'create', item, changedFields: ['label', ...(item.label_i18n ? ['label_i18n'] : [])] };
    const fields = ['label', ...(item.label_i18n === undefined ? [] : ['label_i18n'])];
    const changed = changedFields(existing, item, fields);
    return { action: changed.length ? 'update' : 'unchanged', item, existing, changedFields: changed };
  });

  return {
    questAction: !existingQuest ? 'create' : questChanges.length ? 'update' : 'unchanged',
    questChangedFields: questChanges,
    itemCreates: itemChanges.filter(change => change.action === 'create').length,
    itemUpdates: itemChanges.filter(change => change.action === 'update').length,
    itemUnchanged: itemChanges.filter(change => change.action === 'unchanged').length,
    itemChanges
  };
}

async function resolveDefinition(manifest, { session, models }) {
  const administrator = await models.User.findOne(
    { username: manifest.administratorUsername },
    { _id: 1 },
    { session }
  ).lean();
  if (!administrator) throw new Error(`Administrator user not found: ${manifest.administratorUsername}.`);

  const roomIds = [...new Set(manifest.allowedRoomIds || [])];
  const rooms = await models.Room.find({ _id: { $in: roomIds } }, { _id: 1 }, { session }).lean();
  const foundRooms = new Set(rooms.map(room => String(room._id)));
  const missingRooms = roomIds.filter(roomId => !foundRooms.has(roomId));
  if (missingRooms.length) throw new Error(`Room(s) not found: ${missingRooms.join(', ')}.`);

  const definition = {
    slug: manifest.slug,
    type: manifest.type,
    status: manifest.status || 'draft',
    name_i18n: manifest.name_i18n,
    description_i18n: manifest.description_i18n,
    instructions_i18n: manifest.instructions_i18n,
    administratorUserId: String(administrator._id),
    allowedRoomIds: manifest.allowedRoomIds,
    defaultRoomId: manifest.defaultRoomId,
    badgeAssetPath: manifest.badgeAssetPath,
    acceptingSubmissionsAfterCompletion: manifest.acceptingSubmissionsAfterCompletion ?? false,
    reservationDurationHours: manifest.reservationDurationHours ?? 168,
    medalThresholds: manifest.medalThresholds ?? { bronze: 0.25, silver: 0.5, gold: 0.75 },
    ...(manifest.type === 'count' ? { targetCount: manifest.targetCount } : {})
  };
  await new models.Quest(definition).validate();
  return definition;
}

async function prepareImport({ manifest, items, syncStatus, session, models }) {
  const definition = await resolveDefinition(manifest, { session, models });
  const existingQuest = await models.Quest.findOne({ slug: definition.slug }, null, { session }).lean();
  const existingItems = existingQuest && definition.type === 'set'
    ? await models.QuestItem.find({ questId: String(existingQuest._id) }, null, { session }).lean()
    : [];
  const plan = buildQuestImportPlan({ existingQuest, existingItems, definition, items, syncStatus });
  return { definition, existingQuest, plan };
}

export async function importQuest({
  manifest,
  items = [],
  write = false,
  syncStatus = false,
  models = { Quest, QuestItem, User, Room },
  mongooseInstance = mongoose
}) {
  validateQuestManifest(manifest);
  const normalizedItems = manifest.type === 'set' ? normalizeQuestItems(items) : [];

  if (!write) {
    const prepared = await prepareImport({ manifest, items: normalizedItems, syncStatus, session: null, models });
    return prepared.plan;
  }

  const session = await mongooseInstance.startSession();
  let finalPlan;
  try {
    await session.withTransaction(async () => {
      const prepared = await prepareImport({ manifest, items: normalizedItems, syncStatus, session, models });
      const { definition, existingQuest, plan } = prepared;
      finalPlan = plan;
      let questId = existingQuest?._id;

      if (!existingQuest) {
        const [created] = await models.Quest.create([definition], { session });
        questId = created._id;
      } else if (plan.questAction === 'update') {
        const update = Object.fromEntries(plan.questChangedFields.map(field => [field, definition[field]]));
        await models.Quest.updateOne({ _id: existingQuest._id }, { $set: update }, { session, runValidators: true });
      }

      const operations = plan.itemChanges
        .filter(change => change.action !== 'unchanged')
        .map((change) => change.action === 'create' ? {
          insertOne: { document: { questId: String(questId), ...change.item } }
        } : {
          updateOne: {
            filter: { _id: change.existing._id },
            update: { $set: Object.fromEntries(change.changedFields.map(field => [field, change.item[field]])) }
          }
        });
      if (operations.length) await models.QuestItem.bulkWrite(operations, { session });
    });
    return finalPlan;
  } finally {
    await session.endSession();
  }
}
