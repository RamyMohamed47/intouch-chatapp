# Feature Implementation Workflow

Every feature follows the same process.

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