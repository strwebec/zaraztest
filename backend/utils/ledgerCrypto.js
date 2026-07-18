const crypto = require('crypto');

// Business-entered financial figures (revenue breakdowns, expense lines, margins)
// are the most sensitive data a business owner puts into the platform — encrypted
// at rest with AES-256-GCM so a DB dump or backup leak doesn't expose them in plain
// text. Values are decrypted only in-memory, in the request handler that needs them.
const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.LEDGER_ENCRYPTION_KEY, 'hex');

function encryptValue(plainValue) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainValue), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptValue(storedValue) {
  if (typeof storedValue !== 'string') return null;
  const parts = storedValue.split(':');
  if (parts.length !== 3) return null;
  const [ivHex, tagHex, dataHex] = parts;
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

module.exports = { encryptValue, decryptValue };
