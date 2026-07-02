export const NO_SORT_MARKER = '{.no-sort}';

/**
 * Converts a standalone marker before a table into an HTML class.
 * @param {import('markdown-it')} md
 */
export function tableSortOptOutPlugin(md) {
  md.core.ruler.after('block', 'table_sort_opt_out', (state) => {
    for (let i = 3; i < state.tokens.length; i++) {
      const table = state.tokens[i];
      const paragraphOpen = state.tokens[i - 3];
      const marker = state.tokens[i - 2];
      const paragraphClose = state.tokens[i - 1];

      const isMarkerBeforeTable = table.type === 'table_open'
        && paragraphOpen.type === 'paragraph_open'
        && marker.type === 'inline'
        && marker.content.trim() === NO_SORT_MARKER
        && paragraphClose.type === 'paragraph_close'
        && paragraphOpen.level === table.level;

      if (!isMarkerBeforeTable) continue;

      table.attrJoin('class', 'no-sort');
      state.tokens.splice(i - 3, 3);
      i -= 3;
    }
  });
}
