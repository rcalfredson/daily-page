import {
  createForestEnvironmentManifest,
} from '../public/js/forest-environment.js';
import {
  buildForestOwnerTreeReconstructor,
  deriveForestOwnerTreeId,
  describeForestOwnerTreeContinuityChanges,
  ForestOwnerTreeReconstructionError,
  reconstructForestOwnerTree,
} from '../server/services/forestOwnerTreeReconstruction.js';
import {
  projectPostToForestTree,
} from '../server/services/forestPostTreeProjection.js';
import {
  selectForestOwnerVariants,
} from '../server/services/forestOwnerVariantSelection.js';

const OWNER_ID = '507f1f77bcf86cd799439011';
const GROUP_ID = '65e123456789abcdef012345';
const WORLD = Object.freeze({
  width: 3_200,
  height: 2_000,
  edgeMargin: 120,
});
const ENVIRONMENT_MANIFEST = createForestEnvironmentManifest({
  seed: 'owner-tree-reconstruction-spec',
  world: {
    width: WORLD.width,
    height: WORLD.height,
  },
});

function variant({
  blockId,
  createdAt,
  lang = 'en',
  roomId = 'daily',
  status = 'in-progress',
  visibility = 'public',
}) {
  return {
    blockId,
    ownerUserId: OWNER_ID,
    translationGroupId: GROUP_ID,
    authorshipState: 'live',
    createdAt,
    lang,
    roomId,
    status,
    visibility,
  };
}

function selection({
  variants,
  preferredLanguage = 'en',
  capturedFoundingBlockId = null,
  groupId = GROUP_ID,
}) {
  return selectForestOwnerVariants({
    ownerUserId: OWNER_ID,
    translationGroupId: groupId,
    preferredContentLang: preferredLanguage,
    capturedFoundingBlockId,
    variants: variants.map(item => ({
      ...item,
      translationGroupId: groupId,
    })),
  });
}

function reconstruct(ownerSelection, overrides = {}) {
  return reconstructForestOwnerTree({
    selection: ownerSelection,
    environmentManifest: ENVIRONMENT_MANIFEST,
    world: WORLD,
    ...overrides,
  });
}

