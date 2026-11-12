# Activity Forest: planting purpose and a deeper world — starter prompt

Use this as the opening brief for a new design thread.

## What I want to explore

We have shipped the first complete, persistent planting loop in Daily Page's Activity Forest.
The mechanics work, and after several rounds of testing the interface feels much cleaner,
including on narrow screens. Now I want to think carefully about the world these actions belong
to: why someone would choose to plant, what they might care about afterward, and what could make
the forest enjoyable to inhabit over time.

Animal Crossing and Stardew Valley are reference points for the feeling of a place with people,
possibilities, projects and reasons to return. They are inspirations, not specifications to copy.
I do not expect one planting mechanic to establish a whole game, and we do not need to solve
everything in this thread. I do want a greater vision that makes the next small addition point
somewhere coherent.

Please approach this as a thoughtful game-design collaboration. Start with discussion and concrete
player experiences, rather than immediately implementing features. Bring recommendations and
judgment; do not make me answer a long design questionnaire before offering a useful point of view.

## What we have learned

- Collecting, carrying, planting, returning to growth and harvesting now form a playable loop.
  The owner has tested the deployed version positively. This establishes usability and a working
  foundation; it does not yet demonstrate lasting enjoyment or demand from other players.
- A cutting currently produces a plant that can eventually produce another cutting. Personal
  arrangement is already a use, but the wider significance of that arrangement is still thin.
- We should investigate whether the missing ingredient is expression, discovery, attachment,
  a responsive world, relationships, progression, or some combination. Do not assume that adding
  a task list, currency, rewards or more plant species automatically supplies purpose.
- Purpose can be self-directed. A chosen garden, a place with a personal story, or a world that
  responds interestingly might matter without a mandatory quest. Equally, do not rule out a small
  character or explicit invitation if it gives the experience warmth and direction.
- The mobile interface became crowded when each feature added its own overlays. Preserve the
  calmer interface and think about how any new experience would actually be discovered and used.

## Current live foundation

- This is a personal forest connected to real writing. Writing trees are stable representations
  of posts, with inspection, reading and return navigation. Personal markers can identify places
  and link to writing.
- Some accounts have the next-generation river/lake terrain enabled, including the owner's
  production account. Other worlds retain their existing terrain. Do not assume universal activation.
- A wild lanternbell near the entrance provides one starter cutting. The owner chooses where
  to plant it. It sprouts after two minutes and flowers after twenty; its first harvest supplies
  another cutting, with subsequent harvests available four hours after collection.
- One cutting waits for collection, regardless of how long someone is away. Plants do not need
  watering and do not wither or expire. Moving preserves growth; packing up returns a cutting,
  and replanting starts growth over. Current bounds are 24 plants and eight stored cuttings;
  these are provisional engineering bounds, not membership tiers or a settled progression design.
- Gardens persist on the account, using server time and transactional mutations. Planting respects
  trees, markers, other plants and terrain. Gardening does not consume or modify writing trees.
- The forest has a compact bottom dock, contextual actions, an in-viewport satchel, and a More
  menu for marker placement, Help and forest information. “Guide me” supplies a dismissible
  direction arrow and distance to a saved plant. Background reads no longer disable gameplay
  controls, and the decorative yellow sign beside the wild plant has been removed.
- There is no live general crafting system, economy, NPC society or multiplayer exchange loop.
  The development clearing demonstrates some broader ideas, but its inventory, objects, wildlife
  and traveler must not be mistaken for shipped account-backed systems.

## Existing vision and sources

Read these selectively, starting with the first three. Distinguish current behavior, historical
prototype evidence and future proposals; do not treat every old aspiration as a commitment.

1. `docs/forest/activity-forest-long-term-gameplay-vision.md`
2. `docs/forest/live-planting-design.md`
3. `docs/forest/live-planting-walkthrough.md`
4. `docs/forest/milestone-10-clearing-loop-evaluation.md` — historical development-fixture findings.
5. `docs/forest/post-to-tree-meaning-contract.md` — boundaries around writing and botanical identity.

The existing north star is:

> A person's writing becomes a place, and that place becomes a medium they can inhabit, shape,
> and share.

Use it as a starting point to examine and develop, not as proof that we have already found the fun.
The forest should have its own character within Daily Page. Writing should remain meaningful,
without forcing every gardening action to open a post or turning writing into a resource grind.

If needed, trace `public/js/owner-forest-garden.js`, `public/js/forest-lanternbell.js`,
`server/services/forestGarden.js`, and `views/forest/index.pug` to verify the current mechanics.
Do not turn the opening design conversation into a comprehensive architecture audit.

At preparation, `master` was aligned with `origin/master` at `679327c`, after the planting,
interface-cleanup and refresh-flicker changes were merged. The latest recorded full check was
1,516 Jasmine specs passing. Verify the repository state before later implementation; these
are handoff facts, not validation of future changes. For Node, use Robert's nvm installation:

```bash
source /home/robert/.nvm/nvm.sh
nvm use 24.15.0
```

## Questions worth working through

- What experience are we promising, and to whom? What should a short visit feel like, and what
  might someone remember or look forward to afterward?
- What makes planting a choice beyond increasing a count? Does location, arrangement, a chosen
  project, a relationship or a visible world response give it meaning?
- What connects a small action to a medium-term personal project and a larger world? What can
  be satisfying immediately, before any future systems exist?
- How much direction helps someone begin without replacing their own goals? Can someone enjoy
  the forest through writing and wandering while choosing not to garden?
- What should a returning player discover after one visit, a few days, or a longer absence?
  Preserve anticipation without obligations, missed rewards or punishment for staying away.
- Where does writing enrich this world naturally, and where should the game be allowed to
  breathe independently? What makes this more specific than a generic farming game?

## How to begin and converge

In the opening response, briefly synthesize the current opportunity, then compare two or three
meaningfully different directions. Give each a short playable vignette: what the person notices,
chooses, does, sees change, and might choose to return for. Make the actual decisions and feedback
concrete; atmosphere or lore alone is not a complete gameplay proposal. Recommend a direction
and ask the one or two questions that would most help us refine it.

As we discuss, separate the larger aspiration from the next experiment. Compare the possibilities
by player agency, emotional payoff, interesting decisions, compatibility with writing, enjoyment
without other players, mobile complexity, and implementation scope. Identify the weakest assumption
in the recommended direction and how we could test it. Be candid if an idea is decorative, repetitive,
or dependent on several unbuilt systems to become enjoyable.

Aim to leave us with:

- A concise shared vision and a few design principles that can guide later decisions.
- One recommended, small playable extension to the existing lanternbell loop, with a clear
  immediate payoff and a plausible connection to the wider vision.
- A lightweight playtest: what someone would do, what we would observe, and what would make
  us continue, revise or drop the idea. Separate ease of use from voluntary interest in repeating it.
- Explicitly deferred ideas and unresolved questions, rather than a commitment to build a whole
  life simulation at once.

This thread begins as design work, not authorization to deploy or access production accounts.
When we have a direction worth building, we can turn it into a bounded implementation brief and
work on a new feature branch. Preserve the existing writing, privacy, persistence and absence-friendly
behavior unless we explicitly discuss changing a design assumption.
