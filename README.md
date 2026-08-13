# intouch-chatapp

Full-stack API, Socket.IO, and Next.js application for a SaaS chat platform.

## Development

Install dependencies:

```bash
npm install
```

Run the API, shared-contract watcher, and web application together:

```bash
npm run dev
```

The API runs at `http://localhost:3000` and the web application runs at
`http://localhost:3001`. The frontend lives in `apps/web` and proxies browser
requests from `/api/*` to the API so refresh cookies remain first-party.

Run either application independently when needed:

```bash
npm run dev:api
npm run dev:web
```

Frontend server settings are documented in `apps/web/.env.example`.
`BACKEND_ORIGIN` is server-only and powers the same-origin API proxy;
`NEXT_PUBLIC_SOCKET_ORIGIN` is the direct Socket.IO endpoint. The application
uses the proxy for REST and OAuth while Socket.IO connects directly to the API.

Health check:

```http
GET /health
```

## API Documentation

Public, read-only Swagger documentation is available through the frontend's
same-origin proxy:

- `/api/docs/` for the branded Swagger UI
- `/api/openapi.yaml` for the canonical YAML contract
- `/api/openapi.json` for tools that consume JSON

The same paths are available directly on the API origin. Swagger is configured
for browsing only: request execution and persisted authorization are disabled.
Use the application, Postman, curl, or another authorized client for manual API
requests. Socket.IO is outside OpenAPI and remains documented in
`.agents/sockets/Socket Events.md`.

The authored contract remains `.agents/api/openapi.yaml`. Validate it with:

```bash
npm run openapi:lint
```

Run formatting, linting, strict TypeScript, shared/API tests, and production
builds without launching browser tests:

```bash
npm run check
```

Run Playwright separately only when frontend end-to-end verification is
needed:

```bash
npm run test:web:e2e
```

To run both workflows explicitly:

```bash
npm run check:all
```

## Runtime

The API reads `apps/api/config.env`. The path is resolved from the API package,
so root commands, workspace commands, source execution, and compiled execution
load the same local file. Start from `apps/api/config.env.example`; required
values are:

