# Local Docker Infrastructure

InTouch runs application code natively and uses Docker Compose only for local
infrastructure. This keeps TypeScript and Next.js feedback fast while making
MongoDB transactions, Redis coordination, BullMQ, and transactional email
testing reproducible.

## Services

`compose.infrastructure.yml` uses the stable Compose project name `intouch` and
provides:

- MongoDB 8 as a single-node `rs0` replica set on `127.0.0.1:27017`.
- Redis 8 with AOF persistence and `maxmemory-policy noeviction` on
  `127.0.0.1:6379`.
- Mailpit SMTP on `127.0.0.1:1025` and its browser UI on
  `http://localhost:8025`.

MongoDB and Redis use named volumes. Mailpit is intentionally disposable, so
captured messages are cleared when its container is recreated.

All published ports bind to loopback. The services have no local authentication
and must not be exposed to another network or reused as production
configuration.

## Standard Workflow

From the repository root:

```bash
npm run infra:up
npm run dev
```

`infra:up` waits until every service is healthy. It also initializes the MongoDB
replica set idempotently and reports MongoDB healthy only after the node is a
writable primary.

Useful commands:

```bash
npm run infra:status
npm run infra:logs
npm run infra:down
npm run infra:validate
```

`infra:down` removes containers and the network but preserves MongoDB and Redis
volumes. `infra:reset` is deliberately destructive and removes both persistent
volumes:

```bash
npm run infra:reset
```

The compatibility commands `redis:up` and `redis:down` start or stop only the
Redis service from the consolidated Compose definition.

## API Configuration

Apply these values to the ignored `apps/api/config.env`; Compose does not copy
or modify that file:

```dotenv
DATABASE=mongodb://127.0.0.1:27017/intouch?replicaSet=rs0
DB_PASSWORD=unused
RUNTIME_STATE_PROVIDER=redis
REDIS_URL=redis://127.0.0.1:6379
REDIS_KEY_PREFIX=intouch:development:v2
BACKGROUND_JOBS_PROVIDER=bullmq
MAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_REQUIRE_TLS=false
SMTP_USER=unused
SMTP_PASSWORD=unused
```

Mailpit accepts the placeholder local credentials. Registration, password
reset, and organization-invitation messages can be inspected at
`http://localhost:8025`.

## Health Inspection

Inspect the stack with:

```bash
npm run infra:status
docker compose -f compose.infrastructure.yml exec mongo mongosh --quiet --eval "db.hello()"
docker compose -f compose.infrastructure.yml exec redis redis-cli ping
docker compose -f compose.infrastructure.yml exec redis redis-cli CONFIG GET appendonly
docker compose -f compose.infrastructure.yml exec redis redis-cli CONFIG GET maxmemory-policy
```

MongoDB must report `setName: 'rs0'` and `isWritablePrimary: true`. Redis must
report `PONG`, `appendonly` as `yes`, and `maxmemory-policy` as `noeviction`.
With the API running, `/ready` should return `200`.

## Troubleshooting

- Start Docker Desktop and use its Linux engine before running `infra:up`.
- If a published port is unavailable, stop the existing local MongoDB, Redis,
  SMTP, or Mailpit process rather than exposing the Compose services on a
  different interface.
- Use `npm run infra:status` and `npm run infra:logs` when a service does not
  become healthy.
- A fresh MongoDB volume is independent of Atlas and any prior standalone local
  database. No data is imported automatically.
- Restarting with `infra:down` followed by `infra:up` preserves MongoDB and
  Redis data. Only `infra:reset` removes it.
- The same Redis volume key and Compose project name are retained from the
  previous Redis-only setup so existing local Redis data remains available.

This stack is development-only. Railway, Atlas, Cloudflare R2, and production
service configuration remain separate.
