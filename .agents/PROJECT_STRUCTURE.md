# Project Structure

Backend application: `apps/api`

Frontend application: `apps/web`

Shared contracts: `packages/shared`

Future mobile application: `apps/mobile` (reserved, not scaffolded)

```text
apps/api/
|-- src/
|   |-- config/
|   |-- middleware/
|   |-- migrations/
|   |-- modules/
|   `-- sockets/
|-- tests/
|-- config.env
|-- package.json
`-- tsconfig.build.json
```

API feature modules live under `apps/api/src/modules`. Controllers and socket
handlers stay transport-only. Services own business rules. Repositories own
MongoDB persistence and aggregation. Shared Zod contracts belong in
`packages/shared`; do not duplicate them in an app.
