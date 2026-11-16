# Architecture decisions

Use this file as the structured log of architectural decisions accepted for the project. It intentionally contains no decisions in the template.

Add an entry when the project commits to a choice that future contributors must understand, such as an ownership boundary, public interface, data model, dependency direction, persistence strategy, compatibility policy, or operational invariant. Do not log routine implementation details or unaccepted proposals.

Keep entries append-oriented. If a later decision changes an earlier one, add a new entry and mark the earlier entry as superseded rather than rewriting history.

Use this structure for each decision:

```markdown
## ADR-NNN: Short decision title

- Status: proposed | accepted | superseded | rejected
- Date: YYYY-MM-DD
- Supersedes: ADR-NNN or none
- Related files: repository-relative paths

### Context

Describe the problem, constraints, and evidence that made a decision necessary.

### Decision

State the chosen direction and the boundaries it establishes.

### Alternatives considered

List materially different options and why they were not chosen.

### Consequences

Record the benefits, costs, risks, and follow-up obligations.

### Verification

State how contributors can confirm that the code still follows this decision.
```

## ADR-001: Separate React frontend and Express backend

- Status: superseded
- Date: 2026-11-14
- Supersedes: none
- Related files: `frontend/`, `docs/BACKEND_SCAFFOLD.md`

### Context

The course website needs a browser application, an API, authentication, and PostgreSQL persistence. The frontend and backend need separate development commands without exposing authentication cookies as third-party cookies.

### Decision

Use React, TypeScript, and Vite for the frontend. Use Node.js, TypeScript, and Express 5 for the backend. Better Auth owns authentication, Drizzle ORM owns the database schema and migrations, and Neon hosts PostgreSQL.

The browser calls `/api` on the frontend origin. Vite proxies that path to Express during development, and the production web server must provide the same routing behavior.

### Alternatives considered

A single full-stack framework would combine the two apps, but the requested structure keeps the frontend and backend separate. Direct cross-origin browser requests would avoid a proxy, but they make cookie behavior less reliable across browsers.

### Consequences

Each app has its own package configuration and must provide Prettier commands. The deployment must route `/api` to Express. The backend must allow the frontend origin in Better Auth without using wildcard origins.

### Verification

Run the frontend development server and confirm that a request to `/api/health` reaches Express. Confirm that Better Auth session cookies work through the frontend origin.

## ADR-002: Separate apps with provider-neutral PostgreSQL

- Status: accepted
- Date: 2026-11-14
- Supersedes: ADR-001
- Related files: `frontend/`, `backend/`, `docs/BACKEND_SCAFFOLD.md`

### Context

The course website needs a browser application, an API, authentication, and
PostgreSQL persistence. The frontend and backend need separate development
commands. Authentication cookies must remain first-party cookies.

The project may use Neon or another PostgreSQL provider. Application code must
not depend on one hosting provider.

### Decision

Use React, TypeScript, and Vite for the frontend. Use Node.js, TypeScript, and
Express 5 for the backend. Better Auth owns authentication. Drizzle ORM owns the
database schema and migrations.

Connect to PostgreSQL through `DATABASE_URL`. The connection may point to Neon,
the local service in `backend/compose.yaml`, or another compatible PostgreSQL
instance.

The browser calls `/api` on the frontend origin. Vite proxies that path to
Express during development. The production web server must provide the same
routing behavior.

### Alternatives considered

A single full-stack framework would combine both apps. The requested repository
structure keeps them separate.

The project could require Neon. A provider-neutral connection string keeps the
application portable without changing the database interface.

### Consequences

Each app has its own package configuration and Prettier commands. Both apps use
the same Better Auth version. The deployment must route `/api` to Express. The
backend allows the configured frontend origin and does not allow wildcard
origins.

The selected PostgreSQL provider must support the generated migration. Hosted
providers must include their required TLS settings in `DATABASE_URL`.

### Verification

Run both development servers. Confirm that `/api/health` and `/api/auth/ok`
respond through the frontend origin. Test sign-up and session cookies after you
apply the migration to the selected database.

## ADR-003: Use entitlements as the course-access record

- Status: accepted
- Date: 2026-11-15
- Supersedes: none
- Related files: `backend/src/db/schema.ts`, `backend/src/middleware/auth.ts`

### Context

Course access can come from a purchase or an admin grant. Every content route
needs the same access rule.

### Decision

The `entitlement` table is the course-access record. A user can access a course
when an active entitlement exists for that user and course. Admins can access
every course without an entitlement.

Revocation sets `revoked_at` and preserves the row. The initial model has no
free-preview exception.

### Alternatives considered

Roles cannot represent per-course purchases. Separate purchase and admin-grant
checks would duplicate access logic across routes.

### Consequences

