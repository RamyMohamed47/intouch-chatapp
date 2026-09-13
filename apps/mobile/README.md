# InTouch Mobile

Expo SDK 57 Android-first client for InTouch. The application shares strict
contracts with `@intouch/shared` and connects directly to the InTouch API.

## Local Development

Create an ignored `.env.local` from `.env.example`, then run commands from the
repository root:

```powershell
npm run dev:mobile
```

The application uses native Google authentication, so run it in an InTouch
development build rather than Expo Go.

## Preview Builds

Create an installable Android APK from this directory:

```powershell
npx eas-cli@latest build --platform android --profile preview
```

The `preview` EAS environment must provide `EXPO_PUBLIC_API_URL` and
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. Preview builds use the `preview` EAS Update
channel and do not require Metro or a development machine after installation.

Mobile V1.2 also supports a dedicated optional Sentry project. Add
`EXPO_PUBLIC_SENTRY_DSN` to the EAS runtime environment, then configure
`SENTRY_AUTH_TOKEN` as a sensitive build value, `SENTRY_ORG` as the organization
slug, and `SENTRY_PROJECT=intouch-mobile`. Leave the DSN empty to keep Sentry
disabled locally. A fresh development and preview build is required after
adding the native SDK.

## Voice, Video, and Screen Sharing

Mobile V2.0 uses the existing API-owned LiveKit integration. The mobile app does
not need a LiveKit secret or public URL: the API returns a short-lived token and
server URL only after its normal organization, conversation, capacity, and
single-session authorization checks pass.

The API deployment must already provide:

```dotenv
VOICE_PROVIDER=livekit
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=replace-with-server-key
LIVEKIT_API_SECRET=replace-with-server-secret
```

Voice channels support microphone, camera, deafen, output selection, participant
speaking state, occupancy, owner mute/disconnect/share-stop moderation, and a
compact navigation-persistent dock. Direct messages support audio and video
calling with ringing, accept, decline, cancel, timeout, call duration, and the
same media controls. Tap a shared screen to view it fullscreen.

Android can publish screen video while microphone audio continues. Device audio
is not captured. iOS can receive screen shares but cannot start one in this
release. Backgrounding keeps active audio connected on Android through a
persistent foreground-service notification; the camera stops immediately and
stays off after returning to the app.

The LiveKit, WebRTC, audio, background-service, notification, and TaskManager
changes are native changes. Build and install new development and preview APKs
before testing; `npm run dev:mobile` alone cannot add them to an older binary.

## Push Notifications

Push notifications require an Android development or preview build; Expo Go is
not supported. Configure Firebase Cloud Messaging V1 for the Expo project,
upload its service-account key through EAS credentials, and provide
`google-services.json` as an EAS file environment variable named
`GOOGLE_SERVICES_JSON` for each build environment.

The API requires these production variables:

```dotenv
PUSH_PROVIDER=expo
EXPO_ACCESS_TOKEN=replace-with-an-expo-access-token
PUSH_TOKEN_ENCRYPTION_SECRET=replace-with-an-independent-32-byte-secret
```

Use `PUSH_PROVIDER=disabled` locally when push delivery is not being tested.
When enabled, the device registers after permission is granted, unregisters on
logout, and can be managed from Profile. Lock-screen copy contains the actor and
activity type but never message text or attachment names.

Test delivery on a physical device. Background the app, trigger each supported
notification from another account, tap it, and verify that InTouch opens the
correct invitation, workspace, conversation, or exact message. Also verify
foreground activity does not produce both a Socket.IO toast and a system banner.
Category switches and active workspace/conversation mutes suppress push only;
the durable inbox remains complete. Android launcher badge support varies by
launcher and must not be treated as a registration failure.

Direct-call interruption uses the separate Calls preference and the same active
workspace/conversation mutes. Incoming alerts use the `intouch-calls-v2`
high-priority Android channel and bundled InTouch tone. Call alerts are
short-lived lifecycle interruptions rather than durable inbox records. State
updates dismiss stale ringing notifications when Android background execution
permits it; opening an old alert always revalidates the call with the API.

## Automated Preview Deployment

`.eas/workflows/deploy-preview.yml` runs for pushes to `main` that affect the
mobile app, shared contracts, or root npm manifests.

- If no compatible Android preview exists for the native fingerprint, EAS
  creates a new preview APK.
- If a compatible build exists, EAS publishes an Android OTA update to the
  `preview` channel.
- The workflow uses the EAS `preview` environment variables.

Connect the Expo project to the GitHub repository before expecting push events
to trigger the workflow. The first run after enabling `expo-updates` creates a
new APK; testers must install that build once before they can receive subsequent
compatible OTA updates.

App-store submission is intentionally not part of the push workflow. Configure
Google Play Console, a service-account submission credential, and a controlled
production release workflow before enabling automated submissions.

Run the workflow manually when diagnosing it:

```powershell
npx eas-cli@latest workflow:run .eas/workflows/deploy-preview.yml
```

## Validation

From the repository root:

```powershell
npm run typecheck:mobile
npm run test:mobile
npm run build:mobile
npm run mobile:doctor
```

The complete V1.2 acceptance matrix is documented in
[Mobile V1.2](../../.agents/mobile/Mobile%20V1.2.md). Voice and call acceptance
is documented in [Mobile V2.0](../../.agents/mobile/Mobile%20V2.0.md).
