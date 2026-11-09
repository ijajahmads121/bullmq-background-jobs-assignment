require('dotenv').config();

const express = require('express');
const { emailQueue } = require('./queue');
const { generateOTP, storeOTP, verifyOTP, markVerified } = require('./otpStore');

const app = express();
app.use(express.json());

app.post('/auth/request-verification', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (typeof email !== 'string' || email.trim() === '') {
      return res.status(400).json({ error: 'A valid email is required.' });
    }

    const otp = generateOTP();
    storeOTP(email, otp);
    await emailQueue.add('otp', { to: email, otp });

    return res.status(200).json({ message: 'Verification email sent.' });
  } catch (error) {
    return next(error);
  }
});

app.post('/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body || {};
  const result = verifyOTP(email, otp);

  if (!result.ok) {
    const statusByReason = {
      not_found: 401,
      expired: 410,
      too_many_attempts: 429,
      wrong_code: 401
    };
    return res.status(statusByReason[result.reason] || 401).json({ error: result.reason });
  }

  markVerified(email);
  return res.status(200).json({ message: 'Email verified.' });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  return res.status(500).json({ error: 'Internal server error.' });
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`API listening on port ${port}`));
}

module.exports = app;
