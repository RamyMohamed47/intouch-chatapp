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

Redis does not store refresh sessions, login-attempt records, notifications,
mail outbox jobs, uploads, messages, memberships, or read receipts.

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

Local development defaults to `RUNTIME_STATE_PROVIDER=memory`. Redis can be
started locally with `npm run redis:up` and stopped with `npm run redis:down`.

Production requires:

```dotenv
RUNTIME_STATE_PROVIDER=redis
REDIS_URL=redis://default:password@private-host:6379
REDIS_KEY_PREFIX=intouch:production:v2
```

Every replica in one environment must share the URL and key prefix. Separate
environments must use separate prefixes.

## Failure Behavior

The API does not fall back from Redis to memory in production. Startup fails if
Redis cannot be reached. After startup, `/health` remains a process-liveness
check while `/ready` returns `503` if MongoDB or Redis is unavailable.
Protected runtime operations fail closed. Socket connection middleware returns
`SERVICE_UNAVAILABLE`; the web client retries without rotating authentication
tokens.

The standard Socket.IO Redis adapter uses Pub/Sub and does not replay events
missed while a client or replica is disconnected. Durable state is reconciled
from MongoDB after reconnects.
