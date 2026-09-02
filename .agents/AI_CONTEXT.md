# InTouch AI Context

## Project Overview

- What is InTouch?
- Product vision
- MVP scope

## Technology Stack

- Node
- Express
- TypeScript
- MongoDB
- Socket.IO
- Zod
- Railway

## Architecture

- Layered Architecture
- Repository Pattern
- Feature Modules
- npm workspaces with applications under `apps` and contracts under `packages`
- Backend composition root at `apps/api/src/server.ts`
- Next.js frontend at `apps/web`
- Future mobile application reserved for `apps/mobile`
- Local application processes run natively; `compose.infrastructure.yml`
  provides the MongoDB replica set, Redis/BullMQ, and Mailpit development stack.
- Observability uses structured Railway logs, OpenTelemetry OTLP metrics and
  sampled traces, and sanitized Sentry error reporting. Local Grafana LGTM is
  optional and disposable; telemetry never controls application readiness.

## Engineering Principles

- Thin controllers
- Thin socket handlers
- Services own business logic
- Repository owns persistence
- Validation at boundaries
- Shared Zod contracts
- Contract-first

## Authentication

- Email/password auth is backend-owned.
- Access tokens are 15-minute HS256 Bearer JWTs.
- Refresh tokens are rotating opaque credentials stored only in HttpOnly cookies.
- MongoDB stores only refresh-token hashes in `AuthSession` documents.
- Production browser traffic reaches Railway through the frontend's same-origin API proxy.
- Refresh requests require an allowlisted Origin and `X-CSRF-Protection: 1`.
- Shared request contracts are exported by the `@intouch/shared` workspace.
- Password registration creates a pending account and a single-use email
  confirmation token; no session is issued until confirmation and login.
- Password reset uses a single-use action token and revokes every refresh
  session after the password changes.
- Mail delivery is decoupled through an encrypted MongoDB outbox with bounded
  retries. Production BullMQ jobs contain opaque outbox IDs and are reconciled
  from MongoDB; polling remains the local fallback. Brevo HTTPS supports
  restricted cloud hosts, while SMTP remains a local/VPS option. Organization
  invitations are emailed to verified users.
- Google sign-in uses a backend-owned authorization-code redirect flow.
- Google identities are keyed by the verified ID-token `sub` claim and linked
  to existing users only through verified email addresses.
- Google tokens are discarded after verification; InTouch continues to own JWT
  access tokens and rotating refresh sessions.

## Multi-tenancy

Single Database + organizationId

## Notifications

- MongoDB stores durable, recipient-specific in-app notifications.
- Supported activity is invitation received, invitation accepted, incoming
  direct message, and reaction to the recipient's message.
- Notification writes and lifecycle cleanup share the source domain
  transaction; recipient-only Socket.IO events publish after commit.
- Unread DMs group per conversation until the recipient's read state advances.
- Notification records expire after 30 days. Email and push preferences remain
  out of scope.

## Private Assets

- Profile avatars, organization logos, and message attachments are stored in a
  private Cloudflare R2 bucket; MongoDB stores ownership and lifecycle metadata
  only.
- Browsers upload with short-lived presigned `PUT` URLs. The API verifies file
  signatures before conditional promotion and authorizes every short-lived
  read URL.
- Message creation, avatar replacement, and organization-logo assignment claim
  completed uploads inside MongoDB transactions. Asynchronous cleanup removes
  canceled, abandoned, replaced, and deleted objects through BullMQ in
  production or leased polling locally.
- Public DTOs and Socket.IO events expose opaque asset IDs and safe metadata,
  never bucket keys, credentials, ETags, or presigned URLs.

## Voice Communication

- LiveKit Cloud carries audio and WebRTC signaling. InTouch remains
  authoritative for membership, call lifecycle, occupancy, history, and
  moderation.
- Voice channels are persistent `VOICE` conversations with a capacity of ten;
  existing channels are migrated to `TEXT`.
- Direct-message calls create immutable `CALL` timeline messages and use
  BullMQ for ringing, connection, disconnect-grace, and reconciliation jobs.
- Redis enforces one active voice session per user across API replicas and
  stores only opaque participant identities and ephemeral leases.
- Socket.IO carries call lifecycle and occupancy events only. It never carries
  audio, provider credentials, or WebRTC signaling.

## Coding Standards

- Naming
- Folder structure
- Error handling
- Async patterns

## Documentation Map

Architecture →
Database →
ADR →
OpenAPI →
Socket →
Shared Contracts
