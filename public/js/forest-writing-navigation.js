// Forest inspection returns canonical post paths without a query or fragment.
// Carry only presentation context: the post and forest still authorize their own reads.
export function forestReturnTreeId(value) {
  return typeof value === 'string'
    && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)
    ? value.toLowerCase() : null;
}

export function forestWritingPostPath(path, writingTreeId = null) {
  const treeId = forestReturnTreeId(writingTreeId);
  return `${path}?from=forest${treeId ? `&returnTree=${treeId}` : ''}`;
}

export function forestReturnLocator(query = {}) {
  if (query.returnTree !== undefined && query.returnMarker !== undefined) return null;
  const markerId = forestReturnTreeId(query.returnMarker);
  if (markerId) return { returnMarkerId: markerId };
  const treeId = forestReturnTreeId(query.returnTree);
  return treeId ? { returnTreeId: treeId } : null;
}

export function forestMarkerWritingPostPath(path, objectId) {
  const markerId = forestReturnTreeId(objectId);
  return `${path}?from=forest${markerId ? `&returnMarker=${markerId}` : ''}`;
}
