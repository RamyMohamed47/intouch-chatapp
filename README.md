# intouch-chatapp

Full-stack API, Socket.IO, and Next.js application for a SaaS chat platform.

## Development

Install dependencies:

```bash
npm install
```

Start the local MongoDB replica set, Redis, and Mailpit infrastructure, then run
the native application processes:

```bash
npm run infra:up
npm run dev
```

`infra:up` waits for every service to become healthy. The API, shared-contract
watcher, and web application remain native processes; `npm run dev` does not
start or stop Docker.

Run the application processes together after infrastructure is available:

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
npm run dev:mobile
```

Frontend server settings are documented in `apps/web/.env.example`.
`BACKEND_ORIGIN` is server-only and powers the same-origin API proxy;
`NEXT_PUBLIC_SOCKET_ORIGIN` is the direct Socket.IO endpoint.
`NEXT_PUBLIC_R2_ORIGIN` is the exact Cloudflare R2 S3 origin used only by
browser presigned uploads and private asset reads. The application uses the
proxy for REST and OAuth while Socket.IO and R2 transfers connect directly.

Health check:

```http
GET /health
GET /ready
```

Mailpit captures local transactional email at `http://localhost:8025`.
Infrastructure lifecycle and troubleshooting are documented under
[Local Docker Infrastructure](.agents/infrastructure/Local%20Docker%20Infrastructure.md).
Optional metrics, traces, error monitoring, dashboards, and alert guidance are
documented under [Observability](.agents/infrastructure/Observability.md).

## Mobile Development

`apps/mobile` is an Expo SDK 57 development-build application. It consumes the
same API and `@intouch/shared` contracts as the web client. Start the local
infrastructure and API first, then start Metro separately:

```bash
npm run infra:up
npm run dev:api
npm run dev:mobile
```

Create `apps/mobile/.env.local` from `apps/mobile/.env.example`. A physical
device must use the development machine's LAN address, not `localhost`:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.2:3000
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-web-client-id
```

Set `MOBILE_APP_URL=intouch://` in `apps/api/config.env` so mobile-requested
verification and reset emails can open the app. `EXPO_PUBLIC_*` values are
embedded public configuration and must never contain provider secrets.

Google sign-in requires an InTouch development build, an Android OAuth client
for `com.ramymohamed.intouch`, and the SHA-1 fingerprint of the development or
EAS signing certificate. From `apps/mobile`, initialize the EAS project once,
then create the appropriate internal build:

```bash
eas init
eas build --profile development --platform android
eas build --profile preview --platform android
```

The preview profile produces an installable APK. Expo Go is not supported
because native Google authentication uses native modules. Detailed setup and
manual V1 acceptance steps are in
[Mobile V1](.agents/mobile/Mobile%20V1.md).

## API Documentation

Public, read-only Swagger documentation is available through the frontend's
same-origin proxy:

- `/api/docs` for the branded Swagger UI
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

## Chat Wallpapers

Authenticated users can choose a private chat wallpaper from the conversation
header. InTouch bundles doodle, abstract, and scenery presets with adjustable
dimming. A user default applies to chats without an override, while individual
channel and direct-message overrides synchronize through MongoDB for future
web and mobile clients. Wallpaper images remain client assets; the API stores
only stable preset IDs and dimming values.

## Private File Uploads

Profile avatars, organization logos, and message attachments use a private
Cloudflare R2 bucket.
The API reserves quota and returns five-minute, content-type-bound presigned
`PUT` URLs; the browser uploads directly, then asks the API to verify and
promote the object. Clients never receive R2 credentials or permanent public
URLs. Authorized reads use ten-minute presigned `GET` URLs.

Messages accept up to five 25 MB attachments. Supported formats are JPEG, PNG,
WebP, GIF, PDF, UTF-8 text, CSV, DOCX, XLSX, and PPTX. Archives, executables,
SVG, macro-enabled Office files, and mismatched signatures are rejected.
Attachment claims, avatar replacement, and organization-logo assignment
participate in the same MongoDB transaction as their domain mutation. Avatars
and organization logos are cropped in the browser to metadata-free 512x512
WebP images and limited to 5 MB. Deletions are asynchronous through the durable
leased cleanup worker.

