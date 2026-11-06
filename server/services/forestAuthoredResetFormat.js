// A reset's immutable scope belongs to the operation, never to the current writer.
export const FOREST_AUTHORED_MIXED_RESET_SCHEMA_VERSION = 2;
export const FOREST_AUTHORED_MIXED_RESET_OPERATION_VERSION = 2;
const LEGACY_SCOPE = Object.freeze([1]);
const MIXED_SCOPE = Object.freeze([1, 2]);

export function forestAuthoredResetScope(value) {
  const operation = typeof value?.toObject === 'function' ? value.toObject() : value;
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) return null;
  if (operation.schemaVersion === 1 && operation.operationVersion === 1
    && operation.authoredObjectSchemaVersion === 1
    && !Object.hasOwn(operation, 'authoredObjectSchemaVersions')) return LEGACY_SCOPE;
  const versions = operation.authoredObjectSchemaVersions;
  if (operation.schemaVersion === 2 && operation.operationVersion === 2
    && !Object.hasOwn(operation, 'authoredObjectSchemaVersion')
    && Array.isArray(versions) && versions.length === 2
    && versions[0] === 1 && versions[1] === 2) return MIXED_SCOPE;
  return null;
}
