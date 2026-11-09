const assert = require('node:assert/strict');
const app = require('../src/app');
const { emailQueue } = require('../src/queue');
const { _store } = require('../src/otpStore');

const cases = [];
function test(name, fn) {
  cases.push({ name, fn });
}

let server;
let baseUrl;
let emailCounter = 0;
function nextEmail() {
  emailCounter += 1;
  return `learner-${Date.now()}-${emailCounter}@example.test`;
}
async function post(path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}
async function requestOtp(email) {
  const response = await post('/auth/request-verification', { email });
  assert.equal(response.status, 200);
  return _store.get(email).otp;
}

test('request-verification returns 200 and a message', async () => {
  const response = await post('/auth/request-verification', { email: nextEmail() });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.match(body.message, /sent/i);
});

test('the generated OTP is six digits and the email job is queued', async () => {
  const email = nextEmail();
  await requestOtp(email);
  const otp = _store.get(email).otp;
  assert.match(otp, /^\d{6}$/);
  const jobs = await emailQueue.getJobs(['waiting', 'delayed', 'active']);
  const job = jobs.find((candidate) => candidate.data.to === email);
  assert.ok(job, 'expected an OTP email job in the queue');
  assert.equal(job.name, 'otp');
  assert.equal(job.data.otp, otp);
});

test('verify-otp accepts the correct OTP', async () => {
  const email = nextEmail();
  const otp = await requestOtp(email);
  const response = await post('/auth/verify-otp', { email, otp });
  assert.equal(response.status, 200);
});

test('verify-otp rejects an incorrect OTP', async () => {
  const email = nextEmail();
  await requestOtp(email);
  const response = await post('/auth/verify-otp', { email, otp: '000000' });
  assert.equal(response.status, 401);
});

test('verify-otp rate-limits after three incorrect attempts', async () => {
  const email = nextEmail();
  await requestOtp(email);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await post('/auth/verify-otp', { email, otp: '000000' });
  }
  const response = await post('/auth/verify-otp', { email, otp: '000000' });
  assert.equal(response.status, 429);
});

test('verify-otp rejects an expired OTP with 410', async () => {
  const email = nextEmail();
  _store.set(email, { otp: '123456', expiresAt: Date.now() - 1, attempts: 0 });
  const response = await post('/auth/verify-otp', { email, otp: '123456' });
  assert.equal(response.status, 410);
});

async function main() {
  let passed = 0;
  let failed = 0;
  try {
    await emailQueue.obliterate({ force: true });
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    for (const scenario of cases) {
      try {
        await scenario.fn();
        passed += 1;
        console.log(`✓ ${scenario.name}`);
      } catch (error) {
        failed += 1;
        console.error(`✗ ${scenario.name}`);
        console.error(error);
      }
    }
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await emailQueue.close();
  }

  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
