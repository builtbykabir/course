# Course app: API and database design

Scope of this doc: everything you need to get Better Auth, RBAC and courses/videos CRUD working. Playback (R2 presigning) and payments (Razorpay) are designed for, but stubbed until you've finished the docs.

## Decisions baked in

- **Better Auth owns users, sessions and passwords.** Your `Users` box (emailId, password) doesn't get hand-built. Better Auth generates `user`, `session`, `account` and `verification` tables, and the password hash lives in `account`, not `user`.
- **RBAC = Better Auth's `admin` plugin.** It adds `role` (plus `banned`, `ban_reason`, `ban_expires`) to `user`, and `impersonated_by` to `session`. Two roles: `user` and `admin`. It also ships list-users, set-role and ban endpoints, so you don't write a users admin API yourself.
- **`entitlement` is the single source of truth for access.** Razorpay will later just insert a row. Until then, an admin "grant" endpoint lets you test the whole flow.
- **Object keys never leave the server.** Clients only ever get a short-lived presigned URL from a playback endpoint that checks entitlement first.
- **Your "Content Interactions" box becomes `video_progress`** (current state per user per video), not an event log. One row per (user, video), upserted. That's what a resume-where-you-left-off player needs. Add a `watch_event` log later only if you want analytics.

## 1. Database

Better Auth tables: run its CLI generate/migrate after configuring the plugin. `user` is a reserved word in Postgres, so quote it in your own FKs (`"user"`). Better Auth ids are strings, so FKs to it are `text`, not `uuid`.

```sql
create type course_status as enum ('draft', 'published', 'archived');

create table course (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  description   text not null default '',
  price_paise   integer not null check (price_paise >= 0),   -- Razorpay amounts are in paise
  currency      text not null default 'INR',
  thumbnail_key text,                                        -- R2 key, optional
  status        course_status not null default 'draft',
  metadata      jsonb not null default '{}',                 -- level, language, tags, etc.
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table video (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid not null references course(id) on delete cascade,
  name             text not null,
  object_key       text not null,                            -- R2 object key, server-side only
  position         integer not null,                         -- order within the course
  duration_seconds integer,                                  -- optional, nice for the UI
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on video (course_id, position);

create table entitlement (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references "user"(id) on delete cascade,
  course_id  uuid not null references course(id) on delete restrict,  -- can't delete a course people paid for
  source     text not null check (source in ('purchase', 'admin_grant')),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table video_progress (
  user_id          text not null references "user"(id) on delete cascade,
  video_id         uuid not null references video(id) on delete cascade,
  position_seconds integer not null default 0,
  completed        boolean not null default false,
  updated_at       timestamptz not null default now(),
  primary key (user_id, video_id)
);
```

Notes:

- `metadata`: use real columns for anything you'll filter or sort on (level, language); keep jsonb for the long tail.
- `position` deliberately has no unique constraint on `(course_id, position)`, since that makes reordering painful. Reorder in one transaction instead (see the admin routes).
- When Razorpay lands you'll add a `payment`/`order` table and a `payment_id` on `entitlement`. Don't build it yet.
- **The access rule, used everywhere:** a user may access a course if they're an admin, or there's an `entitlement` row for (user, course) with `revoked_at is null`.

## 2. API

JSON over REST, validated with zod, session cookie from Better Auth. Three middlewares do all the gating:

- `requireAuth`: valid session, else 401.
- `requireAdmin`: `session.user.role === 'admin'`, else 403.
- `requireEntitlement`: resolves the course (from the course id, or via the video), applies the access rule above, else 403.

### Auth (Better Auth, mounted at `/api/auth/*`, not hand-written)

Sign up, sign in, sign out, get session, change password, request/confirm password reset, update name, change email. Profile page = these calls from the Better Auth client. Check the current docs for exact method names (reset-password naming has changed between versions), and enable email verification/reset only once you have a mail provider.

Make sure `role` can't be set from the sign-up payload (mark it non-input), and bootstrap your first admin by updating `role` in the DB, or with the plugin's admin-user-ids option.

### Public

| Method | Route | Notes |
|---|---|---|
| GET | `/api/courses` | Published only. `?q=`, `?page=`, `?limit=`. Returns card fields, no videos. |
| GET | `/api/courses/:slug` | Course detail plus the video **list** (id, name, position, duration; no object keys) so the sales page can show a syllabus. If a session exists, include `owned: boolean`. |

### Authenticated user

