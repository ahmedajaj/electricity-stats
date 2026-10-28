# ⚡ Світло на Русової 7А

Electricity outage statistics for **Київ, Софії Русової 7А**.

The scraper reads the public Telegram channel [@lvivskiy7a](https://t.me/lvivskiy7a) through its web preview
(`t.me/s/lvivskiy7a` — no Telegram login or API keys), stores status changes in `data/events.json` and uploads
them to a [GitHub Gist](https://gist.github.com/ahmedajaj/f73208e345aee68d11c31c4d1f8c32f7). The web app shows
the current status and statistics for any period, plus a live comparison of the Osokorky area with all of Kyiv
(share of [svitlobot.in.ua](https://svitlobot.in.ua/map) points with power).

**Plan vs actual.** ДТЕК publishes (via the Yasno API) the planned outage schedule but keeps no history, so every cron run saves
the schedule for group 37.1 to `data/schedule.json` (also uploaded to the Gist) whenever it changes. Each
revision applies from its `updatedOn` time, so mid-day changes are compared fairly; periods when the schedule
is not in force (`EmergencyShutdowns` etc.) are shown but not counted. A day is marked "графік змінено" only if the
plan in force differed from the first published schedule (placeholders and changes reverted before they took
effect don't count).

**Data format** (status changes, UTC):
```json
[
  { "date": "2025-10-10T00:34:59.000Z", "status": "off" },
  { "date": "2025-10-10T15:36:52.000Z", "status": "on" }
]
```

---

## 🚀 Setup

```bash
npm install
cp .env.example data/.env      # fill in GITHUB_TOKEN
npm run build                  # builds the frontend into web/dist
npm start                      # http://localhost:3000
```

Scheduled scraping (every 10 min – 4 h) runs `npm run gist:run` from cron / launchd.
Set `SKIP_BATTERY=1` to skip the Deye battery message that is sent to Telegram when new events appear.

---

## 📁 Structure

```
├── src/                     # Node backend (CommonJS)
│   ├── server.js            # Express: GET /api/events, /api/schedule, /api/areas + serves web/dist
│   ├── yasno.js             # ДТЕК planned schedule (Yasno API) (group 37.1) → data/schedule.json, every revision kept
│   ├── areaStats.js         # Live Osokorky / Kyiv on-off share from svitlobot.in.ua map feed
│   ├── eventSource.js       # Events from Gist (fallback: data/events.json), read-only
│   ├── scraper.js           # t.me/s/<channel> scraper → data/events.json
│   ├── gist-uploader.js     # GitHub Gist API
│   ├── gist-runner.js       # Cron entry: schedule + scrape + upload, logs to data/gist-cron.log
│   └── battery_level.sh     # Deye battery level → Telegram (after new events)
├── web/                     # Frontend: Vite + React + TypeScript + Tailwind v4 + Recharts
│   └── src/
│       ├── lib/time.ts      # Europe/Kyiv day boundaries (DST-aware)
│       ├── lib/stats.ts     # Periods, outages, daily/hourly statistics (pure functions)
│       ├── lib/schedule.ts  # Plan in force over time vs actual outages
│       ├── lib/format.ts    # Ukrainian formatting
│       └── components/      # Status hero, period picker, charts, calendar, timeline, log
└── data/                    # Runtime data (gitignored): .env, events.json, logs
```

The design system (fonts, colors, cards, segmented controls) is shared with `battery-calculator`.

---

## 🔌 Commands

```bash
npm start            # Web server (serves web/dist)
npm run build        # Install + build the frontend
npm run dev:web      # Frontend dev server on :5175 (proxies /api to :3000 — run npm start too)
npm run scrape       # Scrape the channel once
npm run gist:upload  # Upload data/events.json to the Gist
npm run gist:run     # Scrape + upload (used by cron)
```
