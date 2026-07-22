export const FOREST_STREAM_BANK_DEFINITION_ID = 'varied-incised-creek-bank';
export const FOREST_STREAM_BANK_MODEL_VERSION = 3;
export const FOREST_STREAM_BANK_SAMPLE_STEP = 16;

export const FOREST_STREAM_BANK_COMPOSITIONS = Object.freeze([
  Object.freeze({
    id: 'grassy', weight: 42,
    strata: Object.freeze({
      far: Object.freeze(['#68764d', '#716044', '#5e4e3d', '#403a33']),
      near: Object.freeze(['#596b46', '#66543e', '#524438', '#37322e'])
    }),
    lip: '#89ad5c', shadow: '#314936', detail: '#acd36d'
  }),
  Object.freeze({
    id: 'rocky', weight: 25,
    strata: Object.freeze({
      far: Object.freeze(['#737763', '#686555', '#55524a', '#383e3a']),
      near: Object.freeze(['#626b58', '#5c594f', '#494741', '#313633'])
    }),
    lip: '#879273', shadow: '#343f3d', detail: '#abb09a'
  }),
  Object.freeze({
    id: 'bare-dirt', weight: 23,
    strata: Object.freeze({
      far: Object.freeze(['#876e4c', '#775b3e', '#604838', '#3d312b']),
      near: Object.freeze(['#765f44', '#694e39', '#513d33', '#342b27'])
    }),
    lip: '#98764e', shadow: '#49372d', detail: '#b18a59'
  }),
  Object.freeze({
    id: 'fallen-log-jam', weight: 10,
    strata: Object.freeze({
      far: Object.freeze(['#657048', '#685039', '#503d31', '#352d28']),
      near: Object.freeze(['#56613f', '#584333', '#44352d', '#2d2724'])
    }),
    lip: '#74834d', shadow: '#352d28', detail: '#9a6a42'
  })
]);

export const FOREST_STREAM_BANK_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: FOREST_STREAM_BANK_DEFINITION_ID,
    modelVersion: FOREST_STREAM_BANK_MODEL_VERSION,
    waterDepth: Object.freeze({ minimum: 5, maximum: 14, anchorSpacing: 168 }),
    slopeRun: Object.freeze({ minimum: 20, maximum: 42, anchorSpacing: 156 }),
    edge: Object.freeze({
      broadAmplitude: 5,
      detailAmplitude: 4,
      broadSpacing: 96,
      detailSpacing: 36
    }),
    compositionSectionLength: 210,
    stratumCount: 4,
    sampleStep: FOREST_STREAM_BANK_SAMPLE_STEP
  })
]);

export function resolveForestStreamBankDefinition(id) {
  return FOREST_STREAM_BANK_DEFINITIONS.find(definition => definition.id === id) || null;
}

export function resolveForestStreamBankComposition(id) {
  return FOREST_STREAM_BANK_COMPOSITIONS.find(composition => composition.id === id) || null;
}

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  result += result << 13;
  result ^= result >>> 7;
  result += result << 3;
  result ^= result >>> 17;
  result += result << 5;
  return result >>> 0;
}

function unit(value) {
  return hash(value) / 4294967296;
}

function smoothstep(value) {
  const bounded = Math.max(0, Math.min(1, value));
  return bounded * bounded * (3 - (2 * bounded));
}

function interpolateAnchors(manifest, worldX, spacing, decision, minimum, maximum,
  side = 0) {
  const firstIndex = Math.floor(worldX / spacing);
  const progress = smoothstep((worldX - (firstIndex * spacing)) / spacing);
  const valueAt = index => minimum + (unit([
    manifest.seed, `stream-bank-v${FOREST_STREAM_BANK_MODEL_VERSION}`,
    decision, side, index
  ].join(':')) * (maximum - minimum));
  const first = valueAt(firstIndex);
  const second = valueAt(firstIndex + 1);
  return first + ((second - first) * progress);
}

