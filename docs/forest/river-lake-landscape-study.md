# River and lake landscape study

November 8, 2026. Development preview on `feat/forest-live-terrain`; no owner-world
generation, activation, database, or production route changes. Existing uncommitted terrain work
is retained. Participant recruitment remains deferred.

Follow-up: the [first live river/lake slice](live-river-lake-slice.md) now implements generation 4
and explicit upgrade support. This document records the earlier study checkpoint; its proposed
integration section is historical, not a statement that live integration remains unimplemented.

## Diagnosis and direction

Generation 3 packs a main channel, two feeders, exposed spring, and receiving pond into each
1,920-unit district. Fitting all water inside connected dry district edges produces isolated
catchments and a repeated miniature composition. Among unprotected districts from `terrain-proof-a`
and `terrain-proof-b` queried over −2880…2880, centerlines measure 596–1,428 units: 5.5–13.2 seconds
at the verified bootstrap speed of 108 units/second. These are centerline reference times, not
walkable bank-route measurements. The receiving-water axes in those samples span 112–539 by
56–334 units. Restrictions around established places may reject some of these systems.

The live projection translates ground x/y directly into CSS pixels and subtracts height from y;
it does not provide perspective or shrink distant ground. A 390px camera can therefore see a whole
small basin while a desktop camera can expose most of a catchment. Neither another bank texture
pass nor a screenshot enlargement resolves that. Generation determines scale and continuity;
silhouette and inlet design determine composition; paint must support those decisions.

Three viable directions:

- Longer local creeks preserve the current access proof, but retain district repetition and leave
  little space for a convincing lake. Useful later as secondary features.
- A regional river entering a substantial lake gives continuous travel, a major landmark, and a
  natural reason to turn from following a bank to exploring a shore. **Recommended study.**
- A coastline first establishes large open water quickly, but does less to answer river continuity,
  bends, confluences, and crossings. Revisit after the lake works at walking scale.

Choose restrained stylized pixel terrain: broad bends, readable widths, quiet blue-green water,
mineral banks, and the existing humanoid, rock, and timber bridge vocabulary. This preview uses
the established bank adapter by default, with bands removed, reduced static texture, and sparse
stepped current cues. Toggle Shared bank materials off to isolate the silhouette. This is not
a claim of final material acceptance. Do not add particles to disguise geometry.

## Bounded first slice

`scripts/dev/forestWaterStudyGeometry.js` generates one complete deterministic study landscape,
not an infinite network or a proposed production generation 4. It contains:

- A main river from y = −9600 to +640, broad bends, ordinary full widths of about 98–166 units,
  tapering at the distant upstream end. No spring is forced into the initial camera.
- One approximately 2,200-unit tributary joining at an acute downstream angle, rather than two
  short symmetrical diagram branches.
- A roughly 3,000 × 2,200-unit lake basin, with low-frequency shore variation and a bay extending
  upstream to y = −512. Curved banks share the river's tangent at that neck and sweep into the lake
  shoulders, replacing the initial oval/ribbon T-junction. The main channel ends inside the lake.
- A bank route starting at y = −6400 and following the inlet onto the northwest lake shoulder.
  Across `alder`, `granite`, and `snowmelt`, it measures 7,023–7,099 units, or 65.0–65.7 seconds
  at 108 units/second. The camera follows the live-size humanoid, with no zoom or speed change.
  The route covers several signed
  district boundaries and reaches the lake shore. Walk onward manually to explore the bay.
- A timber crossing at y = −3200 with body collision, elevated avatar, ordered rails, and dry
  approaches. Rocks share the existing pixel painter and block walking.

The study's region query returns complete intersecting features with a bank margin, never a clipped
river or a new endpoint. One candidate scene serializes below 60 KB (including review routes and
duplicated presentation channel coordinates). That is evidence about this
small fixed landscape, not certification of production regional payloads or generation cost.
It has no existing writing protections, writing trees, marker operations, or return routes.

## Compatibility and live integration decision

Do not change generation 3's sampler or dispatch under its existing descriptor. Current server
validation, region delivery, browser validation/cache, allocation caches, and sampling all assume
district-local features. In particular, the sampler inspects only the district containing a point,
and transport validators require every vertex inside its home district. Multiplying dimensions
would violate those assumptions and the existing access proof.

