export function chooseActiveBestOfTab(
  { top24h = [], top7d = [], top30d = [], topAll = [] }
) {
  if (top24h.length) return '24h';
  if (top7d.length) return '7d';
  if (top30d.length) return '30d';
  if (topAll.length) return 'all';
  return 'all'; // si todos vacíos, cae en "All Time"
}
