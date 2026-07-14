# 🏠 Renovation Manager

A simple app to manage your home renovation — labour attendance, daily wages, advances, material purchases, per-room budgets, and who-paid settlement. Built with Next.js. All data is stored locally in your browser (no server, no login).

## Features
- **Dashboard** — total spent, per-worker balance (pending / advance), and a *who-paid* settlement summary.
- **Attendance** — mark Full / ½ day per worker per date; wages auto-calculate.
- **Payments** — record payments & advances, tagged with who paid.
- **Materials** — track every purchase (item, qty, cost, vendor), assign to a room.
- **Rooms** — set a material budget per room and see spent vs remaining.
- **Workers** — manage workers & daily rates; export/import a JSON backup.
- **History** — full timeline of work days, payments, and purchases.

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Deploy
Deployed on Vercel. Push to `main` to trigger a new deployment.
