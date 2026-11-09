const { Queue } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number.parseInt(process.env.REDIS_PORT || '6379', 10)
};

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 }
};

const emailQueue = new Queue('email', {
  connection,
  defaultJobOptions
});

module.exports = { emailQueue, connection };