describe('forest owner tree pure reconstruction proof', () => {
  const founder = variant({
    blockId: '65f000000000000000000001',
    createdAt: '2024-04-08T12:00:00.000Z',
    lang: 'en',
  });
  const translation = variant({
    blockId: '65f000000000000000000002',
    createdAt: '2024-10-21T12:00:00.000Z',
    lang: 'es',
  });

  it('is byte-for-byte deterministic when inputs and versions are unchanged', () => {
    const chosen = selection({ variants: [translation, founder] });

    const first = reconstruct(chosen);
    const second = reconstruct(chosen);

    expect(second).toEqual(first);
    expect(first.treeId).toMatch(/^writing-tree-[A-Za-z0-9_-]{22}$/);
    expect(JSON.stringify(first)).not.toContain(OWNER_ID);
    expect(JSON.stringify(first)).not.toContain(GROUP_ID);
  });

  it('keeps semantic tree identity stable across ordinary mutable source edits', () => {
    const before = reconstruct(selection({ variants: [founder] }));
    const after = reconstruct(selection({
      variants: [{
        ...founder,
        lang: 'fr',
        roomId: 'writing',
        status: 'locked',
        visibility: 'unlisted',
      }],
      preferredLanguage: 'fr',
    }));

    expect(after).toEqual(before);
    expect(describeForestOwnerTreeContinuityChanges(before, after)).toEqual([]);
  });

  it('lets display language change without changing the reconstructed tree', () => {
    const englishDisplay = selection({
      variants: [translation, founder],
      preferredLanguage: 'en',
    });
    const spanishDisplay = selection({
      variants: [translation, founder],
      preferredLanguage: 'es',
    });

    expect(englishDisplay.displayVariant.blockId).toBe(founder.blockId);
    expect(spanishDisplay.displayVariant.blockId).toBe(translation.blockId);
    expect(reconstruct(spanishDisplay)).toEqual(reconstruct(englishDisplay));
  });

  it('changes permanent traits when a founding date is corrected', () => {
    const before = reconstruct(selection({ variants: [founder] }));
    const after = reconstruct(selection({
      variants: [{
        ...founder,
        createdAt: '2024-10-08T12:00:00.000Z',
      }],
    }));
    const changes = describeForestOwnerTreeContinuityChanges(before, after);

    expect(after.treeId).toBe(before.treeId);
    expect(changes).toContain('permanent-traits');
    expect(changes).toContain('projection-identity');
  });

  it('changes placement when the placement algorithm version changes', () => {
    const chosen = selection({ variants: [founder] });
    const before = reconstruct(chosen, { placementVersion: 1 });
    const after = reconstruct(chosen, { placementVersion: 2 });
    const changes = describeForestOwnerTreeContinuityChanges(before, after);

    expect(after.treeId).toBe(before.treeId);
    expect(after.placement).not.toEqual(before.placement);
    expect(changes).toContain('placement');
    expect(changes).toContain('versions');
  });

  it('changes a purely derived tree id when the identity algorithm version changes', () => {
    const chosen = selection({ variants: [founder] });
    const before = reconstruct(chosen, { identityVersion: 1 });
    const after = reconstruct(chosen, { identityVersion: 2 });

    expect(after.treeId).not.toBe(before.treeId);
    expect(describeForestOwnerTreeContinuityChanges(before, after))
      .toContain('tree-identity');
  });

  it('changes habitat and projection when environment grammar changes', () => {
    const chosen = selection({ variants: [founder] });
    const neutralReconstructor = buildForestOwnerTreeReconstructor({
      environmentAt() {
        return {
          habitatId: 'neutral-grove',
          dominantRegionId: 'region-proof-a',
          groundSurfaceId: 'ground-grass',
          transition: { state: 'region' },
        };
      },
    });
    const rockyReconstructor = buildForestOwnerTreeReconstructor({
      environmentAt() {
        return {
          habitatId: 'rocky-edge',
          dominantRegionId: 'region-proof-b',
          groundSurfaceId: 'ground-rock',
          transition: { state: 'region' },
        };
      },
    });
    const input = {
      selection: chosen,
      environmentManifest: ENVIRONMENT_MANIFEST,
      world: WORLD,
    };
    const before = neutralReconstructor(input);
    const after = rockyReconstructor(input);
    const changes = describeForestOwnerTreeContinuityChanges(before, after);

    expect(changes).toContain('habitat');
    expect(changes).toContain('projection-identity');
  });

  it('changes semantic output when the projection mapping implementation changes', () => {
    const chosen = selection({ variants: [founder] });
    const mappingV2 = buildForestOwnerTreeReconstructor({
      projectTree(post, context) {
        const projected = projectPostToForestTree(post, context);

        return {
          ...projected,
          mappingVersion: 2,
          specimen: {
            ...projected.specimen,
            seed: (projected.specimen.seed + 1) >>> 0,
          },
          identity: {
            ...projected.identity,
            projectionFingerprint:
              `${projected.identity.projectionFingerprint}-mapping-v2`,
          },
        };
      },
    });
    const input = {
      selection: chosen,
      environmentManifest: ENVIRONMENT_MANIFEST,
      world: WORLD,
    };
    const before = reconstructForestOwnerTree(input);
    const after = mappingV2(input);
    const changes = describeForestOwnerTreeContinuityChanges(before, after);

    expect(after.treeId).toBe(before.treeId);
    expect(changes).toContain('specimen');
    expect(changes).toContain('projection-identity');
    expect(changes).toContain('versions');
  });

  it('cannot reconstruct a captured founder after that source Block disappears', () => {
    const afterDeletion = selection({
      variants: [translation],
      preferredLanguage: 'es',
      capturedFoundingBlockId: founder.blockId,
    });

    expect(() => reconstruct(afterDeletion)).toThrowError(
      ForestOwnerTreeReconstructionError,
    );
    expect(() => reconstruct(afterDeletion)).toThrowError(
      /founding traits cannot be reconstructed/,
    );

    try {
      reconstruct(afterDeletion);
    } catch (error) {
      expect(error.code).toBe('CAPTURED_FOUNDER_UNAVAILABLE');
    }
  });

  it('silently replaces founding traits after deletion when no founder was captured', () => {
    const before = reconstruct(selection({
      variants: [founder, translation],
    }));
    const after = reconstruct(selection({
      variants: [translation],
      preferredLanguage: 'es',
    }));
    const changes = describeForestOwnerTreeContinuityChanges(before, after);

    expect(after.treeId).toBe(before.treeId);
    expect(changes).toContain('permanent-traits');
    expect(changes).toContain('projection-identity');
  });

  it('can label an already-known group inactive but cannot discover its tombstone', () => {
    const inactive = reconstruct(selection({ variants: [] }));

    expect(inactive).toEqual({
      reconstructionVersion: 1,
      status: 'inactive',
      treeId: deriveForestOwnerTreeId({
        ownerUserId: OWNER_ID,
        groupId: GROUP_ID,
      }),
      identityVersion: 1,
      limitation:
        'Pure reconstruction can report inactivity only when the former owner/group identity is already known.',
    });
  });

  it('preserves identity for a same-group restore but not a new-group recreation', () => {
    const before = reconstruct(selection({ variants: [founder] }));
    const restored = reconstruct(selection({
      variants: [{
        ...founder,
        blockId: '65f000000000000000000099',
      }],
    }));
    const recreated = reconstruct(selection({
      variants: [founder],
      groupId: '65e123456789abcdef099999',
    }));

    expect(restored.treeId).toBe(before.treeId);
    expect(restored.projection).toEqual(before.projection);
    expect(recreated.treeId).not.toBe(before.treeId);
  });
});
