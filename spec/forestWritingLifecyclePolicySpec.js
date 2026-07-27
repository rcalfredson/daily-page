import {
  FOREST_WRITING_LIFECYCLE_ACTIONS,
  FOREST_WRITING_LIFECYCLE_EVENTS,
  classifyForestWritingLifecycle
} from '../server/services/forestWritingLifecyclePolicy.js';

function classify(event, facts = {}) {
  return classifyForestWritingLifecycle({ event, ...facts });
}

describe('forest writing lifecycle policy', () => {
  it('creates the first owner-group tree and joins later owner variants', () => {
    const created = classify(
      FOREST_WRITING_LIFECYCLE_EVENTS.OWNER_VARIANT_CREATED,
      { treeExists: false }
    );
    const joined = classify(
      FOREST_WRITING_LIFECYCLE_EVENTS.OWNER_VARIANT_CREATED,
      { treeExists: true }
    );

    expect(created).toEqual({
      policyVersion: 1,
      supported: true,
      action: FOREST_WRITING_LIFECYCLE_ACTIONS.CREATE_OWNER_GROUP_TREE,
      treeIdentity: 'create',
      projection: 'capture',
      placement: 'reserve',
      inspection: 'refresh',
      tombstone: 'none'
    });
    expect(joined).toEqual(jasmine.objectContaining({
      action: FOREST_WRITING_LIFECYCLE_ACTIONS.JOIN_EXISTING_OWNER_GROUP_TREE,
      treeIdentity: 'preserve',
      projection: 'preserve',
      placement: 'preserve',
      inspection: 'refresh'
    }));
  });

  it('keeps foreign translations and ordinary writing changes out of tree identity', () => {
    const foreign = classify(FOREST_WRITING_LIFECYCLE_EVENTS.FOREIGN_VARIANT_CHANGED);
    const edited = classify(FOREST_WRITING_LIFECYCLE_EVENTS.ORDINARY_WRITING_CHANGED);

    expect(foreign).toEqual(jasmine.objectContaining({
      action: FOREST_WRITING_LIFECYCLE_ACTIONS.REFRESH_INSPECTION_VARIANTS,
      treeIdentity: 'preserve',
      projection: 'preserve',
      placement: 'preserve',
      inspection: 'refresh'
    }));
    expect(edited).toEqual(jasmine.objectContaining({
      action: FOREST_WRITING_LIFECYCLE_ACTIONS.PRESERVE_TREE,
      treeIdentity: 'preserve',
      projection: 'preserve',
      placement: 'preserve',
      inspection: 'refresh'
    }));
  });

  it('preserves the tree until its last eligible owner variant is deleted', () => {
    const retained = classify(
      FOREST_WRITING_LIFECYCLE_EVENTS.OWNER_VARIANT_DELETED,
      { hasRemainingEligibleOwnerVariant: true }
    );
    const deactivated = classify(
      FOREST_WRITING_LIFECYCLE_EVENTS.OWNER_VARIANT_DELETED,
      { hasRemainingEligibleOwnerVariant: false }
    );

    expect(retained).toEqual(jasmine.objectContaining({
      action: FOREST_WRITING_LIFECYCLE_ACTIONS.PRESERVE_TREE,
      placement: 'preserve',
      tombstone: 'preserve'
    }));
    expect(deactivated).toEqual(jasmine.objectContaining({
      action: FOREST_WRITING_LIFECYCLE_ACTIONS.DEACTIVATE_TREE,
      treeIdentity: 'preserve',
      projection: 'preserve',
      placement: 'reserve',
      inspection: 'remove',
      tombstone: 'create-or-preserve'
    }));
  });

  it('reactivates the same logical identity but creates a new tree for new identity', () => {
    const restored = classify(
      FOREST_WRITING_LIFECYCLE_EVENTS.OWNER_VARIANT_RESTORED,
      { restoresSameLogicalIdentity: true }
    );
    const recreated = classify(
      FOREST_WRITING_LIFECYCLE_EVENTS.OWNER_VARIANT_RESTORED,
      { restoresSameLogicalIdentity: false }
    );

    expect(restored).toEqual(jasmine.objectContaining({
      action: FOREST_WRITING_LIFECYCLE_ACTIONS.REACTIVATE_TREE,
      treeIdentity: 'preserve',
      projection: 'preserve',
      placement: 'restore-reservation',
      tombstone: 'preserve-minimal'
    }));
    expect(recreated).toEqual(jasmine.objectContaining({
      action: FOREST_WRITING_LIFECYCLE_ACTIONS.CREATE_NEW_TREE,
      treeIdentity: 'create',
      projection: 'capture',
      placement: 'reserve',
      tombstone: 'none'
    }));
  });

  it('makes hide and unhide whole-tree reversible curation actions', () => {
    const hidden = classify(FOREST_WRITING_LIFECYCLE_EVENTS.OWNER_GROUP_HIDDEN);
    const unhidden = classify(FOREST_WRITING_LIFECYCLE_EVENTS.OWNER_GROUP_UNHIDDEN);

    expect(hidden).toEqual(jasmine.objectContaining({
      action: FOREST_WRITING_LIFECYCLE_ACTIONS.APPLY_HIDE,
      treeIdentity: 'preserve',
      placement: 'reserve',
      inspection: 'hide'
    }));
    expect(unhidden).toEqual(jasmine.objectContaining({
      action: FOREST_WRITING_LIFECYCLE_ACTIONS.REMOVE_HIDE,
      treeIdentity: 'preserve',
      placement: 'restore-reservation',
      inspection: 'refresh'
    }));
  });

  it('separates personal relocation from ecological reprojection', () => {
    const moved = classify(FOREST_WRITING_LIFECYCLE_EVENTS.PERSONAL_TREE_RELOCATED);
    const reprojected = classify(
      FOREST_WRITING_LIFECYCLE_EVENTS.ECOLOGICAL_REPROJECTION_REQUESTED
    );

    expect(moved).toEqual(jasmine.objectContaining({
      action: FOREST_WRITING_LIFECYCLE_ACTIONS.APPLY_PERSONAL_RELOCATION,
      projection: 'preserve',
      placement: 'replace-personal-location'
    }));
    expect(reprojected).toEqual(jasmine.objectContaining({
      action: FOREST_WRITING_LIFECYCLE_ACTIONS.REQUIRE_EXPLICIT_REPROJECTION,
      treeIdentity: 'preserve',
      projection: 'versioned-replacement',
      placement: 'explicit-migration-decision'
    }));
  });

  it('rejects group identity mutation and unknown lifecycle events', () => {
    expect(classify(FOREST_WRITING_LIFECYCLE_EVENTS.GROUP_ID_MUTATION_ATTEMPTED))
      .toEqual(jasmine.objectContaining({
        supported: false,
        action: FOREST_WRITING_LIFECYCLE_ACTIONS.REJECT_PROHIBITED_GROUP_MUTATION,
        treeIdentity: 'preserve',
        projection: 'preserve',
        placement: 'preserve'
      }));
    expect(classify('future-silent-reinterpretation')).toEqual(jasmine.objectContaining({
      supported: false,
      action: FOREST_WRITING_LIFECYCLE_ACTIONS.REJECT_UNSUPPORTED_EVENT
    }));
  });

  it('requires exact event-specific authorized facts', () => {
    expect(() => classify(
      FOREST_WRITING_LIFECYCLE_EVENTS.OWNER_VARIANT_DELETED
    )).toThrowError(/hasRemainingEligibleOwnerVariant/);
    expect(() => classify(
      FOREST_WRITING_LIFECYCLE_EVENTS.OWNER_VARIANT_DELETED,
      { hasRemainingEligibleOwnerVariant: 1 }
    )).toThrowError(/must be boolean/);
    expect(() => classify(
      FOREST_WRITING_LIFECYCLE_EVENTS.ORDINARY_WRITING_CHANGED,
      { treeExists: true }
    )).toThrowError(/unused fields: treeExists/);
    expect(() => classify(
      FOREST_WRITING_LIFECYCLE_EVENTS.OWNER_VARIANT_CREATED,
      { treeExists: false, sourceBody: 'private writing' }
    )).toThrowError(/unsupported fields: sourceBody/);
  });

  it('is deterministic and exactly JSON serializable', () => {
    const input = {
      event: FOREST_WRITING_LIFECYCLE_EVENTS.OWNER_VARIANT_DELETED,
      hasRemainingEligibleOwnerVariant: false
    };
    const first = classifyForestWritingLifecycle(input);
    const repeated = classifyForestWritingLifecycle({ ...input });

    expect(repeated).toEqual(first);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });
});
