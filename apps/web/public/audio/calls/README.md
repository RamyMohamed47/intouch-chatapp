# InTouch Call Tones

`intouch-incoming.wav` and `intouch-ringback.wav` are original synthesized
assets created for InTouch. They contain no third-party samples and require no
external license or attribution.

Regenerate both deterministic mono PCM assets from the repository root:

```bash
npm run audio:generate
```

The incoming ringtone is intentionally louder than the related outgoing
ringback. Application playback still uses bounded volume values.
