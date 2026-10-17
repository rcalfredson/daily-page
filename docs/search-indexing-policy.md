# Search indexing policy

The shared resolver in `server/services/seoPolicy.js` determines robots,
canonical, hreflang, and sitemap eligibility. `server/middleware/seo.js` resolves
again immediately before rendering, after the handler has loaded the resource.
It supplies matching HTML metadata and `X-Robots-Tag`. SEO decisions do not
change authentication, collaboration, or resource access permissions.

## Agreed behavior

- Concrete public articles remain indexable, including public in-progress posts
  and locked unlisted posts. Unlisted in-progress records are not advertised by
  SEO or sitemaps. No content-length or completion threshold applies to articles.
- Article UI prefixes and presentation/context parameters do not create article
  translations. Canonicals use the existing concrete record URL. Only real
  public variants appear in the article alternate cluster. The existing
  `/posts/:group` language resolver remains its `x-default`.
- All localized homepages remain indexable initially. Static-page alternate
  annotations require an actual page metadata bundle, not just UI support.
- Room landing pages require at least **10 distinct public translation families
  in that room**, across languages. Public eligibility reuses the discovery
  predicate. Multiple translated editions count once; malformed legacy records
  without a family ID count by record ID. The same global threshold applies to
  every room locale, with the additional locale requirement below. One aggregation,
  cached for 60 seconds, supplies both HTML
  and sitemap decisions without loading post contents.
- A room's hreflang editions additionally require explicit localized name and
  description plus at least one eligible post in that language. These locale
  requirements now also apply to room indexing and sitemap inclusion, in addition
  to the global 10-family threshold. Legacy English name/description fields qualify
  for English. A fallback edition without a qualifying locale remains browsable
  with noindex. One to nine localized posts can qualify when the global count is
  at least ten; there is no new ten-post threshold per language.
- Published reading-trail editions retain their existing runtime-readiness
  checks and only advertise corresponding available editions.
- Tags, best-of pages, calendars/date archives, room archives, mechanical room
  indexes, historical month listings, authentication/recovery, search, editor/
  creation, dashboard, forest, review/leaderboard, the generic anonymous-user
  explanation, music metadata endpoints, and writing utility pages use
  `noindex, follow`. They emit no canonical or language-alternate annotations.
  Their human navigation remains intact.
- Legacy dated pages containing original writing stay indexable. Missing dated
  resources return 404, blank records are noindex, and server errors return 500.
  Historical reads no longer create blank current-day records or use query
  parameters as database projection fields.
- Other existing public pages preserve indexing eligibility. Pages without
  verified equivalent editions (for example profiles and quests) do not emit
  speculative hreflang clusters.

## URLs and crawler endpoints

Reviewed HTML trailing-slash variants redirect permanently to a consistent path, retaining
query parameters. Localized homepages retain their slash (`/en/`). Existing
language negotiation remains temporary. Meaningful pagination, sorting, and
content filters on indexable quest and public user lists remain in canonicals;
article UI, trail, comment, and tracking parameters do not. Noindex pages do not
canonicalize distinct list contents to page one.

Malformed article IDs, nonexistent room landing/creation/archive resources, and
invalid calendar dates return 404 rather than rollover pages or casting errors.
Empty valid archive dates remain browsable and noindex.

`/robots.txt` allows crawling, including pages that must expose noindex, and
advertises `/sitemap.xml`. There are no broad disallows or crawler-specific
content differences. Configure `BASE_URL=https://dailypage.org` in production to
pin the preferred origin; the existing request-origin fallback remains available
for local environments.

The XML sitemap enumerates canonical eligible article records, homepages,
qualifying room editions, runtime-ready trail editions, and public core directory/
information pages. Each candidate passes through the same resolver as HTML.
Excluded, missing, redirected, and presentation-query URLs are not submitted.
Article candidates additionally require a valid ObjectId and a room present in
the same resource snapshot; orphaned records are omitted without changing their
existing direct-access behavior. Article `lastmod` uses actual stored modification times. XML is cached for five
minutes; a generation failure returns 503, never a partial success. Some other
indexable pages remain discoverable through internal links rather than sitemap
enumeration; the exact omissions and directory rules are listed below.

## Follow-up route inventory and sitemap scope

These public families were reviewed under the permissive `other` classification.
They are intentionally not covered by a blanket noindex default. Failed responses
still receive the normal non-success indexing decision.

