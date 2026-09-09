# InTouch Mobile V1.2

Mobile V1.2 advances the online-first Expo client with Echo, organization
search, reply and mention semantics, notification controls, and mobile error
monitoring. LiveKit media remains web-only until mobile V2.0.

## Delivered Features

- Echo is the fourth protected tab. It supports workspace/conversation asking,
  summaries, action items, source navigation, cancellation, retryable failures,
  owner enablement, member consent, and six-message in-memory context.
- The message composer offers explicit-preview Echo actions for professional
  rewrite, shortening, grammar correction, and translation. Generated text is
  never sent automatically or persisted by the mobile client.
- Search covers messages, channels, and people in the active organization with
  a 300 ms debounce, access-aware results, typed filters, pagination, exact
  message navigation, and DM creation.
- Mobile and web messages support immutable same-conversation replies and
  validated `@displayName` mentions using UTF-16 ranges. Reply previews are
  bulk hydrated and survive source redaction as deleted-source states.
- Channel mentions and channel replies create durable, deduplicated
  notifications. A reply takes precedence when the same recipient is also
  mentioned, and senders never notify themselves.
- Notification settings expose invitation, direct-message, mention/reply, and
  reaction categories. Workspace and conversation menus support one-hour,
  eight-hour, one-day, indefinite, and remove-mute actions.
- Preferences and mutes suppress push/foreground interruption only. The inbox,
  unread chat state, and realtime cache reconciliation remain authoritative.
- The notification inbox supports All and Unread filters. Push payloads carry
  authoritative unread counts and the app reconciles launcher badges after
  restoration, foregrounding, reads, mark-all-read, and logout.
- A dedicated optional Sentry React Native integration captures sanitized
  JavaScript/native failures and route/network failures. Replay, tracing, PII,
  credentials, content, filenames, and signed query values are excluded.

## Configuration

Runtime values for each EAS environment:

```dotenv
EXPO_PUBLIC_API_URL=https://<api-origin>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<google-web-client-id>
EXPO_PUBLIC_SENTRY_DSN=https://<mobile-project-dsn>
```

Build-only Sentry values:

```dotenv
SENTRY_AUTH_TOKEN=<sensitive-source-map-upload-token>
SENTRY_ORG=<organization-slug>
SENTRY_PROJECT=intouch-mobile
```

`EXPO_PUBLIC_SENTRY_DSN` is public application configuration. Keep
`SENTRY_AUTH_TOKEN` sensitive and never prefix it with `EXPO_PUBLIC_`. Local
development may leave the DSN empty. Adding `@sentry/react-native` changes the
native fingerprint, so create new development and preview builds.

## Manual Acceptance

1. Use two Android accounts in the same workspace and verify All, Messages,
   Channels, and People search results open the correct destinations.
2. Reply to and mention an authorized channel member. Verify the web and mobile
   clients render the reply/mention and the recipient gets one durable inbox
   record and one push interruption.
3. Mention the replied-to user in the same message and verify only the reply
   notification is created. Edit the message repeatedly and verify a newly
   mentioned recipient is notified once.
4. Redact a replied-to message and verify the reply preview becomes a deleted
   source without breaking navigation or history rendering.
5. Disable each notification category, then configure every workspace and
   conversation mute duration. Verify push is suppressed while the inbox and
   unread state still update. Verify workspace mutes do not suppress a new
   workspace invitation.
6. Read one notification, mark all read, foreground the app, restore a login,
   and log out. Verify the in-app and launcher badge counts reconcile. Treat a
   launcher without badge support as a platform limitation, not an error.
7. Stream Echo responses, cancel mid-response, retry a provider failure, open
   source references, switch workspaces, and restart the app. Verify session
   history clears and auto-scroll stops while reading older output.
8. Exercise each Echo composer action and verify the draft changes only after
   pressing the explicit apply action.
9. In a Sentry-enabled preview build, trigger a controlled test failure and
   confirm the stack is symbolicated and contains no token, email, content,
   filename, request body, or signed URL query.

## Deferred

- Voice channels, direct voice/video calls, screen sharing, and call push
  notifications move to mobile V2.0.
- Quiet hours, notification archive/delete, actionable notification buttons,
  per-device category settings, offline sends, persistent Echo history,
  analytics, camera capture, iOS runtime acceptance, and store submission remain
  deferred.
