# Activity Forest: Long-Term Gameplay and World Vision

## Purpose

This document describes the long-term game design direction for the Activity Forest after the first inhabitable-clearing milestones. It is intentionally broader than the near-term implementation roadmap.

The near-term roadmap should continue to test one small, legible interaction at a time. This document exists so those experiments can point toward a coherent larger world rather than accumulating as unrelated features.

The Activity Forest should become more than generative art or an explorable profile. It should support open-ended construction, curation, discovery, social connection, and emergent play while remaining unmistakably connected to writing.

The north star is:

> **A person's writing becomes a place, and that place becomes a medium they can inhabit, shape, and share.**

## Product identity

The Activity Forest has three simultaneous identities:

1. **A living record of writing**
   - Posts become stable, inspectable trees.
   - The landscape preserves traces of projects, interests, collaborations, and periods of life.
   - Spatial arrangements create new ways to revisit and interpret writing.

2. **A creative world**
   - The owner can shape terrain, paths, structures, gardens, interiors, signs, and art.
   - The world can function as a public profile, a personal environment, a collaborative project, or some mixture of the three.

3. **An open-ended game**
   - Resources, tools, construction systems, ecology, travel, and social interaction should combine in ways that permit outcomes the designer did not script directly.
   - The game should reward imagination and stewardship rather than optimization, repetitive labor, or spending.

These identities should reinforce one another. The forest should not become a generic crafting game with posts attached as collectibles, nor should the writing connection prevent it from becoming a genuinely playful system.

## Participation depths

Every forest should support several depths of engagement.

### Ambient

Writing grows a complete, attractive landscape. A person who never builds, gathers, or customizes still receives the core magic.

### Curatorial

The owner organizes and interprets the landscape:

- Paths among related trees
- Named clearings
- Favorite and commemorative markers
- Signs, benches, reading nooks, lanterns, gates, and bridges
- Notes or quotations attached to places
- Limited relocation or grouping tools
- Portals and routes among important areas

### Constructive

The owner uses modular systems to build:

- Houses and cabins
- Exterior and interior rooms
- Fences, arches, walls, terraces, and stonework
- Farms, gardens, orchards, and habitat areas
- Bridges, piers, towers, workshops, and gathering spaces
- Decorative objects and functional stations

### Expressive

The forest becomes a medium for authored work:

- Paintings made in a simple pixel-art or tile-art editor
- Sculptures assembled from modular pieces
- Signs with custom names or messages
- Display boards for excerpts, quotations, or collections
- Miniature books, maps, banners, or emblems
- Music or ambient-sound objects if storage and moderation make them practical

A placed artwork may show a small in-world representation and open a detailed view when approached.

### Social

The forest connects to other people:

- Visitors may enter read-only
- Trusted invitees may build or decorate within explicit permissions
- Owners may exchange gifts, seeds, cuttings, plans, or art
- Collaborators may create shared clearings
- Portals and paths may recommend other users' forests
- Community projects may create temporary or permanent shared places

## A world made of worlds

### Edge paths

A public forest should not feel like an isolated diorama. At selected points along its boundary, paths, gates, doorways, ferries, or other transitions may lead into another public forest.

The result is a potentially endless walk through Daily Page:

```text
one person's forest
    -> a boundary path
    -> another person's forest
    -> another path
    -> another person's forest
```

Transitions may be:

- Randomized
- Weighted toward recently active or thematically related forests
- Chosen from an owner's recommendations
- Connected through mutual relationships or collaborations
- Attached to community quests, rooms, or shared interests

### Safety and consent

Networked traversal must be opt-in and controllable.

Owners should be able to:

- Allow or disallow random visitors
- Control whether their forest may appear in randomized travel
- Approve or remove persistent inbound links
- Block specific users
- Report abusive or deceptive portals
- Choose whether visitors arrive at a public entrance or a selected landmark

Public traversal should initially be read-only. Building, item exchange, and chat require explicit permission.

### Portals

Portals are a higher-agency form of travel.

Possible uses:

- Fast travel among distant areas of one forest
- A deliberate recommendation of another user's public forest
- Access to a private forest visible only to authorized users
- Entrance to a shared project or collaborative clearing
- Return routes to favorite places

Only the owner or authorized builders may create portals. Visitors may use visible portals but cannot alter them.

A portal to another user's forest should behave more like a curated backlink than an unrequested endorsement. The destination owner should be able to opt out of persistent inbound links or limit how they appear.

## The generated world and the authored world