| Family | Routes | Current treatment and reason |
| --- | --- | --- |
| Core information | `/about`, `/support`, `/privacy` | Keep indexable; sitemap locales require actual translated page metadata bundles. |
| Room directory | `/rooms` | Keep indexable as a core navigational entry point. Sitemap requires its translated directory copy; this is an explicit single-directory choice, not a supported-language fallback. Verify actual translated room metadata at deployment. |
| Trail directory | `/trails` | HTML stays indexable. Sitemap only includes locales with at least one runtime-ready published trail. An empty directory remains browsable and is omitted. No speculative directory hreflang. |
| Quest directory and public quests | `/quests`, `/quests/:slug` | Keep indexable. Omit all quest directory editions and details from the sitemap pending a localized directory-content rule. Review/leaderboard remain utility exclusions. |
| Author profiles and lists | `/users/:username`, `/users/:username/blocks` | Keep indexable; useful attribution and public-post navigation. Omit from sitemap. `/users/anonymous` is an explicit noindex exception for the generic explanation, not a named author. |
| Project directory | `/random` | Keep indexable and omitted from sitemap; links to original side projects. |
| Original baseball notes | `/baseball`, `/baseball/:pageId` | Preserve original writing and navigation; omitted from sitemap. Detail responses are sent directly and do not pass through Pug. |
| Music catalogue | `/music`, `/artist`, `/album`, `/artist/:artistID` | Preserve existing behavior; omitted from sitemap. Review actual catalogue and client-populated content before deciding whether individual listings merit exclusion. |
| Music data endpoints | `/music/meta/*` | Now explicitly utility/noindex via response header; data and public access unchanged. |
| Player and media | `/iPod{/:gen}`, `/audio/*.wav` | Preserve project/media behavior; omitted from sitemap. Audio is streamed, not an HTML page. Album-navigation redirects remain redirects. |
| Crawler endpoints and assets | `/robots.txt`, `/sitemap.xml`, static assets | Not HTML indexing targets or sitemap entries. No new blanket asset exclusions. |

Historical standalone writing is classified separately as `legacy-writing` and
retains the previously agreed eligibility. Historical month listings remain
noindex. Unknown routes reach the application's 404 handler; the permissive
`other` category does not turn missing paths into indexable successful pages.

The sitemap intentionally omits **profiles and their lists, quest directories
and details, empty/unready trail directories, historical original writing,
project/catalogue/media routes, and pagination/filter variants**. Information-page
locales without an actual metadata bundle are also omitted. An indexable URL does
not have to be submitted in a sitemap. Localized homepages are the explicit
exception: all supported home editions remain included initially.

Normalization is limited to the reviewed localized/page routes and GET/HEAD
requests accepting HTML or wildcard content. It leaves APIs, PeerJS, media,
assets, side-project paths, unknown endpoints, and unrelated non-GET requests
alone. The render wrapper preserves callback-only, options-plus-callback, and
null-options signatures. Callbacks own their responses; otherwise successful
HTML is sent automatically and failures reach Express error middleware. Lookup,
synchronous engine, and asynchronous engine failures replace provisional success
metadata with noindex and clear canonical/alternate locals.

## Verification

Run `npm run lint` and `node node_modules/jasmine/bin/jasmine.js` with Node 24
available (Robert's installation is under `~/.nvm/versions/node/`). Calling Jasmine
directly avoids the existing npm pretest hook that runs ESLint with `--fix`.

The policy, rendered-response, and sitemap specs cover article publication and
visibility, real translated variants and UI fallback, 9/10-post room boundaries,
meaningful room alternates, ready trails, noindex families, pagination, trailing
slashes, malformed IDs/dates, missing resources, XML escaping, sitemap omissions,
and crawlable robots rules. Response tests use real Express/Pug rendering over
in-memory HTTP streams, with fixture resources and no production database or
listening port. Existing access/collaboration and trail-domain specs remain the
regression coverage for their existing permissions and readiness rules.

Before deployment, inspect actual database-backed responses for one original,
one translation, a public in-progress post, a locked unlisted post, an unlisted
in-progress record, rooms on both sides of the threshold, a translated/fallback
room, a trail and unavailable trail edition, a tag, each archive family, login,
creation/editor, and a paginated quest/user list. Check status and redirect chain,
HTML robots, response header, canonical final destination, reciprocal alternates,
article body/language, and sitemap inclusion. Confirm production `BASE_URL` and
check `/robots.txt` and XML at the public origin after deployment.

## Search Console monitoring

Before deployment, save indexing and performance exports grouped by article,
tag, archive, room, utility, and locale. Record sample Google-selected canonicals.
Submit the sitemap after deployment and inspect representative public URLs and
noindex responses in URL Inspection. Review weekly for 6–8 weeks: article clicks/
impressions, indexed URLs by family, observed noindex exclusions, crawl errors,
sitemap processing, and selected canonicals. Review sparse home locales separately
before changing their eligibility. Evaluate retained editorial visibility and
cleaner indexing rather than a target raw URL count. Recrawling and index changes
are gradual; no ranking recovery is assumed.
