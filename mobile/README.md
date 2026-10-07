# Kiki mobile app

Expo + React Native app for browsing, downloading, and saving wallpapers offline, with an Android live wallpaper rotation tool and a lock-screen preview/reminder studio.

The app uses the existing Kiki API at `https://kiki-gold.vercel.app` by default. The catalog client adapts the Vercel API's wallpaper fields and SSE event names to the mobile UI. Ten built-in wallpapers are bundled as an offline catalog fallback.

## Run on a phone with Expo Go

```bash
cd mobile
npm install
npx expo start
```

Keep the phone and computer on the same Wi-Fi and scan Expo's QR code. Expo Go is for UI/catalog preview; Kiki's Android live wallpaper service and scheduled native reminders require an APK build.

## Build an installable Android test APK

From the repository root, sign in and link this repo to your Expo account once, then build an APK in the cloud:

```bash
npx eas-cli@latest login
cd mobile
npx eas-cli@latest init
npx eas-cli@latest build --platform android --profile preview
```

When the build finishes, open the install link on an Android phone. The `preview` profile is configured in `eas.json` to produce an installable APK.

For a local debug build, install Android Studio, the Android SDK, and platform-tools first, then run `npx expo run:android --device` from this directory.

## API override

The app defaults to the deployed API. To use another API, copy `env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to its base URL. Never put Neon credentials in this file; database secrets belong on the backend only.
