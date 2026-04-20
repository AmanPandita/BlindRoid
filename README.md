# Klevel WARN Telemetry

React Native Expo app for a minimal Blind/layoffs.fyi-style WARN dashboard. It calls the WARN Firehose WARN notices endpoint, stores the result in AsyncStorage, and renders cached telemetry on later launches until the cache is 24 hours old.

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

Cached records are reused for 24 hours. Once the cache is older than 24 hours, the app automatically refetches and stores fresh WARN notices on launch.

## Screens

- Overview: 7-day and 30-day WARN momentum, company count, average impact, and monthly worker trend.
- Companies: top companies in the last 7 days, last 30 days, and the full cached data set.
- Regions: state exposure and industry stress rankings.
- Notices: recent WARN notice tape.
