export const FOREST_WRITING_LIFECYCLE_POLICY_VERSION = 1;

export const FOREST_WRITING_LIFECYCLE_EVENTS = Object.freeze({
  OWNER_VARIANT_CREATED: 'owner-variant-created',
  FOREIGN_VARIANT_CHANGED: 'foreign-variant-changed',
  ORDINARY_WRITING_CHANGED: 'ordinary-writing-changed',
  OWNER_VARIANT_DELETED: 'owner-variant-deleted',
  OWNER_VARIANT_RESTORED: 'owner-variant-restored',
  OWNER_GROUP_HIDDEN: 'owner-group-hidden',
  OWNER_GROUP_UNHIDDEN: 'owner-group-unhidden',
  PERSONAL_TREE_RELOCATED: 'personal-tree-relocated',
  ECOLOGICAL_REPROJECTION_REQUESTED: 'ecological-reprojection-requested',
  GROUP_ID_MUTATION_ATTEMPTED: 'group-id-mutation-attempted'
});

export const FOREST_WRITING_LIFECYCLE_ACTIONS = Object.freeze({
  CREATE_OWNER_GROUP_TREE: 'create-owner-group-tree',
  JOIN_EXISTING_OWNER_GROUP_TREE: 'join-existing-owner-group-tree',
  REFRESH_INSPECTION_VARIANTS: 'refresh-inspection-variants',
  PRESERVE_TREE: 'preserve-tree',
  DEACTIVATE_TREE: 'deactivate-tree',
  REACTIVATE_TREE: 'reactivate-tree',
  CREATE_NEW_TREE: 'create-new-tree',
  APPLY_HIDE: 'apply-hide',
  REMOVE_HIDE: 'remove-hide',
  APPLY_PERSONAL_RELOCATION: 'apply-personal-relocation',
  REQUIRE_EXPLICIT_REPROJECTION: 'require-explicit-reprojection',
  REJECT_PROHIBITED_GROUP_MUTATION: 'reject-prohibited-group-mutation',
  REJECT_UNSUPPORTED_EVENT: 'reject-unsupported-event'
});

const INPUT_FIELDS = Object.freeze([
  'event', 'treeExists', 'hasRemainingEligibleOwnerVariant', 'restoresSameLogicalIdentity'
]);
const EVENT_SET = new Set(Object.values(FOREST_WRITING_LIFECYCLE_EVENTS));

function exactObject(value, allowedFields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const extra = Object.keys(value).filter(field => !allowedFields.includes(field));
  if (extra.length) throw new Error(`${label} contains unsupported fields: ${extra.join(', ')}.`);
}

function requireBoolean(input, field, event) {
  if (typeof input[field] !== 'boolean') {
    throw new Error(`${field} must be boolean for ${event}.`);
  }
}

function forbidUnusedFacts(input, usedFields) {
  const unused = Object.keys(input).filter(field => field !== 'event' && !usedFields.includes(field));
  if (unused.length) {
    throw new Error(`Forest writing lifecycle input has unused fields: ${unused.join(', ')}.`);
  }
}

function result(action, {
  treeIdentity = 'preserve',
  projection = 'preserve',
  placement = 'preserve',
  inspection = 'preserve',
  tombstone = 'preserve',
  supported = true
} = {}) {
  return {
    policyVersion: FOREST_WRITING_LIFECYCLE_POLICY_VERSION,
    supported,
    action,
    treeIdentity,
    projection,
    placement,
    inspection,
    tombstone
  };
}