function compositionForSection(manifest, section, side) {
  const totalWeight = FOREST_STREAM_BANK_COMPOSITIONS.reduce(
    (total, composition) => total + composition.weight, 0
  );
  let selection = unit([
    manifest.seed, `stream-bank-v${FOREST_STREAM_BANK_MODEL_VERSION}`,
    'composition', side, section
  ].join(':')) * totalWeight;
  return FOREST_STREAM_BANK_COMPOSITIONS.find((composition) => {
    selection -= composition.weight;
    return selection < 0;
  }) || FOREST_STREAM_BANK_COMPOSITIONS[0];
}

function compositionBlendAt(manifest, worldX, side, definition) {
  const section = Math.floor(worldX / definition.compositionSectionLength);
  const progress = smoothstep((worldX - (section * definition.compositionSectionLength))
    / definition.compositionSectionLength);
  return {
    primary: compositionForSection(manifest, section, side),
    secondary: compositionForSection(manifest, section + 1, side),
    mix: progress
  };
}

function colorChannels(color) {
  return [1, 3, 5].map(index => Number.parseInt(color.slice(index, index + 2), 16));
}

function mixColor(first, second, progress) {
  const from = colorChannels(first);
  const to = colorChannels(second);
  return `#${from.map((channel, index) => Math.round(
    channel + ((to[index] - channel) * progress)
  ).toString(16).padStart(2, '0')).join('')}`;
}

function compositionInfluence(profile, compositionId) {
  let influence = 0;
  if (profile.compositionId === compositionId) influence += 1 - profile.compositionMix;
  if (profile.nextCompositionId === compositionId) influence += profile.compositionMix;
  return influence;
}

export function forestStreamWaterDepthAt(manifest, worldX) {
  const definition = FOREST_STREAM_BANK_DEFINITIONS[0];
  return interpolateAnchors(manifest, worldX, definition.waterDepth.anchorSpacing,
    'water-depth', definition.waterDepth.minimum, definition.waterDepth.maximum);
}

export function forestStreamBankProfileAt(manifest, worldX, side) {
  const definition = FOREST_STREAM_BANK_DEFINITIONS[0];
  if (![-1, 1].includes(side) || !Number.isFinite(worldX)) {
    throw new Error('A stream bank profile requires a finite position and side.');
  }
  const broadOffset = interpolateAnchors(manifest, worldX, definition.edge.broadSpacing,
    'broad-edge', -definition.edge.broadAmplitude, definition.edge.broadAmplitude, side);
  const detailOffset = interpolateAnchors(manifest, worldX, definition.edge.detailSpacing,
    'detail-edge', -definition.edge.detailAmplitude, definition.edge.detailAmplitude, side);
  const outerOffset = interpolateAnchors(manifest, worldX,
    definition.edge.detailSpacing * 2, 'outer-edge', -3, 3, side);
  const innerOffset = broadOffset + detailOffset;
  const sampledSlopeRun = interpolateAnchors(manifest, worldX,
    definition.slopeRun.anchorSpacing,
    'slope-run', definition.slopeRun.minimum, definition.slopeRun.maximum, side);
  const waterDepth = forestStreamWaterDepthAt(manifest, worldX);
  const slopeRun = Math.max(sampledSlopeRun,
    waterDepth + innerOffset - outerOffset + 6);
  const composition = compositionBlendAt(manifest, worldX, side, definition);
  return Object.freeze({
    definitionId: definition.id,
    modelVersion: definition.modelVersion,
    side,
    worldX,
    waterDepth,
    slopeRun,
    innerOffset,
    outerOffset,
    compositionId: composition.primary.id,
    nextCompositionId: composition.secondary.id,
    compositionMix: composition.mix
  });
}

export function forestStreamWaterPoint3d(manifest, worldX, lateral, centerY) {
  return {
    x: worldX,
    y: centerY + lateral,
    z: -forestStreamWaterDepthAt(manifest, worldX)
  };
}

function bankPoint3d(manifest, profile, centerY, position) {
  const stream = manifest.stream;
  if (position === 'inner') {
    return {
      x: profile.worldX,
      y: centerY + (profile.side * (stream.halfWidth + profile.innerOffset)),
      z: -profile.waterDepth
    };
  }
  return {
    x: profile.worldX,
    y: centerY + (profile.side * (stream.halfWidth + profile.slopeRun
      + profile.outerOffset)),
    z: 0
  };
}

