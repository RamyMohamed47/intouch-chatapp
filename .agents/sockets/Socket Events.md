# Socket.IO Events

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

The server verifies current organization membership and private-channel
participation before joining `conversation:<conversationId>`. The acknowledgement
is `{ success: true }` or `{ success: false, error: { code, message } }`.

### `conversation:leave`

Payload: `{ conversationId: string }`, with the same acknowledgement shape.

## Server Events

- `message:created` carries the complete public message DTO.
- `message:updated` carries the complete updated message DTO.
- `message:deleted` carries the redacted message tombstone.
- `conversation:access-revoked` carries `{ conversationId }` before the socket is removed from that room.

Messages are written through REST. Socket.IO only manages authorized room
subscriptions and scoped server events; no event is broadcast globally.
