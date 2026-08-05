
# DTO Strategy

## Purpose

DTOs define data crossing an external application boundary. They are not
domain models, Mongoose documents, repository records, or service dependency
interfaces.

The shared `@intouch/shared` workspace is the source of truth for DTO schemas
used by the API, web application, and future mobile clients.

## Covered Boundaries

Every externally visible payload must originate from a Zod schema:

- REST request bodies, path parameters, and query parameters.
- REST success and error responses.
- Socket.IO handshake authentication and client event payloads.
- Socket.IO acknowledgements and server event payloads.

Types are always inferred from their schema:

```ts
export type MessageDto = z.infer<typeof messageDtoSchema>;
```

Do not maintain a handwritten interface that duplicates an external payload.

## Internal Types

Internal domain and persistence types remain ordinary TypeScript types when
runtime boundary validation provides no value. This includes:

- Mongoose document shapes.
- Repository records and mutation inputs.
- Unit-of-work and policy interfaces.
- Service dependencies and internal provider/token structures.

Internal records must not be returned directly. A controller or transport
adapter parses them through the relevant response schema first. Parsing both
serializes values such as `Date` to JSON-safe strings and strips fields that
are not part of the public contract.

## Placement

- Reusable contracts live under `packages/shared/<domain>`.
- API-only path/query schemas may live beside their API route.
- Feature schemas export both the runtime schema and its inferred type.
- Response envelopes are schemas, not controller-local object types.

## OpenAPI

OpenAPI 3.1 documents the same public shapes. Updating a DTO requires updating
its shared schema, contract tests, and the corresponding OpenAPI component in
the same change. OpenAPI must never be treated as an independent competing
type source.

## Enforcement

- Validate and normalize inbound DTOs before invoking a controller action.
- Parse outbound REST values before calling `res.json`.
- Parse outbound Socket.IO values before emitting them.
- Add contract tests for normalization, date serialization, field stripping,
  and strict input rejection.
- Never expose domain models, persistence-only fields, credentials, hashes, or
  provider metadata through a DTO.
