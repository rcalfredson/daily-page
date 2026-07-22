export { projectForestPoint3d } from './forest-projection.js';
export const FOREST_BRIDGE_TYPE = 'arched-footbridge';
export const FOREST_BRIDGE_DEFINITION_ID = 'rustic-timber-arch';

export const FOREST_BRIDGE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: FOREST_BRIDGE_DEFINITION_ID,
    type: FOREST_BRIDGE_TYPE,
    profile: Object.freeze({ shape: 'circular-segment' }),
    deck: Object.freeze({
      thickness: 8,
      plankLength: Object.freeze([7, 11]),
      edgeInset: 1,
      nailInset: 6
    }),
    fascia: Object.freeze({ lateralOffset: 1, thickness: 9 }),
    rail: Object.freeze({
      lateralOffset: 3,
      height: 19,
      postSpacing: 22,
      postWidth: 5,
      handrailWidth: 6
    }),
    abutment: Object.freeze({ length: 14, lateralExtension: 8 }),
    palette: Object.freeze({
      shadow: 'rgba(27, 39, 37, 0.34)',
      abutmentDark: '#555344',
      abutmentLight: '#85806a',
      underside: '#34271f',
      fasciaDark: '#493225',
      fasciaLight: '#805536',
      plankLow: Object.freeze(['#925f3c', '#a36c41', '#835536', '#98623c']),
      plankMid: Object.freeze(['#a66f42', '#b57d49', '#96613b', '#aa7243']),
      plankHigh: Object.freeze(['#b87f49', '#c08a52', '#a87243', '#b7804c']),
      seam: '#65452f',
      seamHigh: '#795033',
      grainDark: '#5b3b2a',
      grainLight: '#c0874f',
      nail: '#3d342d',
      railDark: '#473126',
      railMid: '#9f6b3e',
      railLight: '#c08a55'
    })
  })
]);

export function resolveForestBridgeDefinition(id) {
  return FOREST_BRIDGE_DEFINITIONS.find(definition => definition.id === id) || null;
}

function bridgeVariation(bridge, decision, ordinal = 0, side = 0) {
  const value = Math.sin((bridge.worldX * 0.071)
    + (bridge.worldY * 0.037) + (decision * 47.31)
    + (ordinal * 91.73) + (side * 19.17)) * 43758.5453;
  return value - Math.floor(value);
}

export function forestBridgeProfileHeight(bridge, longitudinal) {
  const definition = resolveForestBridgeDefinition(bridge.definitionId);
  if (!definition || definition.profile.shape !== 'circular-segment') return 0;
  const halfLength = bridge.halfLength;
  const rise = bridge.maximumElevationPixels;
  const bounded = Math.max(-halfLength, Math.min(halfLength, longitudinal));
  const radius = ((halfLength * halfLength) + (rise * rise)) / (2 * rise);
  const springHeight = Math.sqrt(Math.max(0, (radius * radius)
    - (halfLength * halfLength)));
  return Math.max(0, Math.sqrt(Math.max(0, (radius * radius) - (bounded * bounded)))
    - springHeight);
}

export function forestBridgePoint3d(bridge, longitudinal, lateral = 0, heightOffset = 0) {
  const angle = bridge.angleMilliradians / 1000;
  return {
    x: bridge.worldX + (Math.cos(angle) * longitudinal) - (Math.sin(angle) * lateral),
    y: bridge.worldY + (Math.sin(angle) * longitudinal) + (Math.cos(angle) * lateral),
    z: forestBridgeProfileHeight(bridge, longitudinal) + heightOffset
  };
}

function surface(id, role, points, fill, ordinal = 0) {
  return Object.freeze({ id, role, points: Object.freeze(points), fill, ordinal });
}

function member(id, role, from, to, width, colors, ordinal = 0) {
  return Object.freeze({ id, role, from, to, width, colors, ordinal });
}

function detail(id, role, from, to, width, color, ordinal = 0) {
  return Object.freeze({ id, role, from, to, width, color, ordinal });
}

