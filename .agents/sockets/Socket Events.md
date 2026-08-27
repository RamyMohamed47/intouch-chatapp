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

Connection middleware errors expose `{ code, message, retryAfterMs? }` through
Socket.IO's `connect_error.data`. `UNAUTHORIZED` is the only connection error
that should trigger an access-token refresh. `TOO_MANY_REQUESTS` should be
retried after `retryAfterMs` without rotating the refresh token.

Each user may keep at most five active sockets. Connection attempts use a
10-token bucket that refills one token every three seconds. Socket payloads are
limited to 10 KB.

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

Every accepted `typing:start`, including a refresh heartbeat, emits
`typing:updated` with `isTyping: true`. Consumers must handle repeated `true`
events idempotently and refresh their local fallback expiry without repeatedly
announcing unchanged state. A user who joins the room after typing begins sees
the next heartbeat within approximately three seconds.

## Authenticated Abuse Limits

- `conversation:join` and `organization:subscribe` share a 20-token bucket that
  refills one token per second per user.
- `typing:start` has a 10-token bucket that refills one token every two seconds
  per user.
- Limited events acknowledge `TOO_MANY_REQUESTS` before validation,
  authorization, or broadcast work.
- `conversation:leave`, `organization:unsubscribe`, and `typing:stop` are not
  throttled so cleanup always remains available.

## Server Events

- `message:created` carries the complete public message DTO.
- `message:updated` carries the complete updated message DTO.
- `message:deleted` carries the redacted message tombstone.
- `membership:joined` carries `{ organizationId, userId }` after an invitation acceptance or public join commits. Organization subscribers invalidate that organization's safe member roster; the event is an invalidation signal and does not duplicate user profile data.
- `conversation:access-revoked` carries `{ conversationId }` before the socket is removed from that room.
- `presence:updated` carries `{ userId, status, lastSeenAt }` to subscribed organization rooms. Online updates always use `lastSeenAt: null`; confirmed offline updates carry the persisted final-disconnect timestamp.
- `typing:updated` carries `{ conversationId, userId, isTyping }` to other users in the conversation room.
- `read-receipt:updated` carries the durable read-state DTO and is emitted only when a direct-message high-water mark advances. Events are idempotent; clients ignore stale, duplicate, and self updates and merge newer peer state into their server-state cache.
- `conversation:activity` carries `{ organizationId, conversationId, conversationType, actorUserId, activityId, kind }` to authorized `user:<userId>` rooms. Kinds are `CONVERSATION_CREATED`, `MESSAGE_CREATED`, `MESSAGE_UPDATED`, and `MESSAGE_DELETED`. The payload intentionally contains no message content.
- `channel-read-receipts:changed` carries only `{ conversationId }` to the active channel room when a channel high-water mark advances. It is an anonymous cache-invalidation signal and excludes every socket belonging to the reader.

Messages are written through REST. Socket.IO only manages authorized room
subscriptions and scoped server events; no event is broadcast globally.

The member-list REST response is the initial presence snapshot. Web clients
invalidate that exact organization roster after every successful
`organization:subscribe`, including reconnects, and then apply
`presence:updated` events incrementally.

Every authenticated socket also joins `user:<userId>`. That room is used for
authorized inactive-conversation activity delivery and to exclude all sockets
belonging to an acting or typing user, not only the socket that emitted an
event. Public-channel activity targets current organization members. Private
channel and direct-message activity additionally requires a current participant
record.

Web clients keep a seven-second fallback expiry as a defensive guard against a
missed server stop event. They clear typing immediately on `isTyping: false`,
disconnect, authentication loss, conversation leave, access revocation, and
provider unmount. Typing indicators use a polite atomic status announcement,
reserve their layout space, and avoid reannouncing repeated heartbeats.

Presence and typing use replaceable in-memory stores in this iteration. The
backend must run as one application instance. A multi-instance deployment needs
Redis-backed stores plus the Socket.IO Redis adapter. Process restarts clear
runtime presence and typing; clients reconnect and rebuild subscriptions.
Authenticated abuse counters and active-socket accounting are also
process-local and require Redis-backed implementations before horizontal API
scaling.

Direct-conversation REST responses include `peerReadReceipt`, so read status
survives reloads and missed socket events. Clients reconcile direct-message
queries after reconnecting. Clients also reconcile cached channel and direct
conversation summaries after reconnecting or rotating an access token. Channel
reader identities never appear in socket events; only the sender may request a
bounded reader summary through REST.
