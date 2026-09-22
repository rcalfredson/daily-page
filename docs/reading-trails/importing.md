# Importing reading trails

Reading trails live in MongoDB. JSON manifests are a validated transfer format
for creating or updating those records; they are not the runtime or editorial
source of truth. A trail orders language-independent post families by `groupId`,
and the importer resolves the concrete post for each published locale.

The real manifests currently under `config/reading-trails/` form the initial
import batch. After that batch is applied, they should be removed before the
feature branch is finalized and replaced by a content-neutral example manifest.

## Publication contract

A locale is available only when all of the following are true:

- the trail has `status: "published"`;
- the locale appears in `publishedLocales`;
- `title_i18n`, `description_i18n`, and every applicable `note_i18n` contain
  that locale;
- every item has an exact-language post with `status: "locked"` and
  `visibility: "public"`.

Post source-language fallback is intentionally disabled for trail readiness.
Completing the final post translation makes a locale eligible, but does not
publish it until an editor adds it to `publishedLocales`.

Trail cover art can come from either `coverImage` or `coverGroupId`, but a
manifest cannot define both. `coverImage.url` stores trail-owned external art
that survives post deletion; its optional `caption_i18n` map follows the same
published-locale completeness rule as other trail metadata. `coverGroupId`
instead identifies the post family whose banner represents the trail and may
reference either a stop or an independent public, completed post. Cover choice
is presentation-only and never determines whether a trail locale is available.

## Previewing an import

Imports are dry runs unless `--apply` is present:

```sh
npm run trail:import -- \
  --config config/reading-trails/start-exploring-spacetime.json
```

The preview reports the create/update plan and readiness problems by locale.

Production previews require an explicit read acknowledgement:

```sh
npm run trail:import -- \
  --config config/reading-trails/start-exploring-spacetime.json \
  --prod --authorized-production-read
```

## Applying an import

Apply to the test database first:

```sh
npm run trail:import -- \
  --config config/reading-trails/start-exploring-spacetime.json \
  --apply
```

Production writes require a separate acknowledgement:

```sh
npm run trail:import -- \
  --config config/reading-trails/start-exploring-spacetime.json \
  --prod --apply --authorized-production-write
```

Imports upsert by stable trail slug, run transactionally, and fail before any
write when a declared published locale is incomplete.
