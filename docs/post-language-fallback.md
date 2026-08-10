# Post language fallback

Daily Page uses the existing `Block.groupId` translation family and
`Block.originalBlock` source relationship. It does not create a second
translation model.

The canonical source block stores the family-level fields:

- `sourceLanguage` (one of the 25 supported locale codes)
- `audienceScope` (`global`, `regional`, `local`, or `personal`)
- `translationPriority` (`high`, `normal`, or `low`)

Translations reference that record through `originalBlock` and do not copy
these fields. New source posts default their source language to their submitted
content language, their audience scope to `global`, and their translation
priority to `normal`. The existing advanced language selector supplies the
creation language. Translations are normalized to the family's canonical
source even when the editor starts from another translation URL.

## Backfill

The backfill is dry-run only unless `--write` is explicitly supplied:

```sh
npm run block-language:backfill
npm run block-language:backfill -- --write
```

Add `--prod` only when intentionally targeting the production database. The
script groups all blocks by `groupId`, prefers a single source record referenced
by `originalBlock`, otherwise accepts one unreferenced record, and uses that
record's actual `lang` as `sourceLanguage`. It reports and skips unsupported or
duplicate languages, multiple referenced sources, multiple unreferenced source
records, missing sources, and conflicting existing source metadata. Its writes
are idempotent `$set`/`$unset` operations and it is safe to rerun.

## Selection and SEO

`resolvePostTranslation` is the compatibility boundary for both migrated and
legacy families. It selects the requested locale when present and otherwise the
canonical source. Damaged families use oldest-creation-time then block-ID order
and emit structured diagnostics rather than depending on MongoDB result order.

Concrete article URLs remain canonical and article `hreflang` contains only
real public variants. The language-independent `/posts/:groupId` URL remains
the `x-default` resolver. This repository has no sitemap generator; therefore
there was no localized sitemap path to change.

## Editor follow-up

Schema, defaults, validation, API input, and migration support exist for
`audienceScope` and `translationPriority`. They are intentionally not exposed
as new controls in the authoring UI yet; adding those two editorial controls is
a small, separate product decision rather than part of language selection.