export function buildForestBridgeModel3d(bridge) {
  const definition = resolveForestBridgeDefinition(bridge.definitionId);
  if (!definition) throw new Error('Cannot build an unknown forest bridge definition.');
  const { deck, fascia, rail, abutment, palette } = definition;
  const surfaces = [];
  const members = [];
  const details = [];

  surfaces.push(surface('ground-shadow', 'shadow', [
    forestBridgePoint3d(bridge, -bridge.halfLength - 4, -bridge.halfWidth - 5,
      -forestBridgeProfileHeight(bridge, -bridge.halfLength - 4)),
    forestBridgePoint3d(bridge, -bridge.halfLength - 4, bridge.halfWidth + 5,
      -forestBridgeProfileHeight(bridge, -bridge.halfLength - 4)),
    forestBridgePoint3d(bridge, bridge.halfLength + 4, bridge.halfWidth + 5,
      -forestBridgeProfileHeight(bridge, bridge.halfLength + 4)),
    forestBridgePoint3d(bridge, bridge.halfLength + 4, -bridge.halfWidth - 5,
      -forestBridgeProfileHeight(bridge, bridge.halfLength + 4))
  ], palette.shadow));

  for (const endSign of [-1, 1]) {
    const inner = endSign * (bridge.halfLength - 7);
    const outer = endSign * (bridge.halfLength + abutment.length);
    surfaces.push(surface(`abutment-${endSign}`, 'abutment', [
      forestBridgePoint3d(bridge, inner, -bridge.halfWidth + 4,
        -forestBridgeProfileHeight(bridge, inner)),
      forestBridgePoint3d(bridge, inner, bridge.halfWidth - 4,
        -forestBridgeProfileHeight(bridge, inner)),
      forestBridgePoint3d(bridge, outer, bridge.halfWidth + abutment.lateralExtension,
        -forestBridgeProfileHeight(bridge, outer)),
      forestBridgePoint3d(bridge, outer, -bridge.halfWidth - abutment.lateralExtension,
        -forestBridgeProfileHeight(bridge, outer))
    ], endSign < 0 ? palette.abutmentDark : palette.abutmentLight));
  }

  for (const side of [-1, 1]) {
    const lateral = side * (bridge.halfWidth + fascia.lateralOffset);
    for (let start = -bridge.halfLength, ordinal = 0; start < bridge.halfLength;
      start += 10, ordinal += 1) {
      const end = Math.min(bridge.halfLength, start + 10);
      surfaces.push(surface(`fascia-${side}-${ordinal}`, 'fascia', [
        forestBridgePoint3d(bridge, start, lateral, -1),
        forestBridgePoint3d(bridge, end, lateral, -1),
        forestBridgePoint3d(bridge, end, lateral, -1 - fascia.thickness),
        forestBridgePoint3d(bridge, start, lateral, -1 - fascia.thickness)
      ], side < 0 ? palette.fasciaLight : palette.fasciaDark, ordinal));
    }
  }

  let start = -bridge.halfLength;
  let plankOrdinal = 0;
  while (start < bridge.halfLength) {
    const plankLength = deck.plankLength[0] + Math.floor(bridgeVariation(
      bridge, 1, plankOrdinal
    ) * ((deck.plankLength[1] - deck.plankLength[0]) + 1));
    const end = Math.min(bridge.halfLength, start + plankLength);
    const startLeftInset = deck.edgeInset + Math.floor(bridgeVariation(
      bridge, 2, plankOrdinal
    ) * 2);
    const startRightInset = deck.edgeInset + Math.floor(bridgeVariation(
      bridge, 3, plankOrdinal
    ) * 2);
    const endLeftInset = deck.edgeInset + Math.floor(bridgeVariation(
      bridge, 2, plankOrdinal + 1
    ) * 2);
    const endRightInset = deck.edgeInset + Math.floor(bridgeVariation(
      bridge, 3, plankOrdinal + 1
    ) * 2);
    const elevationRatio = forestBridgeProfileHeight(bridge, (start + end) / 2)
      / bridge.maximumElevationPixels;
    const plankPalette = elevationRatio > 0.72 ? palette.plankHigh
      : elevationRatio > 0.34 ? palette.plankMid : palette.plankLow;
    const fill = plankPalette[Math.floor(bridgeVariation(bridge, 4, plankOrdinal)
      * plankPalette.length)];
    const top = [
      forestBridgePoint3d(bridge, start, -bridge.halfWidth + startLeftInset),
      forestBridgePoint3d(bridge, start, bridge.halfWidth - startRightInset),
      forestBridgePoint3d(bridge, end, bridge.halfWidth - endRightInset),
      forestBridgePoint3d(bridge, end, -bridge.halfWidth + endLeftInset)
    ];
    surfaces.push(surface(`plank-${plankOrdinal}`, 'plank', top, fill, plankOrdinal));
    surfaces.push(surface(`plank-end-${plankOrdinal}`, 'plank-end', [
      top[0], top[1],
      forestBridgePoint3d(bridge, start, bridge.halfWidth - startRightInset,
        -deck.thickness),
      forestBridgePoint3d(bridge, start, -bridge.halfWidth + startLeftInset,
        -deck.thickness)
    ], palette.underside, plankOrdinal));
    const grainCenter = -bridge.halfWidth + 12
      + (bridgeVariation(bridge, 5, plankOrdinal) * (bridge.halfWidth * 1.25));
    const grainLength = 5 + Math.floor(bridgeVariation(bridge, 6, plankOrdinal) * 7);
    const grainLongitudinal = start + ((end - start) * 0.52);
    details.push(detail(`grain-${plankOrdinal}`, 'grain',
      forestBridgePoint3d(bridge, grainLongitudinal, grainCenter - grainLength, 0.2),
      forestBridgePoint3d(bridge, grainLongitudinal, grainCenter + grainLength, 0.2),
      1, bridgeVariation(bridge, 6, plankOrdinal) > 0.72
        ? palette.grainDark : palette.grainLight, plankOrdinal));
    if (plankOrdinal % 3 !== 1) {
      for (const side of [-1, 1]) {
        const nail = forestBridgePoint3d(
          bridge, Math.min(end - 1, start + 2), side * (bridge.halfWidth - deck.nailInset), 0.4
        );
        details.push(detail(`nail-${side}-${plankOrdinal}`, 'nail', nail, nail,
          2, palette.nail, plankOrdinal));
      }
    }
    start = end;
    plankOrdinal += 1;
  }

  const postLongitudes = [];
  for (let longitudinal = -bridge.halfLength; longitudinal < bridge.halfLength;
    longitudinal += rail.postSpacing) postLongitudes.push(longitudinal);
  if (postLongitudes.at(-1) !== bridge.halfLength) postLongitudes.push(bridge.halfLength);
  for (const side of [-1, 1]) {
    const lateral = side * (bridge.halfWidth + rail.lateralOffset);
    postLongitudes.forEach((longitudinal, ordinal) => {
      members.push(member(`post-${side}-${ordinal}`, 'post',
        forestBridgePoint3d(bridge, longitudinal, lateral, -2),
        forestBridgePoint3d(bridge, longitudinal, lateral, rail.height),
        rail.postWidth, [palette.railDark, palette.railLight], ordinal));
      if (ordinal > 0) {
        members.push(member(`rail-${side}-${ordinal}`, 'rail',
          forestBridgePoint3d(bridge, postLongitudes[ordinal - 1], lateral, rail.height),
          forestBridgePoint3d(bridge, longitudinal, lateral, rail.height),
          rail.handrailWidth, [palette.railDark, palette.railMid], ordinal));
      }
    });
  }

  return Object.freeze({
    definitionId: definition.id,
    surfaces: Object.freeze(surfaces),
    details: Object.freeze(details),
    members: Object.freeze(members),
    palette
  });
}
