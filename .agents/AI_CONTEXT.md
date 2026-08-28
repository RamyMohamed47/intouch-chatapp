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
  retries. Brevo HTTPS supports restricted cloud hosts, while SMTP remains a
  local/VPS option. Organization invitations are emailed to verified users.
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
