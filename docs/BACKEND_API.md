# Backend API reference

The API uses JSON and a Better Auth session cookie. Better Auth owns all routes
under `/api/auth/*`.

## Public routes

### `GET /api/courses`

Returns published courses without video data or storage keys.

The route accepts these query parameters:

- `q` searches course names and descriptions.
- `page` defaults to `1`.
- `limit` defaults to `20` and has a maximum of `100`.

### `GET /api/courses/:slug`

Returns a published course and its ordered syllabus. The syllabus includes the
video ID, name, position, and duration. If the request has a valid session, the
response also includes `owned`.

## Signed-in routes

### `GET /api/me/courses`

Returns active entitlements for the signed-in user. Each course includes the
entitlement source, the grant time, and the number of completed videos.

### `GET /api/courses/:slug/content`

Requires an active entitlement or an admin role. Returns the course and its
ordered videos with saved progress. The response never includes `objectKey`.

### `GET /api/videos/:videoId/playback`

Requires an active entitlement or an admin role. The route returns a presigned
R2 `GetObject` URL and its expiration time. The URL supports the browser's HTTP
range requests and does not send video bytes through Express.

### `PUT /api/videos/:videoId/progress`

Requires an active entitlement or an admin role. The request body has this
shape:

```json
{
  "positionSeconds": 120,
  "completed": false
}
```

The route inserts or updates one progress row for the signed-in user and video.

## Admin routes

All routes under `/api/admin` require the `admin` role.

### Course and video routes

- `GET /api/admin/courses`
- `POST /api/admin/courses`
- `GET /api/admin/courses/:id`
- `PATCH /api/admin/courses/:id`
- `DELETE /api/admin/courses/:id`
- `POST /api/admin/courses/:id/videos`
- `PATCH /api/admin/videos/:id`
- `DELETE /api/admin/videos/:id`
- `PUT /api/admin/courses/:id/videos/order`

### Private R2 upload routes

- `POST /api/admin/courses/:courseId/video-uploads`
- `GET /api/admin/video-uploads/:uploadId`
- `POST /api/admin/video-uploads/:uploadId/parts`
- `POST /api/admin/video-uploads/:uploadId/complete`
- `DELETE /api/admin/video-uploads/:uploadId`

The create request contains the video name, file name, content type, byte size,
and optional duration. It returns the part size, the part count, and the upload
expiration time. The parts route signs up to 100 `UploadPart` operations per
request.

The browser uploads every part directly to private R2 and sends the returned
part numbers and ETags to the completion route. Completion verifies the stored
object size, creates the video record, and returns the video. The delete route
aborts an active multipart upload.

A published or archived course keeps its slug. A course with an entitlement
cannot be deleted.

### Entitlement routes

- `GET /api/admin/entitlements?userId=&courseId=`
- `POST /api/admin/entitlements`
- `DELETE /api/admin/entitlements/:id`

The grant request contains `userId` and `courseId`. Repeated grants reactivate
the existing row. The delete route sets `revokedAt` and preserves the row.

Better Auth provides user listing, role changes, bans, session management, and
impersonation under `/api/auth/admin/*`.
