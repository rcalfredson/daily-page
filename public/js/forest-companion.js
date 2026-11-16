// Durable encounter facts. Mood, proximity and animation are deliberately transient.
export const COMPANION_NAME = 'Mallow';
export const COMPANION_ENCOUNTERS = Object.freeze(['meet', 'invite']);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export function validForestCompanion(value) {
  return Boolean(value && Object.keys(value).length === 5
    && ['version', 'id', 'species', 'name', 'stage'].every(key => Object.hasOwn(value, key)) && value.version === 1
    && UUID.test(value.id) && value.species === 'mule'
    && typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 32
    && [...value.name].every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
    && ['acquainted', 'joined'].includes(value.stage));
}

export function advanceCompanionEncounter(previous, encounter, generateId) {
  if (encounter === 'meet' && !previous) {
    return { version: 1, id: generateId(), species: 'mule', name: COMPANION_NAME, stage: 'acquainted' };
  }
  if (encounter === 'invite' && previous?.stage === 'acquainted') return { ...previous, stage: 'joined' };
  throw new Error('COMPANION_ENCOUNTER_CHANGED');
}
