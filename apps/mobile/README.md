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
