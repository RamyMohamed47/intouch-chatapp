# InTouch Mobile V2.0

Mobile V2.0 adds Android-first LiveKit media to the existing online-first Expo
client. InTouch remains authoritative for identity, authorization, call state,
voice-channel occupancy, moderation, and call history. LiveKit carries media
and WebRTC signaling only.

## Capabilities

- Public and private voice channels support up to ten participants.
- Direct messages support `AUDIO` and `VIDEO` calls with ringing, accept,
  decline, cancel, missed, timeout, active, and completed states.
- A user has at most one active voice session. Switching requires explicit
  confirmation and uses the API's atomic Redis-backed transfer path.
- Microphone, deafen, camera, audio-output, connection, participant-speaking,
  and leave controls are available in calls and voice channels.
- Screen shares can be viewed fullscreen. Android can publish screen video
  while microphone audio continues; device audio is not captured. iOS can view
  shares but cannot publish them in this release.
- Organization owners can server-mute or disconnect voice-channel participants
  and stop a participant's active screen share. Remote unmute is prohibited.
- Direct calls retain their immutable `CALL` timeline entry and duration. Call
  interruption does not add a second durable notification record.

## Runtime Architecture

`VoiceProvider` owns one navigation-persistent LiveKit `Room`, native audio
session, local microphone/camera/share tracks, ringing tones, active API session,
and reconnect state. TanStack Query remains authoritative for durable call and
conversation data. Socket.IO carries call state, occupancy, moderation, and
voice-heartbeat events, never media or provider credentials.

Android starts a low-importance foreground service before connecting media and
stops it after leaving. Active audio and the Socket.IO voice heartbeat continue
while the app is backgrounded. The camera is disabled as soon as the app leaves
the foreground and remains off until the user enables it again. Screen-share
publishing uses LiveKit's Android media-projection service and is not resumed
automatically after process death.

Provider webhooks and periodic reconciliation remain authoritative when mobile
events are delayed or lost. Reconciliation refreshes the Redis lease for a
participant who is still present in LiveKit, preventing a healthy backgrounded
mobile audio session from expiring solely because JavaScript timers were
suspended.

## Call Notifications

Incoming calls use a short-lived `CallAlertOutbox` record and the
`call-alert-delivery` BullMQ queue. Delivery occurs only while the call remains
`RINGING`, checks the recipient's Calls preference and active organization or
conversation mutes immediately before dispatch, and expires with the 30-second
ringing window.

Android uses the `intouch-calls-v1` high-priority notification channel and the
bundled InTouch call tone. A data-only state update asks the client to dismiss a
stale ringing notification. Opening an alert always fetches current call state,
so delayed or already-ended alerts cannot resurrect a call. No caller name,
email, message text, provider room ID, token, or media credential is included in
the push data payload.

The implementation deliberately does not use iOS CallKit, Android Telecom,
full-screen intents, or actionable accept/decline notification buttons. Push
opens the normal InTouch incoming-call screen.

## Configuration

Mobile introduces no new public runtime variable. The API continues to own the
existing LiveKit configuration:

```dotenv
VOICE_PROVIDER=livekit
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=replace-with-server-key
LIVEKIT_API_SECRET=replace-with-server-secret
```

Call push delivery reuses the existing Expo configuration:

```dotenv
PUSH_PROVIDER=expo
EXPO_ACCESS_TOKEN=replace-with-expo-access-token
PUSH_TOKEN_ENCRYPTION_SECRET=replace-with-independent-32-byte-secret
```

EAS still requires `GOOGLE_SERVICES_JSON` and configured FCM V1 credentials for
Android push. No additional Firebase, Redis, R2, Railway, or LiveKit credential
is required.

## Native Build Requirement

This release adds native LiveKit, WebRTC, audio, TaskManager, and Android
foreground-service configuration. Create and install fresh development and
preview APKs. An OTA update or `npm run dev:mobile` cannot retrofit these native
modules into an older binary.

```powershell
cd apps/mobile
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest build --platform android --profile preview
```

## Manual Acceptance

1. Install the rebuilt Android development APK on two physical devices and run
   both against the same local API and LiveKit project.
2. Join public and private voice channels, verify occupancy updates without a
   refresh, enforce ten-person capacity, and confirm unauthorized members cannot
   join private rooms.
3. Switch between two voice sessions and verify the confirmation appears, the
   previous room disconnects, and Redis reports only one active session.
4. Start audio and video DM calls. Verify ringing, ringback, accept, decline,
   cancel, missed timeout, busy response, connection timeout, duration, and the
   immutable timeline entry.
5. Deny camera permission on a video call and verify the call continues with
   audio and camera off. Background an active video call and verify audio stays
   connected while camera remains off after foregrounding.
6. Toggle microphone, deafen, camera, speaker/earpiece/headset/Bluetooth output,
   and reconnect after a short network interruption.
7. Publish camera and screen video concurrently on Android. Verify microphone
   audio continues, device audio is absent, another participant can view the
   share fullscreen, and stopping the share leaves the call connected.
8. As an owner, mute and disconnect another voice-channel participant and stop
   their screen share. Verify a member cannot invoke those actions and nobody
   can remotely unmute another participant.
9. Background the recipient app and start a direct call. Verify the call alert
   opens the correct screen, uses the bundled tone, and disappears after accept,
   decline, cancel, or timeout when background execution permits.
10. Disable Calls, then test one-hour and permanent workspace/conversation
    mutes. Verify call push and foreground interruption are suppressed while the
    call timeline and normal realtime cache reconciliation remain intact.
11. Kill and reopen the app during an active session. Verify the API/provider
    either resumes an authorized active lease or presents a clean ended state;
    screen share and camera do not resume automatically.
12. Repeat the critical call, background-audio, push, and share tests against the
    Railway API using a preview APK.

## Deferred

- iOS runtime acceptance, CallKit, Android Telecom, full-screen call intents,
  lock-screen accept/decline actions, and offline VoIP wake guarantees.
- Screen-share device audio, mobile recording, transcription, SIP, E2EE,
  background camera, and automatic screen-share restoration.
- Multiple simultaneous sessions, group DM calls, per-contact ringtones, and
  persistent local call or media state.
