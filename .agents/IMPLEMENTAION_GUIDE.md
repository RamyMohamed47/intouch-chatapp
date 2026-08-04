# Feature Implementation Workflow

Every feature follows the same process.

Backend features are implemented under `apps/api/src/modules`. Shared request
contracts are implemented under `packages/shared`, and API tests belong in
`apps/api/tests`.

1. Read OpenAPI contract

2. Read relevant ADRs

3. Read database design

4. Read shared contracts

5. Implement

Route

↓

Controller

↓

Validation

↓

Service

↓

Repository

↓

Model

6. Add tests

7. Update documentation if necessary

Never skip validation.

Never put business logic inside controllers.

Repositories never perform authorization.

Services never know about Express.

Socket handlers follow the same pattern.