If the study's scale and direction are accepted, implement a separate generation identity with
fixed regional feature ownership and conservative maximum influence bounds. Enumerate owners by
influence intersection, deduplicate complete features in transport/cache, and use that same union
for painting, walking, placement, tree allocation, bridges, and return predicates. Frozen-protection
reads must cover each complete candidate's influence, including shore and approach margins, with
density overflow rejecting the candidate rather than dropping constraints. A river crossing the
old dry boundary lattice needs a new bounded connectivity construction and access validation;
the old lattice is not a corridor to cut through the river.

Retain generation-3 readers and exact regeneration for activated worlds. New development worlds
may explicitly activate a new supported generation after full access verification. For existing
activated development worlds, the recommended upgrade path is a separately authorized, resumable
replacement activation: retain old authority while capturing *all current* reserved places under
the owner fence, verify candidate access, then atomically publish a new generation/activation token.
Do not reuse only the old frozen set, clear the descriptor, reset the seed, or call cancellation
an upgrade. Existing retry recovery still precedes new-placement token checks. This replacement
activation is a proposed durable decision, **not implemented or authorized by opening this preview**.
An alternative is keeping existing worlds on generation 3 and testing on a fresh dedicated owner.
Choose that durable path with Robert after visual review, before persistence work.

## Open and assess

From the repository:

```bash
source /home/robert/.nvm/nvm.sh
nvm use 24.15.0
npm run forest:water-study
```

Open **http://127.0.0.1:4178/**. Optional port: `FOREST_WATER_STUDY_PORT=4180`.
Use the three seeds, then Upstream, Confluence, Crossing, Inlet, and Lake shore. Focus the canvas
and use arrows/WASD, or hold a point to move toward it. Timed bank walk returns to the upstream
start and follows the real collision-checked route. Keyboard movement interrupts it. Overview
shows the finite study, bank route, and old district boundary lines at a reduced scale; return
to walking for visual acceptance. Freeze water and OS reduced motion retain usable geometry.

Assess at desktop and 390px width. At Lake shore, the opposite bank should be outside the normal
camera. At Inlet, walk downstream and around the widening shore; do not judge only from Overview.
At Crossing, traverse the bridge and try walking into water beside it. Follow the tributary
upstream if desired: its eventual endpoint is fixed geometry, not viewport concealment.

Human aesthetic acceptance, physical touch, live writing-place accessibility, and migration remain
open. The next increment should establish shore-adjacent rocky ground and tree composition around
the accepted lake/river slice, together with the production reach/access proof. Snow and birds
remain later work; neither should conceal an unresolved water silhouette.

## Review observations

The first plain-bank render made the longer river legible but still looked schematic. Restoring
the shared pixel bank materials helps its relationship to the avatar and timber crossing. A second
review exposed the sharper problem: the oval lake/ribbon union produced abrupt corners at the mouth.
The curved bay is a geometry correction, shared by collision and paint, rather than a texture cover.
The preview still lacks tree masses, bank-side terrain composition, and ecological transition.
Those absences make the shore easy to inspect but do not demonstrate an inhabitable finished forest.

Automated commands: `npx jasmine spec/forestWaterStudySpec.js` and
`node scripts/dev/checkForestWaterStudy.js`. The latter starts/stops its own Firefox, temporary
profile, and localhost server, captures three seeds at 1280px and 390px into
`tmp/forest-water-study/`, walks the full route in real time, checks keyboard movement and frozen
water, and rejects browser console errors. Screenshots are ignored local artifacts. Full Jasmine
and lint results are recorded at handoff; no Mongo fixture is needed for these database-free changes.

Final regression run: 1,455 Jasmine specs passed; repository lint and explicit lint of the study's
scripts passed. Firefox review covers all three seeds at 1280×900 and 390×900. A single-arrow
movement defect found during browser validation was corrected; the check now asserts approximately
54 units of travel from a half-second keyboard hold and checks that frozen water produces an
unchanging canvas. This evidence does not substitute for physical-touch or live-account review.
The final Firefox run completed the alder route at 7,023 walked units in 65.0 seconds of both
on-screen and measured wall time, with no browser console errors.
