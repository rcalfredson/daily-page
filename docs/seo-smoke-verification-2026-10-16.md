# SEO smoke verification — October 16, 2026

**Verdict: Ready with caveats.** No failing SEO behavior was found in the tested
application routes. Confirm the production environment and CDN robots behavior at
release. This pass did not deploy, restart production, alter infrastructure, or
modify production/development database records. Application source was unchanged.

## Method and limits

The configured development database, `daily-page-test`, was read over the network.
It contains 58 blocks, eight room metadata records, two historical pages, and no
reading trails. Production MongoDB was not accessed. The environment contained
MongoDB settings but no `BASE_URL`, `NODE_ENV`, or `USE_PRODUCTION_DB` override.
Credentials were not included in artifacts or output.

An isolated temporary copy of the actual `app.js` registered the real application
middleware, routers, services, and Pug templates. Only startup behavior was replaced:
reuse the development connection, omit the cron import/startup, omit Google
initialization, and omit the listening/PeerJS server. Requests used in-memory HTTP
streams; no alternate fixture page renderer replaced actual application pages.
The smoke process supplied `NODE_ENV=production`,
`BASE_URL=https://dailypage.org`, and HTTPS proxy headers. Development settings were
loaded before switching middleware mode; this does not establish that the real
production environment has the same variables.

Mongoose automatic index/collection creation was disabled. Driver mutation methods
and write aggregation stages were guarded. No blocked write attempts occurred in
either application smoke run. Supplemental in-progress/orphan fixtures changed
returned Mongoose documents in memory only; no fixture was inserted or saved.

Evidence retained locally:

- [Database/application results](../tmp/seo-smoke-results.json)
- [Supplemental fixture and translation checks](../tmp/seo-smoke-extended-results.json)
- [Generated XML sitemap](../tmp/seo-smoke-sitemap.xml)
- [Public production HTTP observations](../tmp/seo-smoke-live-results.json)
- [Public production robots body](../tmp/seo-smoke-live-robots.txt)

The temporary harnesses and machine-readable artifacts are ignored local files,
not production application additions.

## Commands and results

Node was Robert's nvm installation, `/home/robert/.nvm/versions/node/v24.15.0/bin`.
That directory was prepended to PATH for the commands below.

| Command | Result |
| --- | --- |
| `npm run lint` | Pass |
| `node node_modules/jasmine/bin/jasmine.js` | **1,314 specs, zero failures** |
| `npm run build` | Pass; all three browser bundles generated |
| `node tmp/seo-smoke.mjs` | Pass; 34 representative cases plus every sitemap destination |
| `node tmp/seo-smoke-extended.mjs` | Pass; 16 supplemental cases, no translation-cluster failures |
| `node --import ./tmp/seo-readonly-preload.mjs scripts/reading-trails/auditReadingTrails.js --json` | Pass; zero trails, no health failures |
| `git diff --check` | Pass |

Jasmine was invoked directly to avoid the existing `npm test` pretest hook's
`eslint --fix`. Its successful run also logged the pre-existing inactivity-job
MongoDB buffering timeout; see issues below. The Firefox-dependent layout-overflow
check was not run; this pass changed no layout or browser code.

## Database-backed verification versus fixtures