export function classifyForestWritingLifecycle(input) {
  exactObject(input, INPUT_FIELDS, 'Forest writing lifecycle input');
  if (typeof input.event !== 'string' || !input.event.length || input.event.length > 80) {
    throw new Error('event must be a non-empty string of at most 80 characters.');
  }
  if (!EVENT_SET.has(input.event)) {
    forbidUnusedFacts(input, []);
    return result(FOREST_WRITING_LIFECYCLE_ACTIONS.REJECT_UNSUPPORTED_EVENT, {
      supported: false
    });
  }

  switch (input.event) {
    case FOREST_WRITING_LIFECYCLE_EVENTS.OWNER_VARIANT_CREATED:
      forbidUnusedFacts(input, ['treeExists']);
      requireBoolean(input, 'treeExists', input.event);
      return input.treeExists
        ? result(FOREST_WRITING_LIFECYCLE_ACTIONS.JOIN_EXISTING_OWNER_GROUP_TREE, {
          inspection: 'refresh'
        })
        : result(FOREST_WRITING_LIFECYCLE_ACTIONS.CREATE_OWNER_GROUP_TREE, {
          treeIdentity: 'create',
          projection: 'capture',
          placement: 'reserve',
          inspection: 'refresh',
          tombstone: 'none'
        });

    case FOREST_WRITING_LIFECYCLE_EVENTS.FOREIGN_VARIANT_CHANGED:
      forbidUnusedFacts(input, []);
      return result(FOREST_WRITING_LIFECYCLE_ACTIONS.REFRESH_INSPECTION_VARIANTS, {
        inspection: 'refresh'
      });

    case FOREST_WRITING_LIFECYCLE_EVENTS.ORDINARY_WRITING_CHANGED:
      forbidUnusedFacts(input, []);
      return result(FOREST_WRITING_LIFECYCLE_ACTIONS.PRESERVE_TREE, {
        inspection: 'refresh'
      });

    case FOREST_WRITING_LIFECYCLE_EVENTS.OWNER_VARIANT_DELETED:
      forbidUnusedFacts(input, ['hasRemainingEligibleOwnerVariant']);
      requireBoolean(input, 'hasRemainingEligibleOwnerVariant', input.event);
      return input.hasRemainingEligibleOwnerVariant
        ? result(FOREST_WRITING_LIFECYCLE_ACTIONS.PRESERVE_TREE, {
          inspection: 'refresh'
        })
        : result(FOREST_WRITING_LIFECYCLE_ACTIONS.DEACTIVATE_TREE, {
          placement: 'reserve',
          inspection: 'remove',
          tombstone: 'create-or-preserve'
        });

    case FOREST_WRITING_LIFECYCLE_EVENTS.OWNER_VARIANT_RESTORED:
      forbidUnusedFacts(input, ['restoresSameLogicalIdentity']);
      requireBoolean(input, 'restoresSameLogicalIdentity', input.event);
      return input.restoresSameLogicalIdentity
        ? result(FOREST_WRITING_LIFECYCLE_ACTIONS.REACTIVATE_TREE, {
          placement: 'restore-reservation',
          inspection: 'refresh',
          tombstone: 'preserve-minimal'
        })
        : result(FOREST_WRITING_LIFECYCLE_ACTIONS.CREATE_NEW_TREE, {
          treeIdentity: 'create',
          projection: 'capture',
          placement: 'reserve',
          inspection: 'refresh',
          tombstone: 'none'
        });

    case FOREST_WRITING_LIFECYCLE_EVENTS.OWNER_GROUP_HIDDEN:
      forbidUnusedFacts(input, []);
      return result(FOREST_WRITING_LIFECYCLE_ACTIONS.APPLY_HIDE, {
        placement: 'reserve',
        inspection: 'hide'
      });

    case FOREST_WRITING_LIFECYCLE_EVENTS.OWNER_GROUP_UNHIDDEN:
      forbidUnusedFacts(input, []);
      return result(FOREST_WRITING_LIFECYCLE_ACTIONS.REMOVE_HIDE, {
        placement: 'restore-reservation',
        inspection: 'refresh'
      });

    case FOREST_WRITING_LIFECYCLE_EVENTS.PERSONAL_TREE_RELOCATED:
      forbidUnusedFacts(input, []);
      return result(FOREST_WRITING_LIFECYCLE_ACTIONS.APPLY_PERSONAL_RELOCATION, {
        placement: 'replace-personal-location'
      });

    case FOREST_WRITING_LIFECYCLE_EVENTS.ECOLOGICAL_REPROJECTION_REQUESTED:
      forbidUnusedFacts(input, []);
      return result(FOREST_WRITING_LIFECYCLE_ACTIONS.REQUIRE_EXPLICIT_REPROJECTION, {
        projection: 'versioned-replacement',
        placement: 'explicit-migration-decision'
      });

    case FOREST_WRITING_LIFECYCLE_EVENTS.GROUP_ID_MUTATION_ATTEMPTED:
      forbidUnusedFacts(input, []);
      return result(FOREST_WRITING_LIFECYCLE_ACTIONS.REJECT_PROHIBITED_GROUP_MUTATION, {
        supported: false
      });

    default:
      return result(FOREST_WRITING_LIFECYCLE_ACTIONS.REJECT_UNSUPPORTED_EVENT, {
        supported: false
      });
  }
}
