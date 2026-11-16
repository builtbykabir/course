import { and, asc, eq, max, or } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'

import { db } from '../db/index.js'
import { course, video } from '../db/schema.js'
import { requireAdmin } from '../middleware/auth.js'
import { adminEntitlementsRouter } from './admin-entitlements.js'
import { adminPurchasesRouter } from './admin-purchases.js'
import { adminVideoUploadsRouter } from './admin-video-uploads.js'

const courseStatusSchema = z.enum(['draft', 'published', 'archived'])
const metadataSchema = z.record(z.string(), z.unknown())

const createCourseSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must use lowercase letters, numbers, and hyphens',
    ),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(20_000).default(''),
  pricePaise: z.int().min(0),
  currency: z.string().trim().length(3).toUpperCase().default('INR'),
  thumbnailKey: z.string().trim().min(1).nullable().optional(),
  status: courseStatusSchema.default('draft'),
  metadata: metadataSchema.default({}),
})

const updateCourseSchema = createCourseSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required',
  })

const createVideoSchema = z.object({
  name: z.string().trim().min(1).max(200),
  objectKey: z.string().trim().min(1).max(1_024),
  durationSeconds: z.int().min(0).nullable().optional(),
})

const updateVideoSchema = createVideoSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required',
  })

const orderVideosSchema = z.object({
  videoIds: z.array(z.uuid()),
})

type ReorderResult =
  | { status: 'not_found' }
  | { status: 'invalid_order' }
  | { status: 'ok'; videos: (typeof video.$inferSelect)[] }

function parseId(value: string) {
  return z.uuid().safeParse(value)
}

export const adminRouter = Router()

adminRouter.use(requireAdmin)
adminRouter.use(adminEntitlementsRouter)
adminRouter.use(adminPurchasesRouter)
adminRouter.use(adminVideoUploadsRouter)

adminRouter.get('/courses', async (_request, response) => {
  const courses = await db.select().from(course).orderBy(asc(course.createdAt))
  response.json({ courses })
})

adminRouter.post('/courses', async (request, response) => {
  const parsedBody = createCourseSchema.safeParse(request.body)

  if (!parsedBody.success) {
    response.status(400).json({
      error: 'Invalid course',
      details: z.treeifyError(parsedBody.error),
    })
    return
  }

  const [createdCourse] = await db
    .insert(course)
    .values(parsedBody.data)
    .returning()

  response.status(201).json({ course: createdCourse })
})

adminRouter.get('/courses/:id', async (request, response) => {
  const parsedId = parseId(request.params.id)

  if (!parsedId.success) {
    response.status(400).json({ error: 'Invalid course id' })
    return
  }

  const [foundCourse] = await db
    .select()
    .from(course)
    .where(eq(course.id, parsedId.data))
    .limit(1)

  if (!foundCourse) {
    response.status(404).json({ error: 'Course not found' })
    return
  }

  const videos = await db
    .select()
    .from(video)
    .where(eq(video.courseId, foundCourse.id))
    .orderBy(asc(video.position))

  response.json({ course: foundCourse, videos })
})

adminRouter.patch('/courses/:id', async (request, response) => {
  const parsedId = parseId(request.params.id)
  const parsedBody = updateCourseSchema.safeParse(request.body)

  if (!parsedId.success || !parsedBody.success) {
    response.status(400).json({
      error: 'Invalid course update',
      details: parsedBody.success
        ? undefined
        : z.treeifyError(parsedBody.error),
    })
    return
  }

  const updateCondition = parsedBody.data.slug
    ? and(
        eq(course.id, parsedId.data),
        or(eq(course.status, 'draft'), eq(course.slug, parsedBody.data.slug)),
      )
    : eq(course.id, parsedId.data)

  const [updatedCourse] = await db
    .update(course)
    .set(parsedBody.data)
    .where(updateCondition)
    .returning()

  if (!updatedCourse) {
    const [foundCourse] = await db
      .select({ id: course.id })
      .from(course)
      .where(eq(course.id, parsedId.data))
      .limit(1)

    if (foundCourse && parsedBody.data.slug) {
      response.status(409).json({
        error: 'A published or archived course slug cannot be changed',
      })
      return
    }

    response.status(404).json({ error: 'Course not found' })
    return
  }

  response.json({ course: updatedCourse })
})

adminRouter.delete('/courses/:id', async (request, response) => {
  const parsedId = parseId(request.params.id)

  if (!parsedId.success) {
    response.status(400).json({ error: 'Invalid course id' })
    return
  }

  const deletedCourses = await db
    .delete(course)
    .where(eq(course.id, parsedId.data))
    .returning({ id: course.id })

  if (deletedCourses.length === 0) {
    response.status(404).json({ error: 'Course not found' })
    return
  }

  response.status(204).send()
})