| Case | Evidence | Result |
| --- | --- | --- |
| Public locked articles | 55 real development records; all their sitemap URLs requested | Indexable, 200, concrete HTTPS canonical |
| Locked unlisted articles | Three real records; all included and requested | Indexable as agreed |
| Public in-progress article | No such record in this development snapshot; real article handler with an in-memory status override plus regression suite | 200, indexable, concrete canonical |
| Unlisted in-progress / private eligibility | No real unlisted in-progress or private record in this snapshot; in-memory unlisted override and fixture regression tests | Noindex/no sitemap eligibility; existing direct-link and authorization semantics preserved |
| Genuine translations | Three real multilingual families, six edition responses | Matching content language, concrete per-record canonicals, reciprocal real-language alternatives; group resolvers return 302 |
| Missing/malformed/misbound article | Actual handlers with nonexistent ID, malformed ID, and real ID under a nonexistent room | 404 |
| Orphaned article | No actual orphans; in-memory room override and sitemap fixture | Existing direct access remains 200/indexable; excluded from sitemap, as previously agreed |
| Subthreshold room | Real Russia room: six eligible records, five distinct families | Noindex, no canonical/alternates |
| Qualifying localized room | Real Daily Inspiration: 14 eligible records, 13 families; Physics: 24 records/families | English editions indexable; both included in sitemap |
| Untranslated room edition | Actual Japanese Daily Inspiration response | Browsable 200, noindex, no canonical/alternates, absent from sitemap |
| Exact room boundary | Existing fixture regressions | Nine versus ten families and locale gating pass |
| Tags, archives, best-of, room indexes | Actual database-backed routes | 200, matching HTML/header noindex, no canonical/alternates |
| Authentication and creation interfaces | Actual login/signup/forgot/reset/verification/new-post handlers | Noindex while retaining UI |
| Editor | Actual locked article editor route | Correct redirect to readable article under existing permissions; rendered-editor noindex is fixture regression coverage |
| Legacy original writing | Two real pages dated January 18, 2025 | 200, indexable, self-canonical |
| Historical month listing | Actual `/2024/10` | 200, noindex |
| Published ready trails | No real trails available; existing service/domain/view/sitemap fixture regressions | Ready editions indexable/included; unready editions excluded |
| Empty directory and unavailable edition | Actual `/en/trails` and missing `/nl/trails/...` | Empty directory stays indexable but is omitted from XML; unavailable detail returns 404/noindex |

No private-record content was published or placed in a sitemap during this pass.
This was a regression/smoke check of existing access behavior, not a replacement
for a general authorization audit. Link-accessible unlisted content remains
link-accessible; indexing rules do not introduce authentication requirements.

## Sitemap verification

The actual `/sitemap.xml` handler generated valid XML with **185 unique URLs**
from development records using the intended production origin:

| Family | Entries |
| --- | ---: |
| Localized homepages | 25 |
| Core information/directory pages: about, support, privacy, rooms | 100 |
| Concrete articles, including translations and three locked unlisted records | 58 |
| Qualifying localized room landings | 2 |
| Ready trail details / trail directories | 0 / 0 |
| **Total** | **185** |

All **185/185** URLs were requested through the real registered handlers with
production middleware enabled and development MongoDB data. Every URL returned
200, `index, follow`, and a canonical exactly matching its XML `<loc>`. There were
zero duplicates, wrong origins/schemes, redirecting destinations, non-indexable
destinations, or unreachable destinations in that local application sample.
This number is **not** a prediction of the production sitemap size.

No tags, archives, best-of pages, utility pages, quest-directory copies, query
variants, or invalid records were submitted. There are no actual orphan records
in this snapshot; the supplemental fixture confirmed their omission. Room
family counts demonstrably deduplicate translated editions (13 versus 14 records
in Daily Inspiration, five versus six in Russia).

## Representative metadata: expected and observed

All rows below matched the expected policy. Hosts are `https://dailypage.org` in
the smoke process; these observations describe the new local application, not
current production code.

| URL | Expected and observed |
| --- | --- |
| `/rooms/russia/blocks/69640b4e42629cbc1f1a7199` | 200, indexable, Spanish content, self-canonical, real Spanish/English alternates plus group `x-default` |
| `/rooms/russia/blocks/697ec5e0d4e5bd79a3f35d02` | 200, indexable, English content, own canonical, reciprocal alternates |
| First article with `?ui=nl` or `/nl` prefix | Same article canonical and content identity; no artificial Dutch translation |
| First article with trailing slash | One 301 to the slashless concrete URL; destination is directly 200 |
| `/en/users/bookworm308/blocks?page=2` | 200, indexable, canonical retains `?page=2` |
| `/en/rooms/russia` | 200, noindex; five distinct eligible families |
| `/en/rooms/daily-inspiration` | 200, indexable, self-canonical; 13 families and eligible English content |
| `/ja/rooms/daily-inspiration` | 200, noindex, no translated-equivalent annotations |
| `/en/tags/science`, `/en/archive/best-of`, `/en/login` | 200, matching noindex meta/header, no canonical or hreflang |
| `/rooms/russia/2025-01-18` | 200, indexable legacy writing, self-canonical |
| `/nl/` | 200, indexable, canonical `https://dailypage.org/nl/` |
| `/robots.txt` | 200 text/plain, `Allow: /`, HTTPS sitemap declaration, no disallows |
| `/sitemap.xml` | 200 application/xml; all emitted destinations agree with HTML eligibility |

