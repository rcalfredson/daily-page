import {
  considerForestOwnerVariant,
  createForestOwnerVariantSelectionState,
  finalizeForestOwnerVariantSelection,
  FOREST_OWNER_VARIANT_DISPLAY_REASONS,
  FOREST_OWNER_VARIANT_FOUNDING_REASONS,
  selectForestOwnerVariants
} from '../server/services/forestOwnerVariantSelection.js';

const OWNER_ID = '64b000000000000000000001';
const FOREIGN_OWNER_ID = '64b000000000000000000002';
const GROUP_ID = '66b000000000000000000001';

function variant(ordinal, overrides = {}) {
  return {
    blockId: `65b0000000000000000000${String(ordinal).padStart(2, '0')}`,
    ownerUserId: OWNER_ID,
    translationGroupId: GROUP_ID,
    authorshipState: 'live',
    lang: 'en',
    status: 'locked',
    visibility: 'public',
    createdAt: new Date(`2026-04-${String(ordinal).padStart(2, '0')}T00:00:00.000Z`)
      .toISOString(),
    roomId: 'history',
    ...overrides
  };
}

describe('Activity Forest owner founding and display variant selection', () => {
  it('uses the earliest owner variant as historical founder and preferred owner language for display', () => {
    const english = variant(4, { lang: 'en' });
    const spanish = variant(8, { lang: 'es' });

    const selection = selectForestOwnerVariants({
      ownerUserId: OWNER_ID,
      translationGroupId: GROUP_ID,
      preferredContentLang: 'es',
      variants: [spanish, english]
    });

    expect(selection.foundingVariant.blockId).toBe(english.blockId);
    expect(selection.foundingReason).toBe(
      FOREST_OWNER_VARIANT_FOUNDING_REASONS.HISTORICAL_EARLIEST_OWNER_VARIANT
    );
    expect(selection.displayVariant.blockId).toBe(spanish.blockId);
    expect(selection.displayReason).toBe(
      FOREST_OWNER_VARIANT_DISPLAY_REASONS.PREFERRED_OWNER_LANGUAGE
    );
  });

  it('changes owner display language without changing historical founding selection', () => {
    const english = variant(4, { lang: 'en' });
    const spanish = variant(8, { lang: 'es' });
    const englishSelection = selectForestOwnerVariants({
      ownerUserId: OWNER_ID,
      translationGroupId: GROUP_ID,
      preferredContentLang: 'en',
      variants: [spanish, english]
    });
    const spanishSelection = selectForestOwnerVariants({
      ownerUserId: OWNER_ID,
      translationGroupId: GROUP_ID,
      preferredContentLang: 'es',
      variants: [spanish, english]
    });

    expect(englishSelection.foundingVariant.blockId).toBe(english.blockId);
    expect(spanishSelection.foundingVariant.blockId).toBe(english.blockId);
    expect(englishSelection.displayVariant.blockId).toBe(english.blockId);
    expect(spanishSelection.displayVariant.blockId).toBe(spanish.blockId);
  });

  it('uses stable Block identity to break an identical founding timestamp tie', () => {
    const laterId = variant(8, {
      createdAt: '2026-04-04T00:00:00.000Z'
    });
    const earlierId = variant(4, {
      createdAt: '2026-04-04T00:00:00.000Z'
    });

    const selection = selectForestOwnerVariants({
      ownerUserId: OWNER_ID,
      translationGroupId: GROUP_ID,
      preferredContentLang: 'fr',
      variants: [laterId, earlierId]
    });

    expect(selection.foundingVariant.blockId).toBe(earlierId.blockId);
    expect(selection.displayVariant.blockId).toBe(earlierId.blockId);
  });

  it('preserves captured founding identity while falling back among current owner variants', () => {
    const founding = variant(4, { lang: 'en' });
    const spanish = variant(8, { lang: 'es' });
    const french = variant(9, { lang: 'fr' });

    const preferred = selectForestOwnerVariants({
      ownerUserId: OWNER_ID,
      translationGroupId: GROUP_ID,
      preferredContentLang: 'es',
      capturedFoundingBlockId: founding.blockId,
      variants: [founding, spanish, french]
    });
    const foundingFallback = selectForestOwnerVariants({
      ownerUserId: OWNER_ID,
      translationGroupId: GROUP_ID,
      preferredContentLang: 'de',
      capturedFoundingBlockId: founding.blockId,
      variants: [french, founding]
    });
    const deletedFounderFallback = selectForestOwnerVariants({
      ownerUserId: OWNER_ID,
      translationGroupId: GROUP_ID,
      preferredContentLang: 'de',
      capturedFoundingBlockId: founding.blockId,
      variants: [french, spanish]
    });

    expect(preferred.displayVariant.blockId).toBe(spanish.blockId);
    expect(foundingFallback.displayVariant.blockId).toBe(founding.blockId);
    expect(foundingFallback.displayReason).toBe(
      FOREST_OWNER_VARIANT_DISPLAY_REASONS.FOUNDING_OWNER_VARIANT
    );
    expect(deletedFounderFallback.capturedFoundingBlockId).toBe(founding.blockId);
    expect(deletedFounderFallback.foundingVariant).toBeNull();
    expect(deletedFounderFallback.foundingSourceAvailable).toBeFalse();
    expect(deletedFounderFallback.displayVariant.blockId).toBe(spanish.blockId);
    expect(deletedFounderFallback.displayReason).toBe(
      FOREST_OWNER_VARIANT_DISPLAY_REASONS.EARLIEST_OWNER_FALLBACK
    );
  });

  it('produces the same result across page boundaries and input order', () => {
    const variants = [
      variant(9, { lang: 'fr' }),
      variant(4, { lang: 'en' }),
      variant(8, { lang: 'es' })
    ];
    const expected = selectForestOwnerVariants({
      ownerUserId: OWNER_ID,
      translationGroupId: GROUP_ID,
      preferredContentLang: 'es',
      variants
    });
    let state = createForestOwnerVariantSelectionState({
      ownerUserId: OWNER_ID,
      translationGroupId: GROUP_ID,
      preferredContentLang: 'es'
    });
    for (const page of [[variants[1]], [variants[0], variants[2]]]) {
      for (const item of page) state = considerForestOwnerVariant(state, item);
    }

    expect(finalizeForestOwnerVariantSelection(state)).toEqual(expected);
  });

  it('cannot use a foreign or retained translation as the owner-default display', () => {
    const state = createForestOwnerVariantSelectionState({
      ownerUserId: OWNER_ID,
      translationGroupId: GROUP_ID,
      preferredContentLang: 'es'
    });

    expect(() => considerForestOwnerVariant(state, variant(4, {
      ownerUserId: FOREIGN_OWNER_ID,
      lang: 'es'
    }))).toThrowError(/does not belong to the selected owner/);
    expect(() => considerForestOwnerVariant(state, variant(5, {
      authorshipState: 'deleted-author',
      lang: 'es'
    }))).toThrowError(/must have live authorship/);
  });

  it('returns an inactive selection when no eligible owner variant remains', () => {
    const selection = selectForestOwnerVariants({
      ownerUserId: OWNER_ID,
      translationGroupId: GROUP_ID,
      preferredContentLang: 'en',
      capturedFoundingBlockId: variant(4).blockId,
      variants: []
    });

    expect(selection.active).toBeFalse();
    expect(selection.foundingSourceAvailable).toBeFalse();
    expect(selection.displayVariant).toBeNull();
    expect(selection.displayReason).toBe(
      FOREST_OWNER_VARIANT_DISPLAY_REASONS.NO_OWNER_VARIANT
    );
  });
});
