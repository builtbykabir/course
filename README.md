# Course website

A full-stack video course platform with a public catalog, account area,
learning experience, and administration panel. The design and seed content are
adapted from the Feminy Academy demo, but the application only presents
features that the current backend supports.

## What works

- Email and password authentication with email verification
- Google OAuth sign-in
- Public course listing and course detail pages
- Private course access through per-user entitlements
- Admin course, lesson, user, and entitlement management
- Direct multipart video uploads to private R2 or compatible S3 storage
- Entitlement-gated playback with expiring presigned URLs
- HTTP Range playback for streaming and seeking
- Per-user lesson progress and course completion summaries
- Idempotent seed data for two online courses and 18 lessons

The project does not include checkout, Razorpay webhooks, demo-class booking,
live classes, certificates, or public video delivery. Administrators grant
course access until payment processing is implemented.

## Stack

- Frontend: React 19, TypeScript, Vite, and React Router
- Backend: Express 5, TypeScript, and Better Auth
- Database: PostgreSQL 17 with Drizzle ORM
- Email: Resend
- Video storage: private Cloudflare R2 through the S3-compatible API

The browser sends same-origin requests to `/api`. During development, Vite
proxies those requests to Express at `http://localhost:3000`.

## Run the application locally

You need Node.js 20 or newer, npm, Docker, and credentials for the external
services in `backend/.env.example`.

1. Start PostgreSQL from the repository root:

   ```text
   docker compose -f backend/compose.yaml up -d
   ```

2. Create `backend/.env` from `backend/.env.example`, then replace every
   placeholder value. The repository does not provide a local object-storage
   container.

3. Install the backend dependencies, apply the committed migrations, and load
   the demo catalog:

   ```text
   cd backend
   npm install
   npm run db:migrate
   npm run db:seed:demo
   npm run dev
   ```

   The API runs at `http://localhost:3000`. A successful health request to
   `GET /api/health` returns `{ "status": "ok" }`.

4. In another terminal, start the frontend:

   ```text
   cd frontend
   npm install
   npm run dev
   ```

5. Open `http://localhost:5173`.

The seed command can run more than once. It updates the same two courses and
their lessons instead of creating duplicates. Seeded lesson records contain
placeholder object keys until an administrator uploads the matching videos.

## Configure authentication

Set a random `BETTER_AUTH_SECRET` with at least 32 characters. Configure Resend
with a verified sender so new users can receive verification emails.

For Google sign-in, create a Google OAuth web client and register this local
redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `backend/.env`. Use the
deployed `BETTER_AUTH_URL` with the same callback path outside local
development.

## Create an administrator

Create an account through the sign-up page. From `backend/`, promote the
account by email:

```text
npm run admin:promote -- person@example.com
```

The administration panel is available at `http://localhost:5173/admin` after
the promoted account signs in.

## Configure private video storage

Create a private R2 bucket and an API token with Object Read and Write access
to that bucket. Keep public access, `r2.dev`, and custom-domain delivery off.
Set the `S3_*` variables in `backend/.env`.

The browser uploads each video part directly to storage with presigned
`UploadPart` URLs. Express signs and completes the upload but never receives
the video bytes. For playback, Express checks the user session and course
entitlement before it returns a presigned `GetObject` URL.

`S3_PRESIGNED_URL_TTL_HOURS` accepts a value from 1 through 168. The bucket
CORS policy must allow the frontend origin to use `PUT`, `GET`, and `HEAD`, and
must expose the `ETag` header. See
[`docs/R2_STORAGE.md`](docs/R2_STORAGE.md) for the policy and setup checks.

## Project layout

```text
backend/   Express API, authentication, migrations, and seed scripts
frontend/  React application and administration panel
docs/      API reference, architecture decisions, and storage setup
```

Useful documentation:

- [`backend/README.md`](backend/README.md) for backend-specific setup
- [`frontend/README.md`](frontend/README.md) for frontend commands
- [`docs/BACKEND_API.md`](docs/BACKEND_API.md) for the HTTP API
- [`docs/FRONTEND_ADAPTATION.md`](docs/FRONTEND_ADAPTATION.md) for retained,
  adapted, and omitted demo-site content
- [`docs/ARCHITECTURE_DECISIONS.md`](docs/ARCHITECTURE_DECISIONS.md) for accepted
  design decisions

## Verify changes

Run these commands before committing backend changes:

```text
cd backend
npm run build
npm run format:check
```

Run these commands before committing frontend changes:

```text
cd frontend
npm run build
npm run lint
npm run format:check
```