Organization creation accepts an optional completed logo upload ID. Owners can
replace or remove logos later through organization settings. External logo URLs
are unsupported; after deploying this change, remove legacy fields once with:

```bash
npm run migrate:remove-organization-logo-urls
```

## Runtime

The API reads `apps/api/config.env`. The path is resolved from the API package,
so root commands, workspace commands, source execution, and compiled execution
load the same local file. Start from `apps/api/config.env.example`; required
values are:

- `ACCESS_TOKEN_SECRET`, at least 32 bytes
- `LOGIN_THROTTLE_SECRET`, an independent secret of at least 32 bytes
- `AUTH_ACTION_TOKEN_SECRET`, an independent secret of at least 32 bytes
- `MAIL_OUTBOX_ENCRYPTION_SECRET`, an independent secret of at least 32 bytes
- `CLIENT_ORIGINS`, comma-separated exact frontend origins
- `DATABASE`
- `DB_PASSWORD`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_CALLBACK_URL`
- `GOOGLE_OAUTH_FRONTEND_REDIRECT_URL`
- `WEB_APP_URL`, the exact frontend origin used in email links
- `MOBILE_APP_URL`, the native deep-link base; use `intouch://`
- `MAIL_PROVIDER`; use `brevo` for HTTPS delivery or `smtp` for SMTP
- `MAIL_FROM_NAME` and `MAIL_FROM_ADDRESS`
- `SEARCH_PROVIDER`; use `atlas` in production and `native` for local MongoDB
- `RUNTIME_STATE_PROVIDER`; production and the standard local infrastructure
  workflow use `redis`; `memory` remains an explicit fallback
- `REDIS_URL` when Redis runtime state is enabled
- `REDIS_KEY_PREFIX`, optional and namespaced per environment
- `BACKGROUND_JOBS_PROVIDER`; defaults to `bullmq` with Redis and `polling`
  with memory runtime state
- `STORAGE_PROVIDER`; production requires `r2`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and
  `R2_BUCKET_NAME` when R2 storage is enabled

Production observability is optional. When enabled, set
`OBSERVABILITY_PROVIDER=otlp`, the Grafana Cloud
`OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS`, and keep
`OTEL_TRACES_SAMPLER_ARG=0.1`. API and web Sentry projects use their respective
DSNs plus build-only source-map upload settings. See the observability guide for
the exact separation and privacy rules.

`MAIL_PROVIDER=brevo` requires `BREVO_API_KEY`. `MAIL_PROVIDER=smtp` requires
`SMTP_HOST`, `SMTP_USER`, and `SMTP_PASSWORD`.

`DATABASE` must connect to a MongoDB replica set or sharded cluster because
organization creation and deletion use transactions. Atlas deployments support
transactions. A standalone MongoDB server is rejected during startup.

The standard local configuration uses the Docker infrastructure stack:

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

Apply these values manually to the ignored `apps/api/config.env`; the
infrastructure commands never edit real secrets. Start and inspect the stack
with:

```bash
npm run infra:up
npm run infra:status
```

Use `npm run infra:down` to stop containers without deleting MongoDB or Redis
data. `npm run infra:reset` deliberately removes both persistent volumes.
Mailpit data is disposable and resets when its container is recreated. Use a
different Redis key prefix for every shared environment so development,
staging, and production counters cannot collide.

Optional:

- `ACCESS_TOKEN_AUDIENCE`, defaults to `intouch-client`
- `ACCESS_TOKEN_ISSUER`, defaults to `intouch-api`
- `PORT`, defaults to `3000`
- `LOG_LEVEL`, defaults to `info` outside tests
- `LOGIN_ATTEMPT_LIMIT`, defaults to `10`
- `LOGIN_ATTEMPT_WINDOW_MS`, defaults to `900000` (15 minutes)
- `LOGIN_ATTEMPT_COOLDOWN_MS`, defaults to `900000` (15 minutes)
- `MAIL_PROVIDER`, defaults to `smtp` outside production
- `SMTP_PORT`, defaults to `587`
- `SMTP_SECURE`, defaults to `false` for STARTTLS
- `SMTP_REQUIRE_TLS`, defaults to `true` and cannot be disabled in production
- `UPLOAD_DAILY_USER_BYTES`, defaults to `524288000` (500 MB)
- `ORGANIZATION_STORAGE_BYTES`, defaults to `5368709120` (5 GB)

