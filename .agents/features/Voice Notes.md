# Voice Notes

## Scope

Voice notes are dedicated timeline messages in direct messages and text
channels. They are not ordinary downloadable attachments and are not available
in voice-only channels.

- Minimum duration: 1 second.
- Maximum duration: 5 minutes.
- Maximum object size: 5 MB.
- Mobile records mono AAC in an M4A container with Expo Audio.
- Web prefers Opus/WebM where available and uses AAC/MP4 as the Safari
  fallback. Chromium WebM duration metadata is repaired before upload; its
  fragmented MediaRecorder MP4 output is avoided because duration metadata is
  not consistently parseable.
- Every note carries exactly 64 normalized waveform peaks.

Voice notes support replies, reactions, receipts, unread state, notifications,
and authorized deletion. They cannot contain captions, mentions, ordinary
attachments, or edits.

## Lifecycle

1. The client records only while foregrounded and outside an active LiveKit
   session.
2. On send, the client stops recording and requests one conversation-scoped
   `VOICE_NOTE` upload ticket.
3. The browser or mobile client uploads directly to private R2 and calls the
   normal completion endpoint.
4. The API fully inspects the bounded object, verifies its signature, MIME,
   codec, size, and duration, then promotes it.
5. Message creation claims exactly that promoted audio asset in the existing
   MongoDB transaction.
6. Message reads bulk-hydrate the safe duration and waveform metadata. Audio is
   excluded from the generic attachments array.

If message creation fails after promotion, the current client session retains
the promoted upload ID for retry. Abandoned uploads remain covered by the
existing cleanup lifecycle.

## Playback

Clients request a short-lived signed URL only when playback starts and retry
once with a refreshed URL after an access failure. Each client permits one
active voice-note player. Starting another resets the previous note. Playback
pauses when LiveKit starts, the application backgrounds, or the component is
removed.

Both clients expose play/pause, elapsed and total duration, waveform seeking,
and `1x`, `1.5x`, and `2x` speed controls.

## Manual Testing

1. Send notes from Android to web and web to Android in a DM and public text
   channel.
2. Verify recordings below one second are rejected and five-minute recordings
   send automatically after the visible countdown.
3. Pause and resume recording, cancel it, background the app, hide the browser,
   and navigate away. Confirm canceled temporary media is not sent.
4. Start a call or join a voice channel. Confirm recording is unavailable and
   active voice-note playback pauses.
5. Reply to, react to, read, and delete a voice note. Confirm editing and
   captions are unavailable and previews say `Voice note`.
6. Seek through the waveform and cycle every playback speed. Starting a second
   note must stop and reset the first.
7. Interrupt upload and message creation separately. Confirm Retry and Discard
   behave correctly and no duplicate message is created.
8. Verify private-channel access and signed Railway/R2 playback with two
   accounts.

No transcription, forwarding, explicit download, background recording,
offline queue, or persistent recording draft is included.