The state model should preserve four layers.

### 1. Generated base

- Terrain seed and version
- Initial landforms
- Water and habitat regions
- Generated post-tree placement
- Immutable landmarks
- Deterministic resource and discovery rules

### 2. Writing layer

- Stable post-to-tree identity
- Post metadata projected into bounded visual traits
- Relationships among posts
- Private or public visibility
- Historical evidence retained across renderer upgrades

Post trees are not ordinary timber. They represent writing and cannot be destroyed for resources.

### 3. Personal overlay

- Trails
- Structures
- Placed objects
- Terrain edits
- Plantings
- Art
- Signs and annotations
- Portals
- Permissions
- Curated tree placement where allowed

### 4. Transient life

- Weather
- Lighting
- Wildlife movement
- Temporary visitors
- Short-lived discoveries
- Real-time presence and chat

Generated and authored state should remain independently versioned. A world-generation upgrade must not silently erase or scramble the owner's work.

## World growth and post-tree capacity

Both free and paid users may begin with a compact generated landscape. Writing adds post-linked trees and gradually reveals or generates surrounding terrain.

A proposed free-world bound is an **active grove capacity** rather than deletion or degradation:

- Up to roughly 300 post-linked trees may be spatially active at once.
- All posts remain available through normal Daily Page archives and forest curation tools.
- When the active grove reaches capacity, the owner chooses which post trees are currently represented.
- Removing a tree from the active grove does not delete, demote, or alter its post.
- Re-adding a removed tree may produce a new generated placement unless the system explicitly preserves a dormant placement record.

Paid forests may continue expanding without the same active-grove bound, allowing the world to generate outward into additional habitats and biomes.

The exact number should be treated as a product and performance hypothesis, not a permanent truth. It should be tested against:

- Typical post counts
- Browser and server performance
- How emotionally disruptive curation feels
- Whether the free world still feels complete
- Whether expansion is meaningful rather than empty acreage

The interface should never announce that a user's writing has become "too much." It should frame the free bound as a curated active landscape, with the full body of writing still intact and accessible.

## Trees and planting

### Post trees

- Stable identity derived from a post
- Cannot be cut down or consumed
- May be inspected to revisit the post
- Preserve authorship and visibility rules
- May be decorated, connected, annotated, or curated

All users should have some ability to correct frustrating placement. Paid membership may expand this into full landscape curation, but basic usability should not be sold as a luxury.

A possible boundary:

- Free users receive occasional or bounded transplant actions and can rearrange trees within designated clearing tools.
- Paid users receive broader, repeatable relocation and landscape-planning controls.
- Moving a tree never changes its identity or post association.

### Planted trees

- Grown from collected or traded seeds
- Mature over a modest wall-clock interval, such as several hours
- May provide fruit, seeds, blossoms, shade, habitat, fallen branches, or other renewable materials
- May be cut or transplanted if the design supports it
- Should not require daily care or punish absence

Wall-clock growth should provide anticipation, not obligation. Nothing should die because the player stayed away.

## Building system

Emergent play requires a small set of systems with many combinations, not a giant catalog of single-purpose decorations.

### Modular construction grammar

Prefer reusable parts:

- Floors, walls, roofs, doors, windows, columns, beams, stairs, arches, fences
- Stone blocks, earth banks, retaining walls, terraces, bridges, and paths
- Interior surfaces, shelves, tables, chairs, lights, frames, and storage
- Paint, material, orientation, and trim variants

Parts should snap clearly but permit enough variation to avoid identical buildings.

### Functional affordances

A small number of object behaviors can produce many uses:

- **Container:** stores or displays selected resources or gifts
- **Surface:** supports objects, art, books, or signs
- **Seat:** opens a quiet reading or reflection interface
- **Light:** changes local visibility or atmosphere
- **Sign:** displays text, a name, or a route
- **Frame:** displays user-created art or a selected post excerpt
- **Portal:** links places
- **Plot:** supports plants or habitat
- **Workshop:** converts materials according to discovered plans
- **Gathering point:** defines where visitors arrive or collaborate

The game should favor verbs that compose. "Place," "connect," "display," "grow," "shape," "store," "gift," and "link" are more generative than a hundred isolated collectible objects.

### Earthworks and stoneworks

Longer-term terrain tools may include:

- Raising or lowering bounded terrain patches
- Smoothing, painting, or replacing ground surfaces
- Digging ponds or channels within safe constraints
- Creating terraces, berms, mounds, and sunken gardens
- Building stone walls, arches, monuments, and entrance structures
- A customizable ranch-style entrance arch with a name or message