export function forestStreamBankEdgePoint3d(manifest, worldX, side, centerY,
  position = 'inner') {
  return bankPoint3d(
    manifest, forestStreamBankProfileAt(manifest, worldX, side), centerY, position
  );
}

function pointBetween(first, second, progress) {
  return {
    x: first.x + ((second.x - first.x) * progress),
    y: first.y + ((second.y - first.y) * progress),
    z: first.z + ((second.z - first.z) * progress)
  };
}

function stratumColor(profile, stratum) {
  const primary = resolveForestStreamBankComposition(profile.compositionId);
  const secondary = resolveForestStreamBankComposition(profile.nextCompositionId);
  const view = profile.side < 0 ? 'far' : 'near';
  return mixColor(primary.strata[view][stratum], secondary.strata[view][stratum],
    profile.compositionMix);
}

function stratumProgressAt(manifest, profile, boundary) {
  if (boundary === 0) return 0;
  if (boundary === 4) return 1;
  const bases = [0, 0.2, 0.48, 0.76, 1];
  return bases[boundary] + interpolateAnchors(
    manifest, profile.worldX, 48, `stratum-${boundary}`, -0.045, 0.045, profile.side
  );
}

function bankSurface(side, ordinal, stratum, points, startProfile, endProfile) {
  return Object.freeze({
    id: `bank-surface-${side}-${ordinal}-${stratum}`,
    role: 'bank-stratum',
    side,
    ordinal,
    stratum,
    compositionId: startProfile.compositionId,
    nextCompositionId: startProfile.nextCompositionId,
    compositionMix: startProfile.compositionMix,
    points: Object.freeze(points),
    fill: mixColor(stratumColor(startProfile, stratum), stratumColor(endProfile, stratum), 0.5)
  });
}

function bankDetail(id, role, side, from, to, width, colors) {
  return Object.freeze({ id, role, side, from, to, width, colors });
}

function bankMark(id, role, side, point, size, colors, variant = 0) {
  return Object.freeze({ id, role, side, point, size, colors, variant });
}