## Live production observations: old implementation

Eleven public URLs were inspected with read-only HTTP requests. No production
editor or legacy-room/date request was used to avoid triggering any old GET
side effects. Production currently serves the old implementation, as expected.

- HTTP apex root redirects 301 to HTTPS; HTTPS root redirects 302 to `/en/`.
- HTTPS `www` redirects 301 to the apex host.
- Canonical HTTPS homepage, public article, login, tags, and Physics room URLs
  return 200. Sampled current canonicals use the intended HTTPS apex origin.
- Cloudflare and Heroku headers are present. HTML responses sampled have
  `CF-Cache-Status: DYNAMIC`; no global `X-Robots-Tag` override was observed.
- The old `/sitemap.xml` returns 404. This is expected, not a new-code failure.
- The public `/robots.txt` returns 200 text/plain with content-signal boilerplate,
  **no User-agent/Disallow rules or sitemap declaration**, and
  `Cache-Control: max-age=14400` (four hours). This response is not supplied by a
  robots file or route in the old repository. The exact CDN/origin combination
  responsible cannot be established from public HTTP alone.

No observed rule currently blocks Google from crawling noindex targets. How the
public robots response will combine with the new origin endpoint remains a
post-release check; do not assume the origin response automatically replaces
cached or edge-generated content.

## Issues and severity

1. **Medium — production configuration and robots delivery still need release
   validation.** Local `BASE_URL` is unset; the smoke process explicitly supplied
   the intended value. The production environment was not inspected directly.
   Confirm `BASE_URL=https://dailypage.org` in the hosting environment; production
   deliberately does not load `.env` ([config/config.js](../config/config.js:3)).
   Origin fallback is in [seo.js](../server/middleware/seo.js:15). Confirm the CDN
   delivers the new crawlable robots rules and sitemap declaration despite the
   observed four-hour cache/possible edge-generated body. No configuration was
   changed during this pass.
2. **Low — existing startup-job isolation problem, outside this SEO change.**
   [server/services/blockService.js](../server/services/blockService.js:9)
   constructs an auto-starting inactivity job (`true` constructor argument at
   line 30). Importing cron can start that job even when `app.js` skips
   `startJobs()`. The full Jasmine run logged its disconnected-MongoDB timeout
   while still passing. The real-data harness omitted this import and guarded
   writes. Proposed narrow follow-up: construct the job stopped and start it only
   through `startBlockJobs()`, so the existing disable flag fully controls jobs.
   No application change was made in this verification pass.
3. **Coverage limitation, not a confirmed defect — development data differs from
   production.** No real in-progress/private/orphan records or published trails
   exist in this snapshot; relevant cases used in-memory overrides or existing
   fixtures. Production has a larger corpus and needs representative release
   checks. There were no high-severity SEO defects or failing smoke assertions.

## Minimal release and validation procedure — after separate approval

1. Confirm the reviewed revision and production environment, especially Node 24,
   `NODE_ENV=production`, and `BASE_URL=https://dailypage.org`. Keep the approved
   existing production database target and access behavior. Do not run migrations
   or seed/fixture scripts for this release; none are needed for the SEO change.
2. Use the normal build/deployment process. This pass has not performed it.
3. Immediately request public `/robots.txt` and `/sitemap.xml`, checking status,
   content type, crawl permission, sitemap declaration, HTTPS host, valid XML,
   duplicates, and evidence of stale CDN content. If stale or replaced robots
   content persists, coordinate an authorized CDN cache/configuration action;
   do not substitute broad disallows for noindex.
4. Inspect representative actual production articles/translations, public
   in-progress and locked unlisted posts, rooms on both sides of the threshold,
   localized/fallback rooms, available trails, a tag, an archive, login, a
   creation/editor URL, and pagination. Compare HTML/meta/header, canonical final
   destination, alternates, and sitemap membership. Specifically check actual
   orphan counts and trail readiness without changing records.
5. Submit the verified sitemap to Search Console and use URL Inspection for a
   small sample. Monitor article performance, selected canonicals, noindex
   recognition, indexing by family, and crawl/server errors per the policy guide.
   Revert the SEO revision through the normal release process if material article
   indexability or routing regressions appear; no database rollback is needed.
