# Project Structure

Backend application: `apps/api`

Frontend application: `apps/web`

Shared contracts: `packages/shared`

Mobile application: `apps/mobile` (Expo Router, React Native, TypeScript)

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

```text
apps/mobile/
|-- src/app/              # Expo Router route groups and screens
|-- src/components/       # Shared native UI primitives
|-- src/core/             # Runtime configuration and API transport
|-- src/features/         # Auth, organizations, chat, uploads, and realtime
|-- assets/               # Bundled icons and chat wallpapers
|-- app.config.ts
|-- eas.json
`-- package.json
```

API feature modules live under `apps/api/src/modules`. Controllers and socket
handlers stay transport-only. Services own business rules. Repositories own
MongoDB persistence and aggregation. Shared Zod contracts belong in
`packages/shared`; do not duplicate them in an app.

Mobile uses TanStack Query for server state, React context for authentication
and appearance, SecureStore for refresh credentials, and AsyncStorage only for
non-sensitive preferences. It imports transport contracts from
`@intouch/shared` rather than redefining API or Socket.IO payloads.
