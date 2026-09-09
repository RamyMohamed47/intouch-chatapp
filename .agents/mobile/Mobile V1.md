# InTouch Mobile V1

## Scope

`apps/mobile` is the Android-first Expo SDK 57 client. It uses the existing API,
MongoDB data, private R2 assets, Socket.IO events, and `@intouch/shared` Zod
contracts. It is online-first and does not persist server data or queue sends.

V1 includes email/password and Google authentication, workspaces and supported
administration, text channels and direct messages, attachments, reactions,
editing, redaction, typing, presence, receipts, themes, and wallpapers. Voice,
video, screen sharing, Echo, search, and offline sync are deferred. V1.1 adds a
durable notification inbox, Expo push delivery, exact-message deep links,
upload cancellation, lifecycle reconciliation, and targeted error recovery.

## Local Setup

Requirements:

- Node.js 22.13 or newer for Expo SDK 57.
- Android Studio or a physical Android device.
- An InTouch development build; Expo Go cannot load native Google sign-in.
- The Docker infrastructure stack and API running locally.

Create the ignored `apps/mobile/.env.local` from `.env.example`:

```dotenv
EXPO_PUBLIC_API_URL=http://<development-machine-LAN-IP>:3000
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<google-web-client-id>
```

The API needs `MOBILE_APP_URL=intouch://`. A physical device and the API host
must be reachable on the same network. Permit port 3000 through the development
machine firewall when necessary.

Run from the repository root in separate terminals:

```bash
npm run infra:up
npm run dev:api
npm run dev:mobile
```

## Google And EAS

In Google Cloud, keep the existing web OAuth client as the server audience and
create an Android OAuth client with package `com.ramymohamed.intouch`. Register
the SHA-1 fingerprint for each development or EAS signing certificate used.
The selected Nitro Google module is excluded only from Expo Doctor's React
Native Directory metadata check because that directory has not marked it as
New-Architecture tested; native development-build testing remains required.

Run EAS commands from `apps/mobile`:

```bash
eas init
eas credentials --platform android
eas build --profile development --platform android
eas build --profile preview --platform android
```

The development profile includes the custom Expo development client. The
preview profile creates the internal-distribution APK used for V1 acceptance.
Production EAS builds set `EXPO_PUBLIC_API_URL` to the public Railway API origin
and use the same Google web-client audience. Public Expo variables are not
secrets. Never place Google client secrets, R2 credentials, JWT secrets, or
refresh tokens in them.

Android push builds also need Firebase Cloud Messaging V1. Upload the Firebase
service-account key through EAS credentials and create a file-type EAS variable
named `GOOGLE_SERVICES_JSON` containing `google-services.json`. The API uses
`PUSH_PROVIDER=expo`, an Expo access token, and a separate token-encryption
secret. Local API runs may use `PUSH_PROVIDER=disabled` unless push is under test.

iOS structure is present, but runtime acceptance is deferred. Before an iOS
build, set the real reversed Google client URL scheme and plan Sign in with
Apple before public App Store distribution.

## Authentication Model

The native endpoints are:

```text
POST /api/v1/auth/mobile/login
POST /api/v1/auth/mobile/google
POST /api/v1/auth/mobile/refresh
POST /api/v1/auth/mobile/logout
```

They return rotating credentials in strict JSON bodies and never set cookies or
use browser CSRF middleware. Access tokens remain in memory. Refresh tokens are
stored only in Expo SecureStore. Refresh attempts share one promise, and a
failed request is retried once after successful rotation. Logout clears local
credentials before best-effort server revocation.

Verification and recovery requests set `deliveryTarget: MOBILE`. Their email
links target the `intouch://` scheme and retain the HTTPS web link as fallback.

## Runtime Behavior

- TanStack Query is authoritative for organizations, conversations, messages,
  presence, reactions, and receipts.
- Socket.IO carries the access token in the handshake and reconnects only while
  the app is active.
- Foreground restoration refreshes credentials, reconnects, resubscribes, and
  reconciles affected query families.
- Typing sends three-second heartbeats and expires remote users after seven
  seconds. Blur, send, navigation, and unmount stop local typing.
- Receipts advance only while the screen is focused, the app is active, and the
  newest-message sentinel is visible.
- Uploaded files go directly to private R2 presigned URLs, then are completed
  and claimed through the API. Secure credentials never enter the app bundle.

## Manual Acceptance

Use two authenticated Android devices or development builds against the same
API.

1. Launch with and without a stored session; verify protected routes never
   flash before restoration finishes.
2. Test password registration, verification, login, reset, logout, and Google
   sign-in. Confirm refresh rotation survives an app restart.
3. Create and switch workspaces, accept and decline invitations, and verify
   owner-only category, text-channel, logo, and destructive controls.
4. Open public/private channels and DMs. Verify newest-first opening, older-page
   loading, history position preservation, and jump-to-latest behavior.
5. Send text, image, document, and attachment-only messages. Retry a failed
   message after upload completion and verify it does not upload twice.
6. Edit and redact messages; add, replace, and remove reactions. Confirm call
   timeline entries remain read-only.
7. Verify typing, presence, unread counts, DM `Sent`/`Read`, and channel
   `Read by N` behavior between devices without refreshing.
8. Background one device. Confirm Socket.IO disconnects, then foreground it and
   verify authentication, subscriptions, and summaries reconcile.
9. Test Ink, Cloud, Aurora, and Ember with each wallpaper preset, dimming,
   portrait/landscape rotation, dynamic text, and screen-reader labels.
10. Enable notifications on a physical device. Background the app and verify
    invitation, invitation-accepted, DM, and reaction pushes from another user.
    Confirm push copy contains no message body or filename, and taps open the
    correct destination without duplicate foreground banners.
11. Disable push from Profile, log out, rotate the Expo token, and simulate a
    `DeviceNotRegistered` receipt. Confirm stale registrations stop receiving
    pushes while the durable in-app notification remains available.
12. Build and install the preview APK and repeat the critical auth, chat,
    attachment, and foreground-reconnect flows against Railway.

## Validation

```bash
npm run typecheck:mobile
npm run test:mobile
npm run build:mobile
npm run mobile:doctor
npm run check
```

Do not run Playwright or Maestro as part of this release.
