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

The API listens on `http://localhost:3000` by default. Check it with
`GET /api/health`. Better Auth is mounted at `/api/auth/*`; the frontend Vite
server already proxies `/api` to this service.

For Resend, replace `EMAIL_FROM` with a sender on a verified domain before
using the application outside local testing.
