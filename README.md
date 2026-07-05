# Daily Page

Daily Page is a collaborative writing app for keeping a public, textual record of each day. It began as a fork/descendant of the [Conclave project](https://github.com/conclave-team/conclave), but has grown into a room-based writing space with live editing, archives, profiles, reactions, comments, search, multilingual UI/content support, community quests, and a small amount of editorial curation.

The reference instance lives at [dailypage.org](https://dailypage.org).

## What it is

Daily Page is built around a simple idea: each day deserves a place where people can write together, leave fragments, and gradually form a shared record. The app has gone through two shapes:

- Legacy daily pages, where a date maps to a concatenated collaborative document.
- Current room-based posts, where each room can host many smaller pieces of writing for a date/topic, with public browsing, comments, reactions, votes, translations, and archives.

The long-term direction is less "private notes app" and more "small civic/cultural memory tool": lightweight enough for casual participation, structured enough to archive, search, translate, and curate later.

## Current Features

- Real-time collaborative Markdown editing using a CRDT-derived model and PeerJS/WebRTC signaling.
- Rooms and topical dashboards for browsing in-progress and locked writing posts.
- Community quests for coordinating shared writing goals, reserving quest items, submitting posts for review, tracking progress, and crediting contributors with leaderboards and badges.
- Automatic locking of inactive posts after roughly seven days.
- Public archives by date, room, month, and year.
- User accounts with server-side auth sessions, remembered-device login, email verification, password reset, profile editing, writing streaks, and starred rooms.
- Anonymous post creation/editing with short-lived edit tokens.
- Comments, comment notifications, reactions, votes, reports, and basic rate limiting.
- Tags, text search, trending tags, featured content, and homepage activity modules.
- Multilingual UI files under `i18n/`, language-prefixed routes, hreflang/SEO helpers, and post translation grouping.
- Google Drive-backed content routes used by the reference instance for side collections such as baseball/music notes.
- Optional S3 profile image uploads.
- Optional Mailgun transactional email.
- Optional TURN credentials for better WebRTC connectivity.

## Tech Stack

- Node.js, Express, Pug, plain browser JavaScript, and CSS.
- MongoDB Atlas-style connection strings through Mongoose.
- PeerJS for collaboration signaling.
- esbuild for browser bundles.
- Jasmine for specs.
- ESLint for linting.

The app is an ES module project and currently declares Node `^24` in `package.json`.

## Repository Layout

```text
app.js                    Express app, routes, middleware, PeerJS server
config/config.js           Environment variable mapping
lib/                       Browser collaboration/editor code and shared helpers
server/api/v1/             JSON API routes
server/routes/             Rendered page routes
server/db/                 Mongoose models, schemas, and data services
server/services/           Email, Google, cron jobs, i18n, uploads, etc.
server/middleware/         Auth, locale, SEO, and routing middleware
server/utils/              Rendering, URL, block, and archive helpers
views/                     Pug templates
public/                    Static CSS, images, fonts, and generated bundles
i18n/                      Locale JSON files
spec/                      Jasmine specs
scripts/                   Dev helpers and migrations
```

## Requirements

- Node.js 24.x. If you use `nvm`, install/use the version from the repo root:

  ```sh
  nvm install 24
  nvm use 24
  ```

- npm.
- A MongoDB deployment reachable from your machine. The current connection helper assumes:
  - username: `daily-page-admin`
  - host from `MONGO_DB_ADDR`
  - password from `MONGO_DB_PW`
  - database name: `daily-page-test` outside production, `daily-page` when `NODE_ENV=production`

For a personal dev instance, MongoDB Atlas is the path of least resistance because the code builds an `mongodb+srv://...` URI.

## Local Setup

1. Clone the repository and enter it.

   ```sh
   git clone https://github.com/rcalfredson/daily-page.git
   cd daily-page
   ```

2. Use Node 24.

   ```sh
   nvm install 24
   nvm use 24
   ```

3. Install dependencies.

   ```sh
   npm install
   ```

   `postinstall` runs `npm run build`, which writes browser bundles into `public/js/`.

4. Create a `.env` file. For a minimal bootable local instance:

   ```sh
   MONGO_DB_ADDR=your-cluster.mongodb.net
   MONGO_DB_PW=your-mongodb-password
   PORT=3000
   BACKEND_URL=http://localhost:3000
   BASE_URL=http://localhost:3000
   RATE_LIMIT_SALT=replace-with-another-random-secret
   ```

   The current startup path also initializes Google Drive. Until that is made lazy/optional, provide either a local `credentials.json` file in the repo root or set `GOOG_CREDS` to serialized service-account JSON. `credentials.json` is gitignored.

5. Start the app.

   ```sh
   npm run local
   ```

6. Open [http://localhost:3000](http://localhost:3000).

The app will connect to `daily-page-test` by default. Set `NODE_ENV=production` only for a real deployment, because that changes database selection, cookie security behavior, compression/view caching, and dotenv loading.

## Database Notes

The app does not currently ship with a one-command seed for a complete demo instance. An empty database can boot, but pages such as the rooms directory and room dashboards become useful after inserting room metadata and creating posts.

At minimum, create documents in the `rooms` collection shaped like:

```json
{
  "_id": "general",
  "topic": "Writing",
  "name": "General",
  "description": "Open daily writing and observations."
}
```

Then visit `/rooms/general/blocks/new` to create posts through the UI, or use the room-scoped block API. The block schema requires title, room, creator, language, group ID, and other fields; using the app/API is easier than hand-writing block documents.

## Environment Variables

### Required for the core app

| Variable | Purpose |
| --- | --- |
| `MONGO_DB_ADDR` | MongoDB Atlas host, for example `cluster0.example.mongodb.net`. |
| `MONGO_DB_PW` | Password for the hard-coded Mongo user `daily-page-admin`. |

### Strongly recommended

| Variable | Purpose |
| --- | --- |
| `PORT` | Express port. Defaults to `3000`. |
| `BACKEND_URL` | Base URL passed to the browser editor. Defaults to local port. |
| `BASE_URL` | Public canonical URL for emails, notifications, and SEO helpers. |
| `RATE_LIMIT_SALT` | Salt for hashed rate-limit identifiers. Falls back to `MONGO_DB_PW` if absent. |

### Optional integrations

| Variable | Purpose |
| --- | --- |
| `METERED_TURN_USERNAME` | TURN username for WebRTC connectivity. |
| `METERED_TURN_CREDENTIAL` | TURN credential for WebRTC connectivity. |
| `MAILGUN_API_KEY` | Sends verification, password reset, notification, and room-request emails. |
| `AWS_ACCESS_KEY_ID` | S3 profile image upload access key. |
| `AWS_SECRET_ACCESS_KEY` | S3 profile image upload secret. |
| `AWS_REGION` | S3 region. |
| `S3_BUCKET_NAME` | S3 bucket for profile images. |
| `GOOG_CREDS` | JSON Google service-account credentials, serialized as one env var. Currently needed at startup unless `credentials.json` exists. |
| `BASEBALL_FOLDER_ID` | Google Drive folder for the `/baseball` side collection. |
| `MUSIC_FOLDER_ID` | Google Drive folder for music metadata/content. |
| `ARTISTS_FOLDER_ID` | Google Drive folder for artist metadata. |
| `ALBUMS_FOLDER_ID` | Google Drive folder for album metadata. |

The optional services are not all gracefully mocked. For a polished public instance, provision them; for local development, avoid routes/features that depend on missing integrations. Google credentials are the main exception today: Drive-backed routes are instance-specific, but `google.init()` still runs during boot.

## Cloud Resources for Your Own Instance

A reasonably complete independent deployment needs:

1. MongoDB, ideally Atlas, with a `daily-page-admin` database user and network access from your host.
2. A Node hosting target that supports long-running HTTP/WebSocket-ish traffic. The app starts an Express HTTP server and mounts PeerJS at `/peerjs`.
3. A stable public URL and HTTPS termination. Set `BASE_URL` and `BACKEND_URL` to that URL.
4. Transactional email, currently Mailgun, if you want account verification, password resets, comment notifications, and room-request emails to work.
5. Object storage, currently S3, if you want profile picture uploads.
6. TURN service credentials if users will collaborate across restrictive networks.
7. Google Cloud service-account credentials for current boot compatibility, plus Drive folders if you want the reference instance's Google Drive-backed side content to work.

## Scripts

```sh
npm run build              Build browser bundles into public/js/
npm run local              Build bundles, then start the server
npm start                  Start app.js with trace deprecation output
npm test                   Run Jasmine specs
npm run lint               Run ESLint over app/server/lib/spec paths
npm run room-i18n:export   Export room i18n source data
npm run room-i18n:migrate  Populate localized room metadata
npm run visibility:migrate-unlisted -- --write
                           Migrate legacy visibility=private posts to unlisted
```

Note: `npm test` runs `pretest`, and `pretest` currently invokes ESLint with `--fix` on a small set of files. Be aware of that before running tests in a dirty worktree.

## Development Workflow

- Server-rendered pages live in `views/` and route files under `server/routes/`.
- JSON endpoints live in `server/api/v1/`.
- Mongoose schemas and most query behavior live under `server/db/`.
- Browser editor/collaboration code lives under `lib/` and is bundled by esbuild.
- Locale strings live under `i18n/<lang>/`.
- Generated browser bundles in `public/js/` are build artifacts.

For frontend work, run `npm run build` after changes to files in `lib/`, or use `npm run local` to rebuild before starting the app.

### Development View Previews

Rare UI states can be previewed without manufacturing matching database or collaboration conditions. While the app is running outside production, open:

- `/en/__dev/views/tag-detail` to preview the tag-detail trend chart with representative fixture data.
- `/en/__dev/views/full-post-capacity` to preview the message shown when a post editor has reached its collaborator limit.
- `/en/__dev/views/toasts` to trigger neutral, success, error, long-message, and stacked toast states.
- `/en/__dev/views/inactive-warning` to preview the editor inactivity warning in light and dark modes.

Replace `/en/` with another supported UI-language prefix when checking localized layout behavior. These routes render the real application templates and shared frontend assets, but use development fixture data where needed.

The preview router is mounted only when `NODE_ENV !== 'production'`; these routes are unavailable in production deployments. Add future rare-state previews in `server/routes/devViews.js`, with dedicated templates under `views/dev/` when a reusable production template is not already available.

## Collaboration Model

The editor traces back to Conclave's CRDT approach. Posts are edited in Markdown, local edits become CRDT operations, and peers exchange updates through the collaboration layer. The server also exposes endpoints for persistence and session/peer discovery.

Post bodies support Google Maps Street View embeds with a restricted Markdown
directive:

```md
@[streetview](https://www.google.com/maps/embed?pb=...)
```

Only HTTPS URLs on `www.google.com` with the exact `/maps/embed` path and a
single `pb` parameter are accepted. Raw iframe HTML remains disabled. Full post
pages render the interactive panorama, while post-list previews render a link.

Post banners may also use the same validated Google Maps embed URL by selecting
the Google Street View banner type. Street View banners render as interactive
panoramas on full posts and as lazy-loaded, click-through panoramas on cards.
Existing banner metadata without a type continues to render as an image.

When a post has been inactive for about seven days, a cron job marks it `locked`. Locked posts are treated as archive/browsing material rather than active writing surfaces. `public` posts appear in public browsing while editable; `unlisted` drafts stay out of public browsing until they lock.

## Community Quests

Community quests turn open-ended writing into shared, trackable projects. A quest can ask the community to reach a count-based goal, such as creating a certain number of posts, or complete a defined set of quest items, such as covering every place, topic, or prompt in a prepared checklist.

Quest items can be claimed by contributors, attached to posts, submitted for review, sent back for changes, approved, rejected, withdrawn, or revoked. Approved quest posts count toward quest progress and can appear in quest-specific browsing, contributor leaderboards, and profile achievements.

The review workflow is designed for moderated collaborative projects rather than fully open posting. Quest administrators can review pending submissions, inspect the submitted post and its history, leave comments, approve contributions, request revisions, or reject work that does not fit the quest guidelines.

Quest support currently includes:

- Count-based and set-based quest types.
- Claim/release flows for set-based quest items.
- Contributor submission statuses, including draft, pending, changes requested, approved, rejected, withdrawn, and revoked.
- Administrator review queues with review history.
- Progress displays, approved-post listings, contributor leaderboards, and badge tiers.
- Quest-related in-site and email notification strings in the i18n layer.

## Internationalization

Daily Page separates UI language from post content language. UI strings are stored in `i18n/`, routes can be language-prefixed, and block groups can contain translations in multiple languages. Room metadata also supports localized `name_i18n`, `description_i18n`, and `topic_i18n` maps.

Useful migration scripts:

```sh
npm run room-i18n:export
npm run room-i18n:migrate
```

## Production Caveats

This is a personal project that has grown into a real app, not a turnkey SaaS kit. Before running a public instance, review:

- Secret management and production dotenv behavior.
- MongoDB permissions, backups, indexes, and network access.
- Email sender/domain configuration. The current Mailgun service is opinionated around `dailypage.org`.
- CORS origins in `app.js`; the whitelist currently includes `https://dailypage.org` and `http://localhost:3000`.
- Cookie security and HTTPS proxy behavior.
- S3 bucket permissions and profile image upload limits.
- Abuse controls around comments, reports, anonymous editing, and room requests.
- Whether Google Drive routes are relevant to your fork. If not, consider making `google.init()` lazy or feature-flagged before deploying.

## Tests

Run:

```sh
npm test
```

Specs currently cover the CRDT/editor core, version vectors, controller behavior, broadcast behavior, block editorial context, room editorial clusters, and room i18n migration helpers.

## License

MIT.
