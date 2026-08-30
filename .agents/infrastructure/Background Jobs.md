# Background Jobs

InTouch uses BullMQ when `BACKGROUND_JOBS_PROVIDER=bullmq` and the original
leased MongoDB pollers when `BACKGROUND_JOBS_PROVIDER=polling`. Production uses
BullMQ; polling is the local-memory default and emergency rollback path.

## Ownership

- MongoDB `MailOutbox` records own durable mail state and encrypted payloads.
- MongoDB `StoredAsset` records own durable R2 lifecycle and cleanup state.
- BullMQ owns dispatch, retry timing, shared concurrency, and short-lived job
  history only.
- In-app notifications remain transactional MongoDB writes and are not queued.

Redis payloads contain only opaque MongoDB IDs, cleanup mode, and an integer
attempt version. They never contain recipients, tokens, filenames, object keys,
presigned URLs, or email bodies.

## Queues

All keys are under `${REDIS_KEY_PREFIX}:bullmq`.

- `mail-delivery`: reconciles every two seconds, global concurrency 5, global
  rate limit 10 jobs/second, and preserves mail delays of 30 seconds, 2 minutes,
  5 minutes, and 10 minutes across at most five delivery attempts.
- `asset-cleanup`: reconciles every five seconds in batches of 20, global
  concurrency 5, and performs three BullMQ retries with exponential delay before
  returning the asset to MongoDB's bounded cleanup backoff.

Every mutation remains idempotent through repository-level leases and status
conditions. Reconciliation recovers committed MongoDB work after API crashes,
Redis restarts, or enqueue gaps. Queue failures never roll back an already
committed domain mutation.

## Lifecycle

API startup connects MongoDB and waits for queue and worker readiness before
listening. `/ready` requires MongoDB, Redis runtime state, and the background-job
runtime. Graceful shutdown stops Socket.IO and HTTP admission, drains workers,
closes queues and the mail transport, then closes Redis and MongoDB.

Workers run inside every API replica. BullMQ global limits keep aggregate
throughput bounded as replicas scale. Redis must use `noeviction`. There is no
public queue endpoint or Bull Board deployment; structured logs are the current
operational interface.