These tools require stronger validation, migration, and collision contracts than ordinary placed objects. They belong after modular building and saved-world upgrades are reliable.

## Crafting and discovery

Crafting should deepen expression and discovery rather than form a mandatory progression ladder.

Good recipe sources include:

- Experimenting with compatible materials
- Finding plans while exploring
- Receiving a plan from another user
- Learning from a community quest
- Inspecting a structure in another forest
- Revisiting writing associated with a material or place

Recipes should generally unlock possibilities, not power.

Possible material families:

- Fallen wood and fiber
- Stone, clay, sand, and pigment
- Seeds, petals, fruit, and botanical dyes
- Glass, metal fittings, paper, and fabric obtained through markets or projects
- Found curiosities with expressive uses

Avoid tool durability, hunger, combat statistics, rarity speculation, and repetitive production chains unless later evidence shows that they genuinely serve the world.

## Economy and market

The market should support exchange and expression, not create a pay-to-advance economy.

Good uses:

- Selling surplus renewable resources
- Buying ordinary building materials
- Trading seeds, cuttings, plans, art, and crafted objects
- Funding shared construction projects
- Acquiring materials unavailable in one's current biome

Guardrails:

- No real-money purchase of gold
- No randomized paid rewards
- No paid mechanical advantage in public competition
- No essential writing feature tied to resources
- No market design that rewards spam posting
- No irreversible loss caused by inactivity

A paid membership should **not** simply remove a gold-earning cap that constrains free users. That would make payment directly purchase economic acceleration.

Safer membership distinctions include:

- Larger market listings
- Better inventory organization
- Saved trade searches
- Private-group exchanges
- More storage for authored assets
- Hosted continuity across larger worlds
- Cosmetic presentation options

If a free daily sale bound is required for abuse prevention, a comparable anti-abuse policy should apply fairly. Membership may raise operational limits only where the difference corresponds to real hosting cost and does not create public dominance.

## Multiplayer and collaboration

Real-time multiplayer is valuable but technically expensive. It should arrive in layers.

### Phase 1: Read-only visiting

- Enter another public forest
- Inspect public writing
- Use public portals
- View art and structures
- Leave through the entrance or a portal

### Phase 2: Asynchronous collaboration

- Owner grants object-level or area-level permissions
- Invitees place or edit objects while the owner is absent
- Changes are versioned and attributable
- Owners can review, revert, or remove contributions

### Phase 3: Shared presence

- A small number of concurrent visitors
- Position and avatar presence
- Simple emotes
- Optional ephemeral text chat
- Clear mute, block, kick, and reporting controls

### Phase 4: Cooperative activities

- Shared building
- Gift exchange
- Community projects
- Joint exploration or discovery
- Collaborative art and writing installations

An ephemeral chat history of one or two minutes may preserve the feeling of spoken conversation, but moderation and safety still require server-side abuse controls, rate limits, reporting evidence, and clear retention policy. The interface may be ephemeral even if narrowly bounded safety records exist behind the scenes.

## Avatars

Every visitor needs a legible avatar, but avatar quality should not become a hierarchy of human worth.

Free users should receive:

- A varied and expressive base creator
- Multiple body, skin, hair, mobility, and clothing options
- Enough combinations that the free population does not look uniform
- Accessibility and identity-respecting choices

Paid membership may add:

- More clothing and accessory sets
- Additional animation styles
- Saved outfits
- Greater color and pattern control
- Themed cosmetic collections

Paid cosmetics should be expansive rather than corrective. They should not contain the only dignified, culturally broad, or identity-relevant choices.

## Public and private worlds

### Public forest

- Grown from public writing
- Discoverable according to the owner's settings
- Traversable by visitors
- Suitable as a creative public profile
- Connected to other public forests through edge paths and portals
- Core ambient, curatorial, and playful mechanics remain meaningful

### Private forest

- Grown from private writing
- Accessible only to the owner and invited collaborators
- Not reachable through public random travel
- May use a private portal visible only to authorized users
- Supports journaling, drafts, research notes, personal archives, and private projects
- Receives the same fundamental care as the public world

Private forests are not merely public forests with a lock icon. They are the spatial expression of writing that does not belong in the commons.

## Candidate free and paid boundary

This boundary is provisional and should be tested.

### Free