adminRouter.post('/courses/:id/videos', async (request, response) => {
  const parsedId = parseId(request.params.id)
  const parsedBody = createVideoSchema.safeParse(request.body)

  if (!parsedId.success || !parsedBody.success) {
    response.status(400).json({
      error: 'Invalid video',
      details: parsedBody.success
        ? undefined
        : z.treeifyError(parsedBody.error),
    })
    return
  }

  const createdVideo = await db.transaction(async (transaction) => {
    const [foundCourse] = await transaction
      .select({ id: course.id })
      .from(course)
      .where(eq(course.id, parsedId.data))
      .limit(1)
      .for('update')

    if (!foundCourse) {
      return null
    }

    const [positionResult] = await transaction
      .select({ position: max(video.position) })
      .from(video)
      .where(eq(video.courseId, foundCourse.id))

    const [created] = await transaction
      .insert(video)
      .values({
        ...parsedBody.data,
        courseId: foundCourse.id,
        position: (positionResult?.position ?? -1) + 1,
      })
      .returning()

    return created ?? null
  })

  if (!createdVideo) {
    response.status(404).json({ error: 'Course not found' })
    return
  }

  response.status(201).json({ video: createdVideo })
})

adminRouter.patch('/videos/:id', async (request, response) => {
  const parsedId = parseId(request.params.id)
  const parsedBody = updateVideoSchema.safeParse(request.body)

  if (!parsedId.success || !parsedBody.success) {
    response.status(400).json({
      error: 'Invalid video update',
      details: parsedBody.success
        ? undefined
        : z.treeifyError(parsedBody.error),
    })
    return
  }

  const [updatedVideo] = await db
    .update(video)
    .set(parsedBody.data)
    .where(eq(video.id, parsedId.data))
    .returning()

  if (!updatedVideo) {
    response.status(404).json({ error: 'Video not found' })
    return
  }

  response.json({ video: updatedVideo })
})

adminRouter.delete('/videos/:id', async (request, response) => {
  const parsedId = parseId(request.params.id)

  if (!parsedId.success) {
    response.status(400).json({ error: 'Invalid video id' })
    return
  }

  const deletedVideos = await db
    .delete(video)
    .where(eq(video.id, parsedId.data))
    .returning({ id: video.id })

  if (deletedVideos.length === 0) {
    response.status(404).json({ error: 'Video not found' })
    return
  }

  response.status(204).send()
})

adminRouter.put('/courses/:id/videos/order', async (request, response) => {
  const parsedId = parseId(request.params.id)
  const parsedBody = orderVideosSchema.safeParse(request.body)

  if (!parsedId.success || !parsedBody.success) {
    response.status(400).json({
      error: 'Invalid video order',
      details: parsedBody.success
        ? undefined
        : z.treeifyError(parsedBody.error),
    })
    return
  }

  const videoIds = parsedBody.data.videoIds
  const uniqueVideoIds = new Set(videoIds)

  if (uniqueVideoIds.size !== videoIds.length) {
    response.status(400).json({ error: 'Video ids must be unique' })
    return
  }

  const reorderedVideos = await db.transaction(
    async (transaction): Promise<ReorderResult> => {
      const [foundCourse] = await transaction
        .select({ id: course.id })
        .from(course)
        .where(eq(course.id, parsedId.data))
        .limit(1)
        .for('update')

      if (!foundCourse) {
        return { status: 'not_found' }
      }

      const currentVideos = await transaction
        .select({ id: video.id })
        .from(video)
        .where(eq(video.courseId, foundCourse.id))
        .for('update')

      const containsEveryVideo =
        currentVideos.length === videoIds.length &&
        currentVideos.every((item) => uniqueVideoIds.has(item.id))

      if (!containsEveryVideo) {
        return { status: 'invalid_order' }
      }

      for (const [position, videoId] of videoIds.entries()) {
        await transaction
          .update(video)
          .set({ position })
          .where(and(eq(video.id, videoId), eq(video.courseId, foundCourse.id)))
      }

      const videos = await transaction
        .select()
        .from(video)
        .where(eq(video.courseId, foundCourse.id))
        .orderBy(asc(video.position))

      return { status: 'ok', videos }
    },
  )

  if (reorderedVideos.status === 'not_found') {
    response.status(404).json({ error: 'Course not found' })
    return
  }

  if (reorderedVideos.status === 'invalid_order') {
    response.status(400).json({
      error: 'Video order must contain every video in the course exactly once',
    })
    return
  }

  response.json({ videos: reorderedVideos.videos })
})
