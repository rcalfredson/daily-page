import { projectPostToForestTree } from './forestPostTreeProjection.js';

const TITLES = Object.freeze([
  'Coos County at the Edge of the Continent',
  'Notes from a Summer Thunderstorm',
  'Why Saturn Has Rings',
  'A Small Museum of Lost Buttons',
  'Walking Across Lower Manhattan',
  'The Mathematics of Honeycombs',
  'Letter to an Unfamiliar City',
  'Yalobusha County Field Notes',
  'The Quiet Work of Repair',
  'What the Telescope Remembered',
  'A Recipe Written from Memory',
  'Gosper County Beneath a Wide Sky',
  'How Rivers Choose Their Paths',
  'Three Poems About Streetlights',
  'A Brief History of Public Benches',
  'The Physics of Skipping Stones',
  'Postcard from a Winter Harbor',
  'On Learning the Names of Birds',
  'The Last Independent Bookshop',
  'A Map of Neighborhood Kindness',
  'Cloud Chambers and Cosmic Rays',
  'An Orchard at the City Limit',
  'Notes on Translation and Distance',
  'The Road Home After Midnight'
]);

const ROOMS = Object.freeze([
  'united-states', 'daily-inspiration', 'physics', 'history', 'united-states', 'mathematics'
]);

const SEMANTICS = Object.freeze([
  Object.freeze({ id: 'forest-pair-habitat-0', habitat: 'neutral-grove',
    createdAt: '2025-06-12T00:00:00.000Z', pair: 'Habitat pair A' }),
  Object.freeze({ id: 'forest-pair-habitat-0', habitat: 'rocky-edge',
    createdAt: '2025-06-12T00:00:00.000Z', pair: 'Habitat pair B' }),
  Object.freeze({ id: 'forest-pair-season', habitat: 'neutral-grove',
    createdAt: '2025-04-12T00:00:00.000Z', pair: 'Creation-season pair A' }),
  Object.freeze({ id: 'forest-pair-season', habitat: 'neutral-grove',
    createdAt: '2025-10-12T00:00:00.000Z', pair: 'Creation-season pair B' }),
  Object.freeze({ id: 'forest-pair-activity', habitat: 'neutral-grove',
    createdAt: '2025-07-12T00:00:00.000Z', pair: 'Mutable-activity pair A', lowActivity: true }),
  Object.freeze({ id: 'forest-pair-activity', habitat: 'neutral-grove',
    createdAt: '2025-07-12T00:00:00.000Z', pair: 'Mutable-activity pair B', highActivity: true }),
  ...Array.from({ length: 18 }, (_, index) => Object.freeze({
    id: `forest-meaning-fixture-${index + 7}`,
    habitat: index % 3 === 0 ? 'rocky-edge' : 'neutral-grove',
    createdAt: new Date(Date.UTC(2024 + (index % 3), index % 12, 7 + index)).toISOString(),
    pair: null
  }))
]);

function roomName(roomId) {
  return roomId.split('-').map(word => `${word[0].toUpperCase()}${word.slice(1)}`).join(' ');
}

export function forestPostTreeFixtures() {
  return TITLES.map((title, index) => {
    const semantics = SEMANTICS[index];
    const post = {
      id: semantics.id,
      roomId: ROOMS[index % ROOMS.length],
      createdAt: semantics.createdAt,
      wordCount: semantics.highActivity ? 8000 : semantics.lowActivity ? 80
        : 280 + ((index * 347) % 2500),
      collaboratorCount: semantics.highActivity ? 20 : semantics.lowActivity ? 0
        : index % 5 === 0 ? 2 : index % 3 === 0 ? 1 : 0,
      translationCount: semantics.highActivity ? 40 : semantics.lowActivity ? 0 : index % 6,
      commentCount: semantics.highActivity ? 500 : semantics.lowActivity ? 0 : (index * 3) % 15,
      reactionCount: semantics.highActivity ? 1000 : semantics.lowActivity ? 0 : (index * 5) % 21,
      questApproved: semantics.highActivity || (!semantics.lowActivity && index % 4 === 0)
    };
    return {
      fixtureId: `forest-meaning-fixture-${String(index + 1).padStart(2, '0')}`,
      title,
      excerpt: 'A fixture post used to explore the visual grammar of a personal writing forest.',
      pair: semantics.pair,
      post,
      context: { habitat: semantics.habitat },
      roomName: roomName(post.roomId),
      projection: projectPostToForestTree(post, { habitat: semantics.habitat })
    };
  });
}