function appendSegmentDetails(model, manifest, startProfile, endProfile,
  startCenterY, endCenterY, ordinal) {
  const primary = resolveForestStreamBankComposition(startProfile.compositionId);
  const secondary = resolveForestStreamBankComposition(startProfile.nextCompositionId);
  const mixed = property => mixColor(
    primary[property], secondary[property], startProfile.compositionMix
  );
  const startInner = bankPoint3d(manifest, startProfile, startCenterY, 'inner');
  const startOuter = bankPoint3d(manifest, startProfile, startCenterY, 'outer');
  const endInner = bankPoint3d(manifest, endProfile, endCenterY, 'inner');
  const endOuter = bankPoint3d(manifest, endProfile, endCenterY, 'outer');
  const side = startProfile.side;
  const identity = [manifest.seed, side, Math.floor(startProfile.worldX), ordinal].join(':');
  const grassyInfluence = compositionInfluence(startProfile, 'grassy');
  const rockyInfluence = compositionInfluence(startProfile, 'rocky');
  const dirtInfluence = compositionInfluence(startProfile, 'bare-dirt');

  model.details.push(bankDetail(`bank-lip-${side}-${ordinal}`, 'lip', side,
    startOuter, endOuter, grassyInfluence > 0.45 ? 3 : 2,
    [mixed('shadow'), mixed('lip')]));
  const startCapEdge = pointBetween(startOuter, startInner,
    stratumProgressAt(manifest, startProfile, 1));
  const endCapEdge = pointBetween(endOuter, endInner,
    stratumProgressAt(manifest, endProfile, 1));
  if (unit(`${identity}:cap-shadow`) > 0.24) {
    model.details.push(bankDetail(`bank-cap-shadow-${side}-${ordinal}`, 'cap-shadow', side,
      startCapEdge, endCapEdge, 2, ['#302d29', mixed('shadow')]));
  }
  model.details.push(bankDetail(`bank-undercut-${side}-${ordinal}`, 'undercut', side,
    startInner, endInner, 3, ['#26312f', mixed('shadow')]));

  if (unit(`${identity}:grass`) > 0.58 - (grassyInfluence * 0.46)) {
    const base = pointBetween(startOuter, endOuter, unit(`${identity}:grass-x`));
    model.details.push(bankDetail(`bank-grass-${side}-${ordinal}`, 'grass', side,
      base, { ...base, x: base.x + (unit(`${identity}:grass-lean`) > 0.5 ? 2 : -2),
        y: base.y - (side * 2), z: base.z + 5 + Math.floor(grassyInfluence * 3) }, 3,
      [mixed('shadow'), mixed('detail')]));
  }
  if (unit(`${identity}:rock`) > 0.7 - (rockyInfluence * 0.55)) {
    const along = unit(`${identity}:rock-x`);
    const slope = 0.28 + (unit(`${identity}:rock-slope`) * 0.5);
    const inner = pointBetween(startInner, endInner, along);
    const outer = pointBetween(startOuter, endOuter, along);
    model.marks.push(bankMark(`bank-rock-${side}-${ordinal}`, 'rock', side,
      pointBetween(inner, outer, slope), 5 + Math.floor(unit(`${identity}:rock-size`) * 6),
      [side < 0 ? '#38423d' : '#303936', side < 0 ? '#89917b' : '#747d6b'],
      Math.floor(unit(`${identity}:rock-shape`) * 4)));
  }
  if (unit(`${identity}:dirt`) > 0.78 - (dirtInfluence * 0.48)) {
    const along = unit(`${identity}:dirt-x`);
    const inner = pointBetween(startInner, endInner, along);
    const outer = pointBetween(startOuter, endOuter, along);
    const from = pointBetween(inner, outer, 0.32 + (unit(`${identity}:dirt-slope`) * 0.35));
    model.details.push(bankDetail(`bank-dirt-${side}-${ordinal}`, 'dirt', side,
      from, { ...from, x: from.x + 5 + Math.floor(unit(`${identity}:dirt-length`) * 6) },
      1, [mixed('shadow'), mixed('detail')]));
  }
  if (unit(`${identity}:soil`) > 0.38) {
    const along = unit(`${identity}:soil-x`);
    const inner = pointBetween(startInner, endInner, along);
    const outer = pointBetween(startOuter, endOuter, along);
    const slope = 0.16 + (unit(`${identity}:soil-slope`) * 0.7);
    model.marks.push(bankMark(`bank-soil-${side}-${ordinal}`, 'soil', side,
      pointBetween(outer, inner, slope), 2 + Math.floor(unit(`${identity}:soil-size`) * 3),
      [mixed('shadow'), mixed('detail')], Math.floor(unit(`${identity}:soil-shape`) * 3)));
  }
  if (unit(`${identity}:root`) > 0.58) {
    const along = unit(`${identity}:root-x`);
    const inner = pointBetween(startInner, endInner, along);
    const outer = pointBetween(startOuter, endOuter, along);
    const from = pointBetween(outer, inner, 0.12 + (unit(`${identity}:root-top`) * 0.2));
    const to = pointBetween(outer, inner, 0.48 + (unit(`${identity}:root-bottom`) * 0.34));
    model.details.push(bankDetail(`bank-root-${side}-${ordinal}`, 'root', side,
      from, { ...to, x: to.x + (unit(`${identity}:root-bend`) > 0.5 ? 2 : -2) },
      1, [mixed('shadow'), '#806044']));
  }
}

