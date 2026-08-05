# Socket.IO Events

All handshake, acknowledgement, client-event, and server-event DTOs originate
from Zod schemas exported by `@intouch/shared/realtime`. The API parses
outbound payloads before emission, including conversion of `Date` values to ISO
8601 strings. Web and future mobile clients consume the inferred shared types
rather than redefining event payloads.

## Authentication

Connect with the current access JWT in the Socket.IO auth payload:

```ts
io(API_ORIGIN, { auth: { accessToken } });
```

Connections with a missing, invalid, or expired token are rejected. The server
disconnects an established socket when that access token expires. Refresh the
token through REST, reconnect, and join the required rooms again.

## Client Events

### `conversation:join`

Payload: `{ conversationId: string }`.

The server verifies channel or direct-message access before joining
`conversation:<conversationId>`. The acknowledgement is `{ success: true }` or
`{ success: false, error: { code, message } }`.

### `conversation:leave`

Payload: `{ conversationId: string }`, with the same acknowledgement shape.
Leaving also clears typing state for that socket.

### `organization:subscribe` and `organization:unsubscribe`

Payload: `{ organizationId: string }`. Subscription verifies current membership
before joining `organization:<organizationId>`. Presence is only delivered to
subscribed sockets belonging to an organization the subject currently shares.

### `typing:start` and `typing:stop`

Payload: `{ conversationId: string }`. The socket must already be in the
authorized conversation room. Typing expires after five seconds, so active
clients should refresh `typing:start` about every three seconds. Both events use
the standard acknowledgement shape.

## Server Events

- `message:created` carries the complete public message DTO.
- `message:updated` carries the complete updated message DTO.
- `message:deleted` carries the redacted message tombstone.
- `conversation:access-revoked` carries `{ conversationId }` before the socket is removed from that room.
- `presence:updated` carries `{ userId, status, lastSeenAt }` to subscribed organization rooms.
- `typing:updated` carries `{ conversationId, userId, isTyping }` to other users in the conversation room.
- `read-receipt:updated` carries the durable read-state DTO and is emitted only for direct messages.

Messages are written through REST. Socket.IO only manages authorized room
subscriptions and scoped server events; no event is broadcast globally.

Every authenticated socket also joins `user:<userId>`. That room is used to
exclude all sockets belonging to the typing user, not only the socket that sent
the event.

Presence and typing use replaceable in-memory stores in this iteration. The
backend must run as one application instance. A multi-instance deployment needs
Redis-backed stores plus the Socket.IO Redis adapter. Process restarts clear
runtime presence and typing; clients reconnect and rebuild subscriptions.