Development/test defaults to `STORAGE_PROVIDER=disabled`. To exercise uploads
locally, set the R2 variables and `STORAGE_PROVIDER=r2` in
`apps/api/config.env`, set `NEXT_PUBLIC_R2_ORIGIN` in `apps/web/.env.local`, and
synchronize exact browser origins:

```bash
npm run storage:cors:sync
```

The CORS command permits only configured `CLIENT_ORIGINS`, `PUT/GET/HEAD`, the
required content header, and exposed `ETag`. Do not enable `r2.dev` public
access and never put R2 credentials in `NEXT_PUBLIC_*` variables.

Example development auth configuration:

```dotenv
ACCESS_TOKEN_SECRET=replace-with-at-least-32-random-bytes
LOGIN_THROTTLE_SECRET=replace-with-an-independent-32-byte-secret
CLIENT_ORIGINS=http://localhost:3001
GOOGLE_OAUTH_CLIENT_ID=replace-with-google-web-client-id
GOOGLE_OAUTH_CLIENT_SECRET=replace-with-google-web-client-secret
GOOGLE_OAUTH_CALLBACK_URL=http://localhost:3001/api/v1/auth/oauth/google/callback
GOOGLE_OAUTH_FRONTEND_REDIRECT_URL=http://localhost:3001/auth/callback
MOBILE_APP_URL=intouch://
```

Password login uses independent per-IP and MongoDB-backed per-account limits.
Account attempts are keyed by an HMAC of the normalized email, the first ten
attempts within fifteen minutes are admitted, and further attempts receive a
generic `429` response during a non-extending fifteen-minute cooldown.
Successful password or verified Google authentication clears the account
attempt state.

## Transactional Email

Password registration requires email confirmation. Registration returns a
pending-account response without an access token or refresh cookie; the user
confirms the 24-hour single-use link before logging in. Forgot-password requests
return the same generic `202` response for every email. Reset links are
single-use, expire after 15 minutes, confirm the account email, and revoke all
existing refresh sessions.

Mail delivery uses a provider-neutral transport behind an encrypted MongoDB
outbox. Brevo uses its transactional HTTPS API and works on cloud plans that
block outbound SMTP. Nodemailer SMTP remains available for local development,
VPS deployments, and hosts that permit SMTP. Local development can use Mailpit
on `localhost:1025` with `SMTP_REQUIRE_TLS=false`; production SMTP must use TLS.
The API retries failed delivery after the database transaction commits, so
registration and invitation writes do not depend on a provider request
succeeding synchronously.

With Redis enabled, BullMQ dispatches committed outbox records with global
concurrency `5`, a global `10/second` provider admission limit, and the existing
five-attempt retry schedule. MongoDB remains authoritative: Redis jobs contain
only opaque outbox IDs, and a two-second reconciler recovers records missed by
process crashes. `BACKGROUND_JOBS_PROVIDER=polling` retains the original leased
MongoDB worker as a local-memory fallback and emergency rollback.

Railway Free, Trial, and Hobby deployments should use Brevo HTTPS:

```dotenv
WEB_APP_URL=https://your-frontend.example
MAIL_PROVIDER=brevo
BREVO_API_KEY=your-brevo-api-key
MAIL_FROM_NAME=InTouch
MAIL_FROM_ADDRESS=your-verified-brevo-sender@example.com
```

SMTP remains available where outbound SMTP is supported:

```dotenv
MAIL_PROVIDER=smtp
SMTP_HOST=your-smtp-provider.example
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=provider-username
SMTP_PASSWORD=provider-password
MAIL_FROM_NAME=InTouch
MAIL_FROM_ADDRESS=noreply@your-verified-domain.example
```

Production requires an explicit `MAIL_PROVIDER`. Credentials for the
unselected provider are ignored. Brevo requests use
`POST https://api.brevo.com/v3/smtp/email` with the configured API key and do
not require an SMTP connection. Outbox jobs that already exhausted all retries
remain failed. Trigger a new verification/reset request where supported;
pending invitations remain available in-app and can be recreated only after
they are declined or expire.

