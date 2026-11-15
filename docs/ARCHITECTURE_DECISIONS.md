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