| Method | Route | Notes |
|---|---|---|
| GET | `/api/me/courses` | Courses the user is entitled to, with progress summary (videos completed / total). Powers `/purchases`. |
| GET | `/api/courses/:slug/content` | `requireEntitlement`. Video list plus the user's progress per video. |
| GET | `/api/videos/:videoId/playback` | `requireEntitlement`. Returns `{ url, expiresAt }`: a presigned R2 GET URL for the video's `object_key`. Stub it with a fixed URL until the R2 part is done. |
| PUT | `/api/videos/:videoId/progress` | `requireEntitlement`. Body `{ positionSeconds, completed }`. Upsert into `video_progress`. The player calls this every ~10-15s and on pause/end. |

### Admin (`requireAdmin`, all under `/api/admin`)

| Method | Route | Notes |
|---|---|---|
| GET | `/courses` | All statuses. |
| POST | `/courses` | name, slug, description, price, metadata, status. |
| GET | `/courses/:id` | Course plus videos, ordered. |
| PATCH | `/courses/:id` | Partial update, including publishing/archiving. |
| DELETE | `/courses/:id` | Hard delete is blocked by the FK once anyone has an entitlement. Archive instead; only allow a real delete when there are none. |
| POST | `/courses/:id/videos` | name, object_key, optional duration. Optionally `HeadObject` the key on R2 to confirm it exists. Appends at the end. |
| PATCH | `/videos/:id` | Rename, change key. |
| DELETE | `/videos/:id` | Cascades progress rows. |
| PUT | `/courses/:id/videos/order` | Body: ordered array of video ids. Rewrite `position` in one transaction. |
| GET | `/entitlements` | `?userId=`, `?courseId=`. |
| POST | `/entitlements` | `{ userId, courseId }`, `source = 'admin_grant'`. Idempotent thanks to the unique constraint. |
| DELETE | `/entitlements/:id` | Sets `revoked_at` rather than deleting the row. |

User management (list, set role, ban): use the Better Auth admin plugin's own endpoints from the admin dashboard.

### Playback specifics (for when you get to it)

- R2 presigned URLs are generated with the S3-compatible client against the `<account>.r2.cloudflarestorage.com` endpoint. They don't work on a custom domain.
- Pick a TTL longer than a typical viewing session (an hour or two), since the player will keep range-requesting the same URL while seeking. Re-fetch the playback URL when the player errors with 403.
- Encode with `-movflags +faststart` so MP4s start playing before fully downloaded and seeking works.

## 3. Frontend routes

| Route | Access | Page |
|---|---|---|
| `/` | public | Landing page |
| `/courses` | public | Course listing |
| `/courses/:slug` | public | Course detail/sales page: description, price, syllabus, buy/continue button |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | public | Auth pages |
| `/purchases` | auth | My courses with progress |
| `/courses/:slug/content` | entitled | All videos in the course, progress per video, "continue" button |
| `/courses/:slug/content/:videoId` | entitled | Player page: video, title, prev/next, sidebar of the course's videos |
| `/profile` | auth | Change name, email, password |
| `/admin` | admin | Overview |
| `/admin/courses` | admin | Course table |
| `/admin/courses/new` | admin | Create form |
| `/admin/courses/:id` | admin | Edit course; videos tab with add/rename/delete/reorder |
| `/admin/users` | admin | Users, roles, bans, grant access |

Route guards on the frontend are for UX only (redirect to `/login`, or to `/courses/:slug` if not entitled). The API is where access is actually enforced.

Player page behaviour worth planning: resume from saved `position_seconds`, save progress periodically, autoplay-next on end, playback speed control, keyboard shortcuts.

## 4. Suggested build order

1. Better Auth + admin plugin + migrations; seed an admin; sign up and sign in working end to end.
2. `course` and `video` tables, admin CRUD routes, `requireAdmin`.
3. Public course routes (list and detail).
4. `entitlement` table, admin grant/revoke, `/api/me/courses`, `requireEntitlement`.
5. `/content` route and the stubbed `/playback` route; build the frontend pages against these.
6. `video_progress` and the progress route.
7. Swap the stub for real R2 presigning.
8. Razorpay: create order, then a **webhook** (not the client redirect) inserts the entitlement. Verify the signature, and make it idempotent so a retried webhook doesn't double-grant.

## 5. Open decisions

- **Slug vs id in URLs.** The doc uses slugs on the public side and ids in admin. Make slug immutable after publishing, or you break shared links.
- **Free preview video.** A boolean `is_preview` on `video` that bypasses the entitlement check is a cheap, common addition for sales pages. Not in the schema above.
- **Refunds.** The `revoked_at` column already supports it; you only need to decide the policy.