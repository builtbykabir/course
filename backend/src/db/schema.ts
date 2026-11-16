import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  role: text('role').default('user'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    impersonatedBy: text('impersonated_by'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('account_user_id_idx').on(table.userId)],
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
)

export const courseStatus = pgEnum('course_status', [
  'draft',
  'published',
  'archived',
])

export const videoUploadStatus = pgEnum('video_upload_status', [
  'initiated',
  'completed',
  'aborted',
])

export const course = pgTable(
  'course',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description').default('').notNull(),
    pricePaise: integer('price_paise').notNull(),
    currency: text('currency').default('INR').notNull(),
    thumbnailKey: text('thumbnail_key'),
    status: courseStatus('status').default('draft').notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('course_slug_idx').on(table.slug),
    check('course_price_paise_check', sql`${table.pricePaise} >= 0`),
  ],
)

export const video = pgTable(
  'video',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => course.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    objectKey: text('object_key').notNull(),
    position: integer('position').notNull(),
    durationSeconds: integer('duration_seconds'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('video_course_id_position_idx').on(table.courseId, table.position),
    check('video_position_check', sql`${table.position} >= 0`),
    check(
      'video_duration_seconds_check',
      sql`${table.durationSeconds} is null or ${table.durationSeconds} >= 0`,
    ),
  ],
)

export const videoUpload = pgTable(
  'video_upload',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => course.id, { onDelete: 'cascade' }),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    providerUploadId: text('provider_upload_id').notNull(),
    objectKey: text('object_key').notNull(),
    videoName: text('video_name').notNull(),
    fileName: text('file_name').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    partSizeBytes: integer('part_size_bytes').notNull(),
    partCount: integer('part_count').notNull(),
    durationSeconds: integer('duration_seconds'),
    status: videoUploadStatus('status').default('initiated').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    videoId: uuid('video_id').references(() => video.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('video_upload_object_key_idx').on(table.objectKey),
    uniqueIndex('video_upload_video_id_idx').on(table.videoId),
    index('video_upload_course_id_idx').on(table.courseId),
    index('video_upload_created_by_idx').on(table.createdBy),
    check('video_upload_size_bytes_check', sql`${table.sizeBytes} > 0`),
    check(
      'video_upload_part_size_bytes_check',
      sql`${table.partSizeBytes} >= 5242880`,
    ),
    check(
      'video_upload_part_count_check',
      sql`${table.partCount} between 1 and 10000`,
    ),
    check(
      'video_upload_duration_seconds_check',
      sql`${table.durationSeconds} is null or ${table.durationSeconds} >= 0`,
    ),
  ],
)

export const entitlement = pgTable(
  'entitlement',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => course.id, { onDelete: 'restrict' }),
    source: text('source').notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('entitlement_user_id_course_id_idx').on(
      table.userId,
      table.courseId,
    ),
    index('entitlement_course_id_idx').on(table.courseId),
    check(
      'entitlement_source_check',
      sql`${table.source} in ('purchase', 'admin_grant')`,
    ),
  ],
)

export const videoProgress = pgTable(
  'video_progress',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id')
      .notNull()
      .references(() => video.id, { onDelete: 'cascade' }),
    positionSeconds: integer('position_seconds').default(0).notNull(),
    completed: boolean('completed').default(false).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.videoId] }),
    index('video_progress_video_id_idx').on(table.videoId),
    check(
      'video_progress_position_seconds_check',
      sql`${table.positionSeconds} >= 0`,
    ),
  ],
)
