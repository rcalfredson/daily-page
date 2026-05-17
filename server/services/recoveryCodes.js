import crypto from 'crypto';
import bcrypt from 'bcrypt';

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_LENGTH = 12;
const RECOVERY_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function randomRecoveryCode() {
  let code = '';
  const bytes = crypto.randomBytes(RECOVERY_CODE_LENGTH);

  for (const byte of bytes) {
    code += RECOVERY_CODE_ALPHABET[byte % RECOVERY_CODE_ALPHABET.length];
  }

  return code.replace(/(.{4})(?=.)/gu, '$1-');
}

export function normalizeRecoveryCode(code) {
  return String(code || '').replace(/[^a-zA-Z0-9]/gu, '').toUpperCase();
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  const codes = new Set();

  while (codes.size < count) {
    codes.add(randomRecoveryCode());
  }

  return [...codes];
}

export async function hashRecoveryCodes(codes) {
  return Promise.all(codes.map((code) => bcrypt.hash(normalizeRecoveryCode(code), 10)));
}

export async function consumeRecoveryCode(user, code) {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized || normalized.length < RECOVERY_CODE_LENGTH) return false;

  const hashes = user.twoFactorRecoveryCodes || [];
  for (let index = 0; index < hashes.length; index += 1) {
    if (await bcrypt.compare(normalized, hashes[index])) {
      user.twoFactorRecoveryCodes = hashes.filter((_, hashIndex) => hashIndex !== index);
      user.updatedAt = new Date();
      await user.save();
      return true;
    }
  }

  return false;
}
