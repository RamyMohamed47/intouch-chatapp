# intouch-chatapp

Backend API and Socket.IO server for a SaaS chat application.

## Development

Install dependencies:

```bash
npm install
```

Run the TypeScript development server:

```bash
npm run dev
```

The current static frontend has been removed. Use the API and Socket.IO server
from a dedicated frontend client.

Health check:

```http
GET /health
```

Run the full verification suite:

```bash
npm run check
```

## Runtime

The server reads `config.env` from the project root. Required values:

- `ACCESS_TOKEN_SECRET`, at least 32 bytes
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

Example development auth configuration:

```dotenv
ACCESS_TOKEN_SECRET=replace-with-at-least-32-random-bytes
CLIENT_ORIGINS=http://localhost:5173
GOOGLE_OAUTH_CLIENT_ID=replace-with-google-web-client-id
GOOGLE_OAUTH_CLIENT_SECRET=replace-with-google-web-client-secret
GOOGLE_OAUTH_CALLBACK_URL=http://localhost:5173/api/v1/auth/oauth/google/callback
GOOGLE_OAUTH_FRONTEND_REDIRECT_URL=http://localhost:5173/auth/callback
```

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

Development logs are formatted for readability. Production logs are structured
JSON written to stdout.
Pino HTTP still sets `X-Request-Id`, but automatic request completed logs are
disabled to keep local output readable. Socket connection logs are emitted at
`debug`, so they are hidden by the default `info` level.

Production runs from compiled output:

```bash
npm run build
npm start
```
