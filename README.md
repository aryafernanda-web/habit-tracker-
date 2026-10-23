# Habit Tracker

A modern PWA habit tracking app built with Next.js, TypeScript, and Tailwind CSS.

## Features

- ✅ Daily habit tracking with checklist
- 📊 Weekly & monthly statistics with charts
- 🔥 Streak tracking
- 🌙 Dark / Light mode
- 📦 Export / Import JSON & CSV
- 📱 PWA – installable on Android via Chrome
- 🔌 Works offline (Service Worker + IndexedDB)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Storage**: IndexedDB via `idb`
- **PWA**: next-pwa

## Local Development

> Requires Node.js ≥ 18

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment (Vercel via GitHub)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import project → Select repo
3. Vercel auto-detects Next.js — click **Deploy**

## Data Notice

Data is stored **locally on each device** using IndexedDB. There is no cloud sync between devices. Use the **Export/Import** feature to transfer data between devices.

## PWA Installation (Android)

1. Open the app URL in Chrome for Android
2. Tap the browser menu → **"Add to Home Screen"**
3. The app opens in fullscreen like a native app

## License

MIT
