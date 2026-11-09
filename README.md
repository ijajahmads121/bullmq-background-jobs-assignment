# Background Jobs with BullMQ

A small Express API that queues email-verification OTPs in BullMQ and verifies them with expiry and attempt-limit checks.

## Setup

1. Install Node.js and Redis.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and configure SMTP credentials if you intend to run the worker.
4. Start Redis (`redis-server`).
5. Run `npm test` to check the request/verification flow.

Run the API with `npm start` and the separate email worker with `npm run worker`. The API enqueues mail jobs; it does not wait for SMTP delivery.

## Endpoints

- `POST /auth/request-verification` with `{ "email": "person@example.com" }` stores a six-digit OTP and queues an email job.
- `POST /auth/verify-otp` with `{ "email": "person@example.com", "otp": "123456" }` verifies the code. Codes expire after ten minutes and are single-use. Three incorrect submissions are allowed; further attempts are rate-limited.

SMTP credentials and `.env` are not committed.
