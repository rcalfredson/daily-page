// server/utils/anonymousId.js
import { v4 as uuidv4 } from 'uuid';

export function generateAnonymousId() {
  return `anonymous_${uuidv4()}`;
}