- Public writing and public post trees
- A complete ambient forest
- Core exploration, resource gathering, planting, crafting, and building
- A bounded but meaningful active grove
- Basic tree-placement correction
- Read-only visiting and use of public portals
- A varied base avatar creator
- Public art, structures, trails, and profile customization
- Normal writing, reading, comments, rooms, quests, and discovery

### Paid membership

- Private writing spaces and private forests
- Continued hosted terrain expansion beyond the free active-grove bound
- Broader tree and landscape curation
- More or larger private and collaborative spaces
- Creation of portals
- Invited building permissions and small-group collaboration
- Expanded cosmetic and authored-asset storage
- Stronger backup, export, history, and organization tools
- Larger media and art capacity where hosting cost is real
- Convenience and control features that do not create public mechanical superiority

The principle is:

> **Everyone receives the game. Members receive more space, privacy, continuity, and authorship over the world.**

## Writing and creator tools

The forest revenue model should not ignore the writing product itself.

Strong paid candidates include:

- Private posts, rooms, journals, and notebooks
- Private quests and long-running projects
- Full revision history
- Scheduled or automatic exports
- Reliable backups and restore points
- Larger image and media storage
- Advanced private search, collections, and saved views
- Shared private rooms with granular permissions
- Collaborative drafts and review workflows
- Custom private templates
- Optional custom domain or portfolio presentation
- Downloadable world snapshots or archival bundles
- A private spatial archive that links writing, art, and projects

Core public writing, ordinary editing, accessibility, publishing, reading, comments, and community participation should remain free.

## Design tests for emergent gameplay

Before adding a system, ask:

1. Can players combine it with several existing systems?
2. Can it produce outcomes the designer did not explicitly script?
3. Does it create expression, discovery, relationship, or a new route to writing?
4. Is there more than one reasonable use or arrangement?
5. Can a player ignore it without suffering loss?
6. Does it avoid rewarding spam, raw word count, or repetitive activity?
7. Does it preserve the meaning of post trees?
8. Does payment expand space or control rather than purchase power?
9. Can the state be migrated, reversed, and moderated?
10. Is the interaction still worthwhile without a currency counter?

## Product delivery horizons and validation gates

The Part II roadmap remains the near-term experimental spine. Its milestones should answer one
bounded product question at a time; the horizons below describe how those experiments could become
a coherent product. A horizon is complete when its evidence exists, not when a feature checklist is
large enough or a calendar date arrives.

At the time of this revision, the generated-world, personal-overlay, trail, discovery, inventory,
and first clearing-object contracts from Milestones 1–4 are established in the development Forest
Lab. Connecting those choices back to writing remains the next narrow product question.

### Horizon 1: First Clearing proof

Purpose:

Prove that exploring, gathering, shaping a place, and revisiting writing form one meaningful loop.

Scope:

- Complete the Part II First Clearing milestones, including one restrained connection from an
  authored environmental choice back to fixture writing.
- Evaluate the combined trail, discoveries, Satchel, signs, benches, lanterns, and writing-tree
  interactions as one experience rather than as isolated technical demonstrations.
- Preserve development-only persistence while the interaction and emotional value are still being
  tested.
- Keep modular construction, planted-tree growth, network visiting, production storage, and
  monetization outside this proof.

Exit evidence:

A person can explore, gather, personalize one clearing, encounter writing through that change,
leave, return to the persistent result, and explain why the authored place feels more meaningful
than a conventional post list or decorative profile scene.

### Horizon 2: Production owner loop

Purpose:

Move the proven personal loop from fixtures into a reliable forest grown from real writing.

Scope:

- Connect authenticated users and actual posts to stable, inspectable post trees.
- Define post-tree creation, update, privacy, archival, and removal semantics without treating
  writing as an expendable game resource.
- Introduce production persistence for generated identities, writing projections, and personal
  overlays, with deliberate migration, recovery, backup, and reset behavior.
- Carry keyboard, pointer, touch, reduced-motion, focus, non-canvas access, and baseline performance
  contracts into the production surface.
- Observe real post-count and metadata distributions before finalizing capacity or semantic mapping
  rules.

Exit evidence:

A real user can write a post, see its stable tree, inspect the writing, personalize the surrounding
world, leave, and return without authored or writing-linked state being lost, duplicated, or
silently reinterpreted.

### Horizon 3: Constructive sandbox proof

Purpose:

Determine whether a few composable systems can make the forest feel like a small writing-driven
sandbox rather than a profile scene with a catalog of unrelated props.

Scope:

