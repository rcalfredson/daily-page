/**
 * Canonical view path for a block.
 * Accepts:
 *  - (roomId, blockId) strings
 *  - a block-like object containing roomId/room_id and _id/id/blockId/block_id
 */
export function canonicalBlockPath(input, blockIdMaybe) {
  // canonicalBlockPath(docOrObj) OR canonicalBlockPath(roomId, blockId)
  const roomId =
    (typeof input === 'string')
      ? input
      : (input?.roomId ?? input?.room_id);

  const blockId =
    (typeof input === 'string')
      ? blockIdMaybe
      : (input?._id ?? input?.id ?? input?.blockId ?? input?.block_id);

  if (!roomId || !blockId) throw new Error('canonicalBlockPath requires roomId and blockId');

  return `/rooms/${roomId}/blocks/${blockId}`;
}

export function canonicalBlockEditPath(input, blockIdMaybe) {
  return `${canonicalBlockPath(input, blockIdMaybe)}/edit`;
}
