# Frontend

This directory contains the public course site, account experience, learning
area, and administration panel. Vite proxies `/api` requests to the Express
backend at `http://localhost:3000` during local development.

Use these commands from `frontend/`:

```text
npm install
npm run dev
```

Start the backend separately before loading course data or using account and
administration features. Seed the reference course catalog from `backend/`:

```text
npm run db:seed:demo
```

Run `npm run build`, `npm run lint`, and `npm run format:check` before handoff.