- `ACCESS_TOKEN_SECRET`, at least 32 bytes
- `LOGIN_THROTTLE_SECRET`, an independent secret of at least 32 bytes
- `CLIENT_ORIGINS`, comma-separated exact frontend origins
- `DATABASE`
- `DB_PASSWORD`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_CALLBACK_URL`
- `GOOGLE_OAUTH_FRONTEND_REDIRECT_URL`

`DATABASE` must connect to a MongoDB replica set or sharded cluster because
organization creation and deletion use transactions. Atlas deployments support
transactions. A standalone MongoDB server is rejected during startup.

For local development, initialize MongoDB as a single-node replica set and use
a URI containing the replica-set name, for example:

```dotenv
DATABASE=mongodb://127.0.0.1:27017/intouch?replicaSet=rs0
DB_PASSWORD=unused
```

Start `mongod` with `--replSet rs0`, then initialize it once from `mongosh`:

```javascript
rs.initiate();
```

Optional:

- `ACCESS_TOKEN_AUDIENCE`, defaults to `intouch-client`
- `ACCESS_TOKEN_ISSUER`, defaults to `intouch-api`
- `PORT`, defaults to `3000`
- `LOG_LEVEL`, defaults to `info` outside tests
- `LOGIN_ATTEMPT_LIMIT`, defaults to `10`
- `LOGIN_ATTEMPT_WINDOW_MS`, defaults to `900000` (15 minutes)
- `LOGIN_ATTEMPT_COOLDOWN_MS`, defaults to `900000` (15 minutes)

Example development auth configuration:

```dotenv
ACCESS_TOKEN_SECRET=replace-with-at-least-32-random-bytes
LOGIN_THROTTLE_SECRET=replace-with-an-independent-32-byte-secret
CLIENT_ORIGINS=http://localhost:3001
GOOGLE_OAUTH_CLIENT_ID=replace-with-google-web-client-id
GOOGLE_OAUTH_CLIENT_SECRET=replace-with-google-web-client-secret
GOOGLE_OAUTH_CALLBACK_URL=http://localhost:3001/api/v1/auth/oauth/google/callback
GOOGLE_OAUTH_FRONTEND_REDIRECT_URL=http://localhost:3001/auth/callback
```

Password login uses independent per-IP and MongoDB-backed per-account limits.
Account attempts are keyed by an HMAC of the normalized email, the first ten
attempts within fifteen minutes are admitted, and further attempts receive a
generic `429` response during a non-extending fifteen-minute cooldown.
Successful password or verified Google authentication clears the account
attempt state.

## Google OAuth

Create an OAuth 2.0 Web application in Google Cloud and register the exact value
of `GOOGLE_OAUTH_CALLBACK_URL` as an authorized redirect URI. Production values
must use HTTPS, and both Google OAuth URL origins must be included in
`CLIENT_ORIGINS`.

Start sign-in by navigating the browser to:

```http
GET /api/v1/auth/oauth/google
```

The backend creates the OAuth state, redirects to Google, handles the callback,
sets the InTouch refresh cookie, and redirects to
`GOOGLE_OAUTH_FRONTEND_REDIRECT_URL?googleAuth=success`. The frontend must then
call `POST /api/v1/auth/refresh` with `X-CSRF-Protection: 1` to receive the
access JWT. A failed or cancelled flow redirects with `googleAuth=failed`.

Only `openid`, `email`, and `profile` are requested. Google access and refresh
tokens are not stored.

## Organization Memberships

Organization owners can invite an existing registered user by email through
`POST /api/v1/organizations/:id/invitations`. Invitations remain pending for
seven days. No email is sent; authenticated recipients discover them through
`GET /api/v1/invitations`, then accept or decline them.

Authenticated users can join public organizations directly through
`POST /api/v1/organizations/:id/join`. Private organizations require invitation
acceptance. Invitation acceptance and public joining create `MEMBER`
memberships; ownership transfer is not supported.

## Categories And Channels

Organization owners manage ordered categories through
`/api/v1/organizations/:organizationId/categories` and channel conversations
through `/api/v1/organizations/:organizationId/conversations`. Every channel is
a `Conversation` with `type: CHANNEL` and belongs to one category.

Public channels are available to all current organization members. Private
channels require an explicit participant record in addition to organization
membership. Every member can list the safe organization roster and presence at
`GET /api/v1/organizations/:organizationId/members` and manage private-channel
participants remain owner-managed under
`/api/v1/conversations/:conversationId/participants`.

Message history and creation are scoped to
`/api/v1/conversations/:conversationId/messages`. Message edits and redacted
deletions use `/api/v1/messages/:messageId`. History uses a `before` message-ID
cursor and a `limit` from 1 to 100.

One-to-one direct messages use the same `Conversation` collection with
`type: DIRECT`. Create or retrieve the pair idempotently with
`POST /api/v1/organizations/:organizationId/direct-messages`; list the caller's
DMs with the cursor-paginated `GET` endpoint at the same path. Both users must
remain organization members and conversation participants.

Advance a conversation's durable high-water read state with
`PUT /api/v1/conversations/:conversationId/read-receipt`. Conversation summaries
include the last message, unread count, and caller read state. DM read updates
are broadcast; channel read activity remains private.

Socket.IO clients authenticate with `auth: { accessToken }`, then emit
`conversation:join` before receiving scoped message events. Organization
subscriptions provide presence; joined conversation rooms support expiring
typing indicators. REST remains the only durable write transport. Presence and
typing are in-memory, so this version must run as one application instance. See
`.agents/sockets/Socket Events.md` for event contracts.

After deploying the runtime-presence model, remove legacy persisted `status`
fields idempotently with `npm run migrate:remove-user-status`. `lastSeenAt` is
the only persisted user presence field.

## Authentication Proxy

Production browser requests should use the frontend's same-origin `/api` proxy,
which forwards to the Railway API. The proxy must preserve `Origin`, `Cookie`,
`Set-Cookie`, `Location`, callback query parameters, `Authorization`, and
`X-CSRF-Protection` headers. It must also pass Google start and callback
redirects through without following them server-side.

Register and login responses set an `HttpOnly` refresh cookie. The browser never
receives the refresh token in JSON. Refresh requests must include
`X-CSRF-Protection: 1`; the access token remains a Bearer token and should be
stored in frontend memory. The production cookie is `Secure`, `SameSite=Lax`,
and scoped to `/api/v1/auth`.

The web application restores sessions with `POST /api/v1/auth/refresh`, keeps
the access JWT in memory, and uses TanStack Query for API-backed server state.
`POST /api/v1/auth/logout` requires the same Origin and CSRF protection,
idempotently revokes the current refresh session, and clears the cookie. The
browser then clears its query cache and Socket.IO lifecycle before returning to
login.

Socket.IO connects directly to `NEXT_PUBLIC_SOCKET_ORIGIN`. REST and Google
OAuth continue through the frontend `/api` proxy. The current presence and
typing stores are process-local, so realtime deployment remains single-instance
until Redis-backed stores and the Socket.IO Redis adapter are introduced.

Authenticated messaging writes and realtime resource-acquiring events are
protected by per-user token buckets. Active sockets are capped at five per
user, and cleanup events remain unthrottled. These counters are process-local
in the current single-instance deployment; horizontal scaling requires
Redis-backed rate-limit and connection stores.

The Next.js frontend emits a per-request nonce Content Security Policy for page
documents. Production scripts require the nonce, Socket.IO connections are
restricted to `NEXT_PUBLIC_SOCKET_ORIGIN`, framing and object embedding are
disabled, and the theme bootstrap receives the request nonce. Inline styles
remain permitted for runtime component positioning.

Development logs are formatted for readability. Production logs are structured
JSON written to stdout.
Pino HTTP still sets `X-Request-Id`, but automatic request completed logs are
disabled to keep local output readable. Socket connection logs are emitted at
`debug`, so they are hidden by the default `info` level.

## Repository Layout

```text
apps/
|-- api/                  # Express, Socket.IO, MongoDB, API tests and migrations
`-- web/                  # Next.js frontend and same-origin API proxy
packages/
`-- shared/               # Transport-neutral Zod contracts and shared types
```

The future mobile client belongs at `apps/mobile` and should consume
`@intouch/shared`; it is intentionally not scaffolded until its framework and
native authentication transport are selected.

## Railway Deployment

Keep Railway's build context at the repository root because `@intouch/api`
depends on `packages/shared`. Do not set the service Root Directory to
`/apps/api`.

- Build command: `npm run build:api`
- Start command: `npm run start:api`
- Watch paths: `/apps/api/**`, `/packages/shared/**`, `/package.json`,
  `/package-lock.json`, and `/tsconfig.base.json`

API production output is written to `apps/api/dist`. Railway runtime variables
come from the service environment; `apps/api/config.env` remains local and
ignored by Git.

Build both applications from the workspace root:

```bash
npm run build
```

Run the API and web production processes separately:

```bash
npm start
npm run start:web
```
