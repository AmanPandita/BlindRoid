# Klevel WARN Telemetry

React Native Expo app for a klevel.fyi-style labor dashboard. It calls the WARN Firehose WARN notices endpoint once, stores the result in AsyncStorage, and renders cached telemetry on later launches.

## Commands

```bash
npm install
npm start
```

Open one of the targets from the Expo terminal:

```bash
npm run ios
npm run android
npm run web
```

## API

The app reads the Warn Firehose key from `.env`:

```bash
EXPO_PUBLIC_WARN_FIREHOSE_API_KEY=your_key_here
```

It queries:

```bash
https://warnfirehose.com/api/records?limit=100
```

AsyncStorage key:

```bash
warnfirehose.warn_notices.v1
```

Use the in-app Refresh button to clear and refetch the cache.