Razorpay can grant access by inserting or reactivating an entitlement. Course
deletion fails when an entitlement refers to the course.

### Verification

Check that content, playback, and progress routes use `requireEntitlement`.
Confirm that the course foreign key on `entitlement` uses `ON DELETE RESTRICT`.

## ADR-004: Keep published course slugs immutable

- Status: accepted
- Date: 2026-11-15
- Supersedes: none
- Related files: `backend/src/routes/admin.ts`

### Context

Public course URLs use slugs. Changing a slug after publication breaks saved and
shared links.

### Decision

Admins can change a course slug while the course is a draft. Publishing or
archiving the course makes the slug immutable.

### Alternatives considered

Mutable slugs would require a redirect table and a redirect-retention policy.
The current scope does not need either one.

### Consequences

Admins must choose the final slug before publication. A future slug change
requires a separate redirect design.

### Verification

Send `PATCH /api/admin/courses/:id` with a different slug for a published or
archived course. The API returns `409`.

## ADR-005: Keep video transfer outside the application backend

- Status: accepted
- Date: 2026-11-15
- Supersedes: none
- Related files: `backend/src/storage/r2.ts`, `backend/src/routes/admin-video-uploads.ts`, `backend/src/routes/videos.ts`, `backend/src/db/schema.ts`

### Context

Course videos are large. Sending uploads or playback through Express would use
application bandwidth and tie long-running transfers to an API process. The R2
bucket must remain private, and the application must enforce course access.

### Decision

Use the R2 S3-compatible API through `@aws-sdk/client-s3`. Administrators upload
parts directly to R2 with presigned `UploadPart` URLs. The backend records the
multipart lifecycle and completes or aborts the provider upload.

After the existing entitlement middleware allows playback, the backend returns
a presigned `GetObject` URL. The browser requests video bytes and byte ranges
directly from R2. `S3_PRESIGNED_URL_TTL_HOURS` controls the URL lifetime.

Keep public bucket access, `r2.dev`, custom domains, Workers, and WAF delivery
out of this design.

### Alternatives considered

Proxying video through Express would keep one application hostname but would
consume backend bandwidth for every upload and playback request.

An R2 custom domain would use Cloudflare Cache, but the domain makes the bucket
public unless paid access controls protect it. The current design does not use
paid Cloudflare features.

### Consequences

The R2 bucket needs a CORS policy that allows the frontend to send `PUT`, `GET`,
and `HEAD` requests and read `ETag` headers. Presigned URLs are bearer tokens
until they expire. The API must return them only after an admin or entitlement
check.

The database records upload state so retries cannot create duplicate lessons.
R2 handles playback range requests without sending bytes through Express.

### Verification

Confirm that multipart `PUT` requests and playback `GET` requests go to the R2
S3 API endpoint. Confirm that playback returns `206 Partial Content` for a
request with a valid `Range` header. Confirm that the playback endpoint returns
`401` or `403` before it signs a URL for a user without course access.

## ADR-006: Finalize captured purchases through one service

- Status: accepted
- Date: 2026-11-16
- Supersedes: none
- Related files: `backend/src/payments/`, `backend/src/routes/payments.ts`, `backend/src/routes/razorpay-webhook.ts`, `backend/src/db/schema.ts`

### Context

Razorpay can confirm a payment through the browser response, a webhook, or a
later API query. These confirmations can arrive more than once or in a
different order. Course access must open without creating duplicate purchases
or entitlements.

### Decision

Store one pending purchase per user and course. Snapshot the course amount and
currency when the backend creates the Razorpay order. Never accept an amount
from the browser.

Checkout verification, payment webhooks, and admin reconciliation call one
idempotent finalization service. The service grants access only for a captured
payment whose order, amount, and currency match the purchase. The purchase
state moves only from `pending` to `paid`.

Link a purchased entitlement to its purchase. Keep admin grants independent of
purchase records. Do not implement refunds in this phase.

### Alternatives considered

A webhook-only flow would leave a customer waiting when local development or a
delivery failure delays the webhook. A browser-only flow would miss payments
when the customer closes the tab. Separate completion code would duplicate the
same amount, state, and entitlement rules.

### Consequences

The backend needs outbound access to the Razorpay API. Webhook verification
must read the raw request body before `express.json()`. The event ID prevents
duplicate webhook processing. A user-row lock and the partial unique purchase
index serialize payment finalization with order creation.

The admin panel can re-check a pending order against Razorpay. Test Mode works
on localhost through Checkout verification, but webhook testing needs a public
HTTPS backend.

### Verification

Confirm that two order requests for the same user and course return the same
pending purchase. Confirm that both Checkout verification and `order.paid`
grant one entitlement. Replay the same webhook event and confirm that the
purchase and entitlement do not change.
