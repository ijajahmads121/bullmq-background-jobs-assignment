const { randomInt } = require('node:crypto');

const store = new Map();
const verifiedEmails = new Set();
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 3;

function generateOTP() {
  return String(randomInt(100000, 1000000));
}

function storeOTP(email, otp) {
  store.set(email, {
    otp: String(otp),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0
  });
}

function verifyOTP(email, code) {
  const entry = store.get(email);
  if (!entry) return { ok: false, reason: 'not_found' };
  if (Date.now() > entry.expiresAt) return { ok: false, reason: 'expired' };
  if (entry.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: 'too_many_attempts' };
  }
  if (entry.otp !== String(code)) {
    entry.attempts += 1;
    return { ok: false, reason: 'wrong_code' };
  }

  store.delete(email);
  return { ok: true };
}

function markVerified(email) {
  verifiedEmails.add(email);
}

module.exports = {
  generateOTP,
  storeOTP,
  verifyOTP,
  markVerified,
  _store: store
};
