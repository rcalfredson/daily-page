// Disabling creation must leave readers, existing-object mutations and equal retries working.
export function forestWritingLinksEnabled(environment = process.env) {
  return environment.FOREST_WRITING_LINKS_ENABLED === 'true';
}
