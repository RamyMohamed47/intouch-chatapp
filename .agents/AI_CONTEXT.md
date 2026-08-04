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
- Google sign-in uses a backend-owned authorization-code redirect flow.
- Google identities are keyed by the verified ID-token `sub` claim and linked
  to existing users only through verified email addresses.
- Google tokens are discarded after verification; InTouch continues to own JWT
  access tokens and rotating refresh sessions.

## Multi-tenancy

Single Database + organizationId

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
