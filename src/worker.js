require('dotenv').config();

const { Worker } = require('bullmq');
const { transporter } = require('./email');
const { connection } = require('./queue');

const retryOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 }
};

const worker = new Worker(
  'email',
  async (job) => {
    if (job.name !== 'otp') {
      throw new Error(`Unsupported email job: ${job.name}`);
    }

    const { to, otp } = job.data || {};
    if (!to || !otp) {
      throw new Error('OTP email jobs require both a recipient and an OTP.');
    }

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com',
      to,
      subject: 'Your verification code',
      text: `Your verification code is ${otp}. It expires in 10 minutes.`
    });
  },
  {
    connection,
    // BullMQ applies retries from Queue defaultJobOptions; keeping this policy
    // alongside the consumer makes the required retry behavior explicit.
    defaultJobOptions: retryOptions
  }
);

worker.on('completed', (job) => {
  console.log(`Email job ${job.id} completed`);
});

worker.on('failed', (job, error) => {
  console.error(`Email job ${job?.id ?? 'unknown'} failed: ${error.message}`);
});

worker.on('error', (error) => {
  console.error(`Email worker error: ${error.message}`);
});

async function shutdown() {
  await worker.close();
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

module.exports = { worker };