- Add one planted-tree lifecycle with no absence penalty or recurring-care obligation.
- Add one small modular construction grammar, such as a gate, shelter, arch, or reading nook made
  from a few reusable parts.
- Add one contrasting neighboring habitat and bounded form of world expansion.
- Test construction, planting, trails, discoveries, writing trees, and habitat rules in combination.
- Continue to defer a broad catalog, unrestricted terrain editing, markets, and generalized
  construction infrastructure.

Exit evidence:

Players can use a small shared vocabulary to create substantially different places, and the
systems produce expressive combinations that were not each authored as a single-purpose object.

### Horizon 4: Connected public alpha

Purpose:

Prove that forests can connect people without compromising ownership, consent, safety, or the calm
single-player experience.

Scope:

- Begin with read-only visits to deliberately selected public forests.
- Use a minimal, legible visitor representation before committing to a full avatar creator.
- Add one safe edge transition or portal proof with explicit destination and arrival behavior.
- Establish owner visibility settings, controlled arrival points, blocking, reporting, and portal
  consent before randomized travel.
- Keep shared mutation, item exchange, persistent chat, and real-time building outside the first
  public visiting slice.

Exit evidence:

A visitor can enter, understand, inspect, and leave another person's public forest while the owner
retains clear control and neither participant can confuse visiting with permission to modify the
world.

### Horizon 5: Private-world and membership pilot

Purpose:

Test whether privacy, space, continuity, and authorship create trustworthy membership value without
making the public forest mechanically inferior.

Scope:

- Project private writing into a private forest with explicit authorization boundaries.
- Define invited access independently from public discovery and random travel.
- Establish credible backup, export, recovery, retention, and deletion expectations for private
  writing and world state.
- Test one deliberately narrow private-portal or invited-access path.
- Present membership as private terrain, hosted continuity, stronger organization, and broader
  authorship rather than economic acceleration or public status.

Exit evidence:

Users understand what is private, who can enter, how their work is protected, and why the hosted
private world may be worth paying for without payment purchasing mechanical dominance.

### Later alpha and maturation

Once the earlier gates are supported by observation rather than aspiration, later work may deepen:

- Modular building, interiors, planting, habitat, terrain, and world expansion.
- Art, display, music, and other authored expressive tools.
- Botanical, biome, seasonal, weather, lighting, wildlife, and avatar variety.
- Asynchronous invited editing with attribution, review, and reversion.
- Gifts and exchange after worthwhile material and social needs exist.
- Economy design only after building and exchange reveal genuine demand.
- Shared presence only after read-only visiting, permissions, moderation, and versioned
  collaboration are reliable.

Feature presence alone is not maturity. Building must feel expressive rather than fiddly; mobile
controls must feel natural; persistence and migration must be trustworthy; public travel and
portals must be safe; and added systems must preserve the forest's calm character.

## Delivery assumptions

Detailed contracts and AI-assisted development can compress implementation work, especially
scaffolding, bounded schemas, UI wiring, tests, refactors, diagnostics, and changes within an
already understood architecture. That acceleration is valuable, but it is not evenly distributed.

The schedule is more likely to be governed by:

- Product judgment and deciding which interaction is actually worth keeping.
- Playtesting whether a mechanic feels alive, understandable, and connected to writing.
- Visual and audio direction across objects, environments, characters, and devices.
- Performance measurement with real worlds and representative user data.
- Accessibility review beyond the contracts that automated tests can cover.
- Production persistence, migrations, recovery, backups, privacy, and operational reliability.
- Permission, moderation, abuse-prevention, and consent design for networked features.
- Economy observation and balancing without grind, coercion, or pay-to-win pressure.
- Multiplayer and collaborative correctness under conflicts, retries, and partial failure.

Faster construction should therefore shorten feedback loops, not justify beginning every horizon at
once. Parallel work is appropriate only when it does not obscure the current product question or
force unvalidated future systems into present contracts.

Calendar estimates are planning hypotheses rather than game-design invariants. If maintained, they
should live in a separate revisable delivery note and record:

- The date of the estimate and the exact scope being estimated.
- Assumptions about developer availability, tooling, infrastructure, and dependencies.
- The evidence already available and the unknowns most likely to change the estimate.
- A confidence level and the conditions that would trigger re-estimation.

The long-term vision should guide architecture and sequencing, but it should not convert the next
milestone into the whole game at once. The immediate task remains to finish and evaluate the First
Clearing loop before selecting the next large system.
