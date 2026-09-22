# Managing reading trails

Reading trails live in MongoDB. JSON manifests are temporary, validated transfer
documents for creating or updating those records; they are not the runtime or
editorial source of truth. Do not edit trail records directly in MongoDB, because
that bypasses schema validation, publication-readiness checks, dry-run previews,
and transactional writes.

The repository contains a content-neutral template at
`config/reading-trails/example-reading-trail.json`. Copy it to a temporary or
untracked file, replace every example value, import it, and then discard the
content-specific file. Do not replace the example with production content.

## Manifest fields

- `slug` is the stable, URL-safe identity used to upsert a trail. Keep it after
  publication; changing it creates a different trail instead of renaming one.
- `status` is either `draft` or `published`. Only published trails can appear on
  the site.
- `sourceLanguage` identifies the language in which the trail was authored.
- `publishedLocales` explicitly controls which complete locale editions are
  public.
- `title_i18n` and `description_i18n` contain locale-keyed trail metadata.
- `items` orders language-independent post families by `groupId`. Reordering the
  array changes the route through the trail.
- `note_i18n` is optional for each item. If present in any language, it must be
  present in every published locale.

An import treats the manifest as the complete desired definition. Removing a
translation, item, note, or cover field from a later manifest removes or replaces
that value in MongoDB rather than merging partial content into the old record.

## Publication contract

A locale is available only when all of the following are true:

- the trail has `status: "published"`;
- the locale appears in `publishedLocales`;
- `title_i18n`, `description_i18n`, and every applicable `note_i18n` contain
  that locale;
- an optional cover caption contains that locale;
- every item has an exact-language post with `status: "locked"` and
  `visibility: "public"`.

Post source-language fallback is intentionally disabled for trail readiness.
Completing the final post translation makes a locale eligible, but does not
publish it until an editor adds it to `publishedLocales`.

Draft trails may be incomplete. This makes it possible to save an ordered trail
while its posts, metadata, or translations are still being prepared.

## Choosing cover art

A trail can define `coverImage` or `coverGroupId`, but not both.

`coverImage.url` stores trail-owned HTTP(S) artwork that remains available if a
post is later deleted. Its optional `caption_i18n` map follows the same
published-locale completeness rule as the other trail metadata.

Alternatively, `coverGroupId` identifies the post family whose banner represents
the trail. It may reference a stop or a separate public, completed post with a
banner image. If neither cover field is present, the importer uses the first
item's `groupId` as `coverGroupId`.

Cover choice is presentational and does not determine whether a trail locale is
available.

## Creating a trail

1. Copy `config/reading-trails/example-reading-trail.json` to an untracked file.
2. Give it a permanent slug and replace all example content and group IDs.
3. Keep `status` as `draft` and `publishedLocales` empty while assembling it.
4. Preview and apply the draft to the test database.
5. When at least one locale is ready, set `status` to `published`, add that locale
   to `publishedLocales`, and preview again before applying.

Imports are dry runs unless `--apply` is present:

```sh
npm run trail:import -- --config /path/to/my-reading-trail.json
```

The preview reports whether the import would create, update, or leave the trail
unchanged and lists readiness problems by locale.

Apply to the test database first:

```sh
npm run trail:import -- \
  --config /path/to/my-reading-trail.json \
  --apply
```

## Previewing and applying in production

Production previews require an explicit read acknowledgement:

```sh
npm run trail:import -- \
  --config /path/to/my-reading-trail.json \
  --prod --authorized-production-read
```

Review the reported action, changed fields, and locale readiness before writing.
Production writes require a separate acknowledgement:

```sh
npm run trail:import -- \
  --config /path/to/my-reading-trail.json \
  --prod --apply --authorized-production-write
```

Imports upsert by slug, run transactionally, and fail before any write when a
declared published locale is incomplete.

## Updating a trail

Start from a manifest that represents the complete current record, make the
desired change, and import it with the same slug. Common updates include:

- edit `title_i18n` or `description_i18n` to revise the introduction;
- reorder `items` to change the reading sequence;
- add or remove an item to change the route;
- revise or remove an item's `note_i18n`;
- replace `coverGroupId` with `coverImage`, or the reverse;
- change `coverImage.url` or its captions.

Always run a production dry run first. The reported changed fields should match
the intended edit exactly.

## Adding a locale

1. Ensure every post family in `items` has an exact-language, public, locked post.
2. Add the locale to `title_i18n` and `description_i18n`.
3. Translate every item note if the trail uses notes.
4. Translate the cover caption if it has one.
5. Preview the import without adding the locale to `publishedLocales`; the
   readiness report should say that it is ready but not published.
6. Add the locale to `publishedLocales`, preview again, and apply.

Removing a locale from `publishedLocales` hides that edition without affecting
the others. Its translations may remain in the record for later republication.

## Unpublishing a trail

Set `status` to `draft`, preview the update, and apply it. A draft is absent from
the trail directory, its detail URL, and trail mode in every locale. Keeping the
metadata and `publishedLocales` intact makes later republication straightforward.

There is intentionally no destructive delete option in the importer. A draft
preserves the trail for repair or later reuse while removing it from public view.
