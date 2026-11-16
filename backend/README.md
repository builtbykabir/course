# Backend

Express API for the course website. Authentication is provided by Better Auth,
with PostgreSQL persistence through Drizzle ORM and transactional email through
Resend.

Requires Node.js 20 or newer.

## Local setup

1. Copy `.env.example` to `.env` and replace the placeholder secrets.
2. Start PostgreSQL with `docker compose up -d` or provide another PostgreSQL
   database in `DATABASE_URL`.
3. Install dependencies with `npm install`.
4. Create and apply database migrations with `npm run db:generate` and
   `npm run db:migrate`.
5. Start the API with `npm run dev`.

## Configure private R2 video storage

Create a private R2 bucket and an R2 API token with Object Read & Write access
to that bucket. Set the `S3_*` variables in `.env`. Keep public access, the
`r2.dev` URL, and custom domains disabled.

The admin panel uploads video parts directly to R2. The API creates each
multipart upload, signs its part URLs, records its lifecycle, and completes or
aborts it. The API does not receive video bytes.

Playback uses an entitlement-gated presigned `GetObject` URL. The browser sends
range requests directly to R2 for streaming and seeking. Set
`S3_PRESIGNED_URL_TTL_HOURS` to a value from `1` through `168`.

See [`docs/R2_STORAGE.md`](../docs/R2_STORAGE.md) for the bucket CORS policy and
setup checks.

## Configure Razorpay payments

Create Razorpay Test Mode API keys and set `RAZORPAY_KEY_ID` and
`RAZORPAY_KEY_SECRET` in `.env`. Set `RAZORPAY_WEBHOOK_SECRET` to a separate
random value. Configure that value as the secret for the `order.paid` webhook.

The webhook URL is `/api/webhooks/razorpay` on the deployed backend. Razorpay
requires a public HTTPS URL and cannot deliver a webhook to localhost. Enable
automatic capture in the Razorpay Dashboard.

The signed-in order route reads the amount and currency from the course row.
Both Checkout verification and the webhook call the same idempotent purchase
finalization service. The admin purchase list can re-check a pending Razorpay
order. The application does not implement refunds.

## Create the first admin

Sign up through Better Auth, then promote that account from the backend:

```text
npm run admin:promote -- person@example.com
```

The Better Auth admin plugin provides user listing, role, ban, session, and
impersonation endpoints under `/api/auth/admin/*`. Course and video management
is available under `/api/admin/*`; those routes require an authenticated user
whose role is `admin`.

## Configure Google sign-in

Create a Google OAuth web client and set `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` in `.env`. Register this local authorized redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

Use the deployed `BETTER_AUTH_URL` with the same callback path in production.
Better Auth exposes Google sign-in through its `/api/auth/sign-in/social`
endpoint.

The API listens on `http://localhost:3000` by default. Check it with
`GET /api/health`. Better Auth is mounted at `/api/auth/*`; the frontend Vite
server already proxies `/api` to this service.

See [`docs/BACKEND_API.md`](../docs/BACKEND_API.md) for the course, video,
progress, and entitlement routes.

For Resend, replace `EMAIL_FROM` with a sender on a verified domain before
using the application outside local testing.