function appendLogJam(model, manifest, section, side, centerYAt, definition) {
  const centerX = Math.round((section + 0.5) * definition.compositionSectionLength);
  if (centerX < 0 || centerX > manifest.world.width) return;
  if (compositionForSection(manifest, section, side).id !== 'fallen-log-jam') return;
  const profile = forestStreamBankProfileAt(manifest, centerX, side);
  const centerY = centerYAt(centerX);
  const inner = bankPoint3d(manifest, profile, centerY, 'inner');
  const direction = unit(`${manifest.seed}:log-jam:${side}:${section}:direction`) < 0.5 ? -1 : 1;
  const length = 36 + Math.floor(unit(`${manifest.seed}:log-jam:${side}:${section}:length`) * 28);
  const fromX = Math.max(0, centerX - (length / 2));
  const toX = Math.min(manifest.world.width, centerX + (length / 2));
  const from = { ...inner, x: fromX, y: inner.y - (direction * 5), z: inner.z + 4 };
  const to = { ...inner, x: toX, y: inner.y + (direction * 5), z: inner.z + 6 };
  model.details.push(bankDetail(`bank-log-${side}-${section}`, 'log', side,
    from, to, 7, ['#3b2a23', '#95613b']));
  const branchStart = pointBetween(from, to, 0.64);
  model.details.push(bankDetail(`bank-log-branch-${side}-${section}`, 'log-branch', side,
    branchStart, { ...branchStart, y: branchStart.y + (side * 15), z: branchStart.z + 3 },
    3, ['#3b2a23', '#855536']));
}

export function buildForestStreamBankModel3d(manifest, range, centerYAt) {
  const definition = FOREST_STREAM_BANK_DEFINITIONS[0];
  if (!Number.isFinite(range?.firstX) || !Number.isFinite(range?.lastX)
    || range.firstX > range.lastX || typeof centerYAt !== 'function') {
    throw new Error('A stream bank model requires a finite ordered range and center query.');
  }
  const firstX = Math.max(0, Math.floor(range.firstX / definition.sampleStep)
    * definition.sampleStep);
  const lastX = Math.min(manifest.world.width, Math.ceil(range.lastX / definition.sampleStep)
    * definition.sampleStep);
  const model = { definitionId: definition.id, surfaces: [], details: [], marks: [] };
  for (const side of [-1, 1]) {
    let ordinal = 0;
    for (let startX = firstX; startX < lastX; startX += definition.sampleStep) {
      const endX = Math.min(lastX, startX + definition.sampleStep);
      const startProfile = forestStreamBankProfileAt(manifest, startX, side);
      const endProfile = forestStreamBankProfileAt(manifest, endX, side);
      const startCenterY = centerYAt(startX);
      const endCenterY = centerYAt(endX);
      const startInner = bankPoint3d(manifest, startProfile, startCenterY, 'inner');
      const startOuter = bankPoint3d(manifest, startProfile, startCenterY, 'outer');
      const endInner = bankPoint3d(manifest, endProfile, endCenterY, 'inner');
      const endOuter = bankPoint3d(manifest, endProfile, endCenterY, 'outer');
      for (let stratum = 0; stratum < definition.stratumCount; stratum += 1) {
        const startFrom = stratumProgressAt(manifest, startProfile, stratum);
        const startTo = stratumProgressAt(manifest, startProfile, stratum + 1);
        const endFrom = stratumProgressAt(manifest, endProfile, stratum);
        const endTo = stratumProgressAt(manifest, endProfile, stratum + 1);
        model.surfaces.push(bankSurface(side, ordinal, stratum, [
          pointBetween(startOuter, startInner, startFrom),
          pointBetween(startOuter, startInner, startTo),
          pointBetween(endOuter, endInner, endTo),
          pointBetween(endOuter, endInner, endFrom)
        ], startProfile, endProfile));
      }
      appendSegmentDetails(model, manifest, startProfile, endProfile,
        startCenterY, endCenterY, ordinal);
      ordinal += 1;
    }
    const firstSection = Math.floor(firstX / definition.compositionSectionLength) - 1;
    const lastSection = Math.ceil(lastX / definition.compositionSectionLength) + 1;
    for (let section = firstSection; section <= lastSection; section += 1) {
      appendLogJam(model, manifest, section, side, centerYAt, definition);
    }
  }
  return Object.freeze({
    definitionId: model.definitionId,
    surfaces: Object.freeze(model.surfaces),
    details: Object.freeze(model.details),
    marks: Object.freeze(model.marks)
  });
}
