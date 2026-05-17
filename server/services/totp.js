import crypto from 'crypto';
import { Buffer } from 'buffer';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_PERIOD = 30;
const DEFAULT_DIGITS = 6;
const DEFAULT_ALGORITHM = 'sha1';

function base32Encode(buffer) {
  let bits = '';
  let output = '';

  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }

  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }

  return output;
}

function base32Decode(secret) {
  const clean = String(secret || '').replace(/=+$/u, '').replace(/\s+/gu, '').toUpperCase();
  let bits = '';

  for (const char of clean) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) {
      throw new Error('Invalid base32 secret');
    }
    bits += value.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

function counterBuffer(counter) {
  const buffer = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  buffer.writeUInt32BE(high, 0);
  buffer.writeUInt32BE(low, 4);
  return buffer;
}

export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

export function makeOtpAuthUrl({ secret, accountName, issuer = 'Daily Page' }) {
  const label = `${issuer}:${accountName}`;
  const params = {
    secret,
    issuer,
    algorithm: DEFAULT_ALGORITHM.toUpperCase(),
    digits: String(DEFAULT_DIGITS),
    period: String(DEFAULT_PERIOD),
  };
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return `otpauth://totp/${encodeURIComponent(label)}?${query}`;
}

export function generateTotp(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 1000 / DEFAULT_PERIOD);
  const hmac = crypto
    .createHmac(DEFAULT_ALGORITHM, base32Decode(secret))
    .update(counterBuffer(counter))
    .digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  );
  const otp = binary % (10 ** DEFAULT_DIGITS);

  return String(otp).padStart(DEFAULT_DIGITS, '0');
}

export function verifyTotp({ secret, token, window = 1 }) {
  const cleanToken = String(token || '').replace(/\s+/gu, '');
  if (!/^\d{6}$/u.test(cleanToken)) return false;

  const now = Date.now();
  const periodMs = DEFAULT_PERIOD * 1000;

  for (let offset = -window; offset <= window; offset += 1) {
    const expected = generateTotp(secret, now + (offset * periodMs));
    const expectedBuffer = Buffer.from(expected);
    const tokenBuffer = Buffer.from(cleanToken);

    if (
      expectedBuffer.length === tokenBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, tokenBuffer)
    ) {
      return true;
    }
  }

  return false;
}
