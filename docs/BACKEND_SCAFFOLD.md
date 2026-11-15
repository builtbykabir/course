# Backend integration contract

The Express backend lives in `backend/`. The frontend proxies `/api` to
`http://localhost:3000` during development.

## Keep the app boundaries

The backend separates configuration, persistence, authentication, email, the
Express app, and the process entry point:

```text
backend/
  src/
    config/env.ts
    db/index.ts
    db/schema.ts
    app.ts
    auth.ts
    email.ts
    server.ts
  .env.example
  compose.yaml
  drizzle.config.ts
  package.json
  tsconfig.json
```

Keep `app.ts` free of `listen()` calls. Tests can then import the Express app
without opening a port.

## Run the backend with Node.js

Use npm for backend dependencies and scripts:

```text
npm install
npm run dev
```

Run `npm run build` before `npm start`. The development command uses Node.js
watch mode with `tsx`. The production command runs the compiled JavaScript with
Node.js.

Both apps use Better Auth 1.7.25. Keep the frontend and backend versions equal
when you update Better Auth.

## Connect PostgreSQL

Set `DATABASE_URL` in `backend/.env` to a PostgreSQL connection string. You can
use Neon, the local service in `compose.yaml`, or another PostgreSQL provider.
For a hosted database, include the TLS parameters that the provider requires.

Do not commit `backend/.env`. Copy `backend/.env.example` and set these values:

```text
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@host/database
BETTER_AUTH_SECRET=replace-with-at-least-32-random-characters
BETTER_AUTH_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
RESEND_API_KEY=re_replace_me
EMAIL_FROM=Course Website <onboarding@resend.dev>
```

## Maintain the authentication schema

`backend/src/db/schema.ts` defines the Better Auth `user`, `session`, `account`,
and `verification` tables. Pass the same schema to the Drizzle client and the
Better Auth adapter.

If the Better Auth configuration changes, compare the schema with the current
Better Auth requirements. Update `schema.ts`, then generate and review a Drizzle
migration:

```text
npm run db:generate
npm run db:migrate
```

Apply the migration to the selected PostgreSQL database before you test an auth
flow.

## Preserve the HTTP contract

The frontend expects these routes:

- `GET /api/health` returns a successful JSON response.
- `/api/auth/*` belongs to Better Auth.

Express 5 uses `/api/auth/*splat` for the Better Auth handler. Keep that handler
before `express.json()` because Better Auth reads the request body.

The frontend uses same-origin `/api` requests. Vite proxies those requests
during development. In production, route `/api` from the public site domain to
Express so that browsers treat session cookies as first-party cookies.

## Verify both apps

Before handoff, run these checks:

1. Run `npm run typecheck`, `npm run build`, and `npm run format:check` in
   `backend/`.
2. Run `npm run build`, `npm run lint`, and `npm run format:check` in
   `frontend/`.
3. Generate and inspect the Drizzle migration.
4. Apply the migration to the selected database.
5. Confirm that `/api/health` and `/api/auth/ok` respond through
   `http://localhost:5173`.
6. Test sign-up, email verification, sign-in, sign-out, and password reset with
   a configured Resend sender.
