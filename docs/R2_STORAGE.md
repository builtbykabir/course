# Configure private R2 video storage

This setup keeps the R2 bucket private. Browsers upload and play videos through
expiring presigned URLs. Express signs requests but never carries video bytes.

## Create the bucket and credentials

1. Create an R2 bucket for course videos.
2. Keep **Public Development URL** disabled.
3. Do not attach a custom domain.
4. Create an R2 API token with Object Read & Write access to this bucket only.
5. Copy the S3 API endpoint, the access key ID, and the secret access key into
   the backend `.env` file.

Use this environment configuration:

```text
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=<bucket-name>
S3_ACCESS_KEY_ID=<access-key-id>
S3_SECRET_ACCESS_KEY=<secret-access-key>
S3_PRESIGNED_URL_TTL_HOURS=2
```

The expiration value must be an integer from `1` through `168`.

## Configure browser access

Add this CORS policy to the R2 bucket. Replace the origins with the frontend
origins that can upload and play videos.

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://courses.example.com"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": [
      "ETag",
      "Accept-Ranges",
      "Content-Length",
      "Content-Range"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

The admin uploader needs the `ETag` header from every `UploadPart` response.
The player uses `Range` requests against the presigned `GetObject` URL when a
viewer seeks.

CORS does not make the bucket public. R2 still checks the signature on every
upload and playback request.

## Apply the database migration

Run the migration before you start the API:

```text
cd backend
npm run db:migrate
```

The `video_upload` table records each upload as `initiated`, `completed`, or
`aborted`. R2 aborts incomplete multipart uploads after seven days by default.
The application also aborts an upload when the administrator cancels it or a
part upload fails.

## Check the flow

1. Sign in as an administrator.
2. Open a course in the admin panel.
3. Select a video and start the lesson upload.
4. In the browser network panel, confirm that part `PUT` requests go to the R2
   S3 API endpoint, not the Express API.
5. Complete the upload and confirm that the lesson appears in the course.
6. Sign in as a user with course access and play the lesson.
7. Confirm that the video request goes to R2 and returns `206 Partial Content`
   when the browser sends a `Range` header.
