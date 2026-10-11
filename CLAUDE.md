# Zyro Ad Returns dashboard

Vite + React + TypeScript dashboard of daily Google Ads spend vs AdMob revenue for Zyro Gaming Studio.
Deployed on Vercel from `main`; every push redeploys.

## Daily update workflow

All data lives in `data/zyro.json` (amounts in USD). When the user gives a date, spend and revenue:

```bash
npm run add -- --date 2026-10-12 --spend 12.50 --revenue 9.80
npm run add -- --date 2026-10-12 --game idle-empire --spend 8 --revenue 6.2 --installs 41 --note "New creative"
npm run add -- --date 2026-10-12 --spend-pkr 3500 --revenue 9.80   # PKR spend, converted at settings.pkrPerUsd (or --rate)
npm run add -- --date 2026-10-12 --remove                          # delete an entry
```

The same date (+ game) is replaced, not duplicated. Then `npm run build` (validates data + type-checks),
commit `data: <date>` and push. Game ids: idle-empire, gate-war, cannon-smash, arrow-out, sort-game.
If unsure whether spend is USD or PKR, ask.

While `entries` is empty the dashboard shows clearly labelled sample data.