Generate independent random values for `AUTH_ACTION_TOKEN_SECRET` and
`MAIL_OUTBOX_ENCRYPTION_SECRET`; do not reuse the JWT or login-throttle secret.
After deploying this feature to an existing database, mark legacy accounts as
verified once with `npm run migrate:verify-existing-users`.

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

Native mobile Google sign-in sends a Google ID token to
`POST /api/v1/auth/mobile/google`. The API verifies its signature, expiry,
issuer, verified email, and configured web-client audience before issuing
InTouch credentials. Native refresh tokens are returned only by the mobile
session endpoints and are stored in Expo SecureStore; browser authentication
continues to use its HttpOnly refresh cookie and CSRF protection.

## Organization Memberships

Organization owners can invite an existing registered user by email through
`POST /api/v1/organizations/:id/invitations`. Invitations remain pending for
seven days. A transactional invitation email directs the verified recipient to
the existing invitation inbox; authenticated recipients can also discover them
through `GET /api/v1/invitations`, then accept or decline them.

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

Messages support one durable Unicode emoji reaction per user. Selecting another
emoji replaces the previous reaction; selecting the active reaction removes it.
Personalized summaries and paginated safe reactor lists are exposed under
`/api/v1/messages/:messageId/reactions`, while anonymous Socket.IO invalidation
keeps active conversation views synchronized after committed changes.

One-to-one direct messages use the same `Conversation` collection with
`type: DIRECT`. Create or retrieve the pair idempotently with
`POST /api/v1/organizations/:organizationId/direct-messages`; list the caller's
DMs with the cursor-paginated `GET` endpoint at the same path. Both users must
remain organization members and conversation participants.

Advance a conversation's durable high-water read state with
`PUT /api/v1/conversations/:conversationId/read-receipt`. Conversation summaries
include the last message, unread count, and caller read state. DM read updates
are broadcast; channel read activity remains private.

## In-App Notifications

Authenticated users receive a durable notification inbox at
`GET /api/v1/notifications`, with unread filtering, cursor pagination, unread
counts, individual read updates, and mark-all-read support. The inbox covers
organization invitations, accepted invitations, incoming direct messages, and
reactions to the caller's messages. Ordinary channel messages continue to use
conversation unread badges rather than creating notifications.

Unread direct messages from the same conversation are grouped until the
recipient advances that conversation's read receipt. Notification records are
created or cleaned up inside the source domain transaction, expire after 30
days, and are synchronized to the recipient's authenticated user room through
`notification:changed`. MongoDB remains authoritative after reconnects; email
and push notification preferences are not part of this iteration.

Socket.IO clients authenticate with `auth: { accessToken }`, then emit
`conversation:join` before receiving scoped message events. Organization
subscriptions provide presence; joined conversation rooms support expiring
typing indicators. REST remains the only durable write transport. Presence and
typing use in-memory stores in local development and Redis-backed leases in
production. The Socket.IO Redis adapter propagates rooms and broadcasts across
API replicas. See `.agents/sockets/Socket Events.md` for event contracts.

After deploying the runtime-presence model, remove legacy persisted `status`
fields idempotently with `npm run migrate:remove-user-status`. `lastSeenAt` is
the only persisted user presence field.

## Authentication Proxy

Production browser requests should use the frontend's same-origin `/api` proxy,
which forwards to the Railway API. The proxy must preserve `Origin`, `Cookie`,
`Set-Cookie`, `Location`, callback query parameters, `Authorization`, and
`X-CSRF-Protection` headers. It must also pass Google start and callback
redirects through without following them server-side.

Successful login responses set an `HttpOnly` refresh cookie; registration does
not authenticate a pending account. The browser never receives the refresh
token in JSON. Refresh requests must include
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
OAuth continue through the frontend `/api` proxy. The browser uses WebSocket
transport only; the Redis adapter distributes room events between API replicas.

Authenticated messaging writes and realtime resource-acquiring events are
protected by per-user token buckets. Active sockets are capped at five per
user, and cleanup events remain unthrottled. These counters are process-local
in local memory mode and shared through Redis in production. Public auth IP
limits also use Redis, while account-login attempt records remain durable in
MongoDB.

