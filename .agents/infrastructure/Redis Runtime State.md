# Redis Runtime State

Production uses Redis for ephemeral coordination between API replicas. MongoDB
remains the durable source of truth.

## Redis Owns

- Socket.IO Pub/Sub adapter traffic and cross-replica room broadcasts.
- Presence socket leases, active-user expiry, and offline-transition claims.
- Typing socket leases and expiry claims.
- Authenticated per-user token buckets.
- Active Socket.IO connection limits.
- Public authentication endpoint IP limit windows.
- BullMQ scheduling and delivery state for transactional mail and private-asset
  cleanup. Queue payloads contain opaque MongoDB IDs only.

Redis does not become the durable source of truth for refresh sessions,
login-attempt records, notifications, mail outbox records, uploads, messages,
memberships, or read receipts. MongoDB reconcilers can recreate BullMQ work.

## Runtime Policies

- Socket and presence leases renew every 15 seconds and expire after 45 seconds.
- A normal final disconnect and an expired lease both use the five-second
  presence offline grace period.
- Typing clients refresh every three seconds and typing expires after five
  seconds.
- Expired presence and typing transitions are claimed atomically by one API
  replica before final events are broadcast.
- Existing authenticated rate-limit capacities and refill policies are shared
  across replicas without changing their public responses.

## Configuration

The standard local stack uses `RUNTIME_STATE_PROVIDER=redis` and
`BACKGROUND_JOBS_PROVIDER=bullmq`. Start the complete infrastructure stack with
`npm run infra:up`; `redis:up` and `redis:down` remain Redis-only compatibility
commands. Memory runtime state and polling jobs remain available as an explicit
fallback when Redis behavior is not under test.

Local configuration:

```dotenv
RUNTIME_STATE_PROVIDER=redis
REDIS_URL=redis://127.0.0.1:6379
REDIS_KEY_PREFIX=intouch:development:v2
BACKGROUND_JOBS_PROVIDER=bullmq
```

Production requires:

```dotenv
RUNTIME_STATE_PROVIDER=redis
REDIS_URL=redis://default:password@private-host:6379
REDIS_KEY_PREFIX=intouch:production:v2
BACKGROUND_JOBS_PROVIDER=bullmq
```

Every replica in one environment must share the URL and key prefix. Separate
environments must use separate prefixes.

BullMQ keys use the `${REDIS_KEY_PREFIX}:bullmq` namespace. Redis must use the
`noeviction` max-memory policy. Workers run in each API replica with shared
global concurrency, and MongoDB remains authoritative for outbox and asset
lifecycle state. Local memory mode defaults to
`BACKGROUND_JOBS_PROVIDER=polling`; BullMQ cannot be selected without Redis.

The consolidated local Compose service enables AOF and configures
`maxmemory-policy noeviction`. See
`.agents/infrastructure/Local Docker Infrastructure.md` for lifecycle and
inspection commands.

## Failure Behavior

The API does not fall back from Redis to memory in production. Startup fails if
Redis cannot be reached. After startup, `/health` remains a process-liveness
check while `/ready` returns `503` if MongoDB, Redis, or the selected background
job runtime is unavailable.
Protected runtime operations fail closed. Socket connection middleware returns
`SERVICE_UNAVAILABLE`; the web client retries without rotating authentication
tokens.

The standard Socket.IO Redis adapter uses Pub/Sub and does not replay events
missed while a client or replica is disconnected. Durable state is reconciled
from MongoDB after reconnects.
