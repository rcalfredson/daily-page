import crypto from 'node:crypto';
import { canonicalForestWritingLink } from './forestAuthoredObjectFormat.js';

export function createForestAuthoredCreationFingerprint({ objectId, kind, worldX, worldY, writingLink }) {
  // Freeze the legacy byte encoding. No mutable schema/protocol constant may change its meaning.
  const fields = [writingLink === undefined ? 1 : 2, objectId, kind, worldX, worldY, 'quiet-waymarker', 1];
  if (writingLink !== undefined) {
    const link = canonicalForestWritingLink(writingLink);
    fields.push(link.version, link.writingTreeId);
  }
  return Object.freeze({
    version: writingLink === undefined ? 1 : 2,
    digest: crypto.createHash('sha256').update(JSON.stringify(fields), 'utf8').digest('base64url')
  });
}