`GET /health` is a liveness endpoint and remains successful while the process
is running. `GET /ready` returns `503` when MongoDB or Redis is unavailable and
is the correct deployment readiness/health-check path for routing traffic.

The Next.js frontend emits a per-request nonce Content Security Policy for page
documents. Production scripts require the nonce, Socket.IO connections are
restricted to `NEXT_PUBLIC_SOCKET_ORIGIN`, and private transfers are restricted
to `NEXT_PUBLIC_R2_ORIGIN`. Framing and object embedding are disabled, and the
theme bootstrap receives the request nonce. Inline styles remain permitted for
runtime component positioning.

Development logs are formatted for readability. Production logs are structured
JSON written to stdout.
Pino HTTP still sets `X-Request-Id`, but automatic request completed logs are
disabled to keep local output readable. Socket connection logs are emitted at
`debug`, so they are hidden by the default `info` level.

For local dashboards and traces, run `npm run observability:up`, enable OTLP in
the API configuration, and open `http://localhost:3002`. No public metrics
endpoint is exposed.

## Organization Search

Authenticated organization members can search accessible messages, channels,
and people from the workspace search control or with `Ctrl/Cmd+K`. Search is
always scoped to one organization. Public channels require current membership;
private channels and direct messages additionally require current
participation. Deleted messages and stale participant records are excluded.

Local development defaults to MongoDB native text search:

```dotenv
SEARCH_PROVIDER=native
```

Production must explicitly use Atlas Search and provision the three versioned
indexes for messages, conversations, and users:

```dotenv
SEARCH_PROVIDER=atlas
```

After setting the API's production environment variables, run this idempotent
command from the repository root against the target Atlas deployment:

```bash
npm run search:index:sync
```

The command creates or updates the `v1` definitions and waits until all indexes
are queryable. A missing or building Atlas index makes only search requests
return `503 SEARCH_UNAVAILABLE`; unrelated API features continue operating.
Atlas result pagination uses opaque `searchAfter` cursors, while native search
uses query-bound relevance cursors. Search terms and matched content are not
written to application logs.

## Echo AI Assistant

Echo is InTouch's optional Gemini-backed workspace assistant. Organization
owners must enable it after accepting the current data-use disclosure, and
every member must separately consent before making a request. Members can ask
questions against authorized workspace context, summarize text conversations,
extract action items, and transform composer drafts. Generated text is always
reviewed by the user before it is sent.

The API retrieves context through the same organization, membership, private
participant, and conversation-access rules as normal application reads. An
organization-wide question searches accessible public text channels only;
conversation-scoped requests may use an accessible text channel or direct
message. Prompts, generated responses, and retrieved excerpts are not persisted
or logged. MongoDB stores only organization enablement and member consent.

AI responses stream directly over authenticated server-sent events. BullMQ is
not used because generation is an interactive request whose browser connection
owns cancellation and output delivery. Redis coordinates daily quotas and
concurrency across API replicas; local development uses the same limits through
the configured runtime-state provider.

AI is disabled by default. To enable Gemini locally or on Railway, configure:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=<server-side-google-ai-studio-key>
GEMINI_MODEL=gemini-3.8-flash
GEMINI_SERVICE_TIER=free
AI_DAILY_USER_REQUESTS=25
AI_DAILY_ORGANIZATION_REQUESTS=200
AI_MAX_CONCURRENT_REQUESTS=4
```

`GEMINI_API_KEY` is API-only; no AI frontend variable is required. Set
`GEMINI_SERVICE_TIER` accurately because the consent notice distinguishes the
configured free and paid provider data terms. Existing organizations require no
migration: settings and consent records are created when the feature is enabled.

## Repository Layout

```text
apps/
|-- api/                  # Express, Socket.IO, MongoDB, API tests and migrations
|-- web/                  # Next.js frontend and same-origin API proxy
`-- mobile/               # Expo Router Android-first native client
packages/
`-- shared/               # Transport-neutral Zod contracts and shared types
```

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

Provision one private Railway Redis service and reference its private URL from
every API replica:

```dotenv
RUNTIME_STATE_PROVIDER=redis
REDIS_URL=${{Redis.REDIS_URL}}
REDIS_KEY_PREFIX=intouch:production:v2
BACKGROUND_JOBS_PROVIDER=bullmq
```

Set the API health-check path to `/ready`. All API replicas must use the same
Redis URL and key prefix. Redis is mandatory in production; startup fails rather
than silently falling back to process-local state. Configure Redis eviction as
`noeviction`, as BullMQ must not lose queue keys under memory pressure. MongoDB
remains authoritative for refresh sessions, login-attempt records,
notifications, mail outbox state, and file metadata.

Railway structured logs and resource graphs remain the first operational view.
Grafana Cloud OTLP export and Sentry are optional external integrations; their
failure does not affect `/ready`. Production setup, dashboard imports, source
maps, and alert thresholds are documented in
`.agents/infrastructure/Observability.md`.

BullMQ workers run inside every API replica. Its shared global concurrency
limits prevent adding replicas from multiplying mail or cleanup throughput.
Mail reconciliation runs every two seconds; private R2 asset cleanup
reconciliation runs every five seconds with batches of 20 and three short
provider retries before MongoDB schedules bounded backoff. `/ready` reports
`503` when the selected queue runtime is not ready. No separate worker Railway
service, migration, or queue dashboard is required.

Voice requires a LiveKit Cloud project. Configure the API service with
`VOICE_PROVIDER=livekit`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and the backend-only
`LIVEKIT_API_SECRET`. Configure the web service with the same public WSS URL as
`NEXT_PUBLIC_LIVEKIT_URL`. Point the LiveKit webhook directly to
`https://<api-origin>/api/v1/integrations/livekit/webhook`; do not route it
through the frontend proxy. Run `npm run migrate:channel-kinds` once before
using voice channels against an existing database. LiveKit hosts WebRTC media,
so Railway needs no UDP or TURN configuration.

Direct calls support durable `AUDIO` and `VIDEO` modes, while voice channels
allow optional participant cameras. Participants can share screens in calls and
voice channels while keeping their cameras active; compatible browser surfaces
may also publish shared audio. Run `npm run migrate:call-media-modes` once after
deploying video support to backfill existing call history as audio. Screen
sharing requires no new LiveKit or Railway variables and is never persisted or
resumed automatically after a reload.

Direct-call ringing uses original, self-hosted InTouch tones. Recipients hear
the incoming chime while a call is `RINGING`; callers hear the quieter related
ringback. Both stop before participant audio begins and failures to load or
autoplay a tone never interrupt the call. Run `npm run audio:generate` to
recreate the deterministic WAV assets; no environment variable or external
audio license is required.

Gemini AI is optional and disabled unless `AI_PROVIDER=gemini`. Add the API-only
`GEMINI_API_KEY`, an explicit `GEMINI_MODEL`, and an accurate
`GEMINI_SERVICE_TIER=free|paid` to the API service. No web-service variable,
BullMQ worker, webhook, or migration is required. Redis should remain shared by
all replicas so AI concurrency and daily quotas are coordinated.

Gemini AI is optional and disabled unless `AI_PROVIDER=gemini`. Add the API-only
`GEMINI_API_KEY`, an explicit `GEMINI_MODEL`, and an accurate
`GEMINI_SERVICE_TIER=free|paid` to the API service. No web-service variable,
BullMQ worker, webhook, or migration is required. Redis should remain shared by
all replicas so AI concurrency and daily quotas are coordinated.

Railway plans that block outbound SMTP must configure `MAIL_PROVIDER=brevo`
with `BREVO_API_KEY` and a Brevo-verified `MAIL_FROM_ADDRESS`. Upgrading to a
plan that permits SMTP is not required when the HTTPS provider is selected.

Configure the API service with `STORAGE_PROVIDER=r2` and the four private R2
credentials. Configure the web service with the exact public
`NEXT_PUBLIC_R2_ORIGIN`, normally
`https://<account-id>.r2.cloudflarestorage.com`. After both frontend origins are
present in API `CLIENT_ORIGINS`, run `npm run storage:cors:sync` once using the
production API variables. The bucket itself remains private.

Build both applications from the workspace root:

```bash
npm run build
```

Run the API and web production processes separately:

```bash
npm start
npm run start:web
```
