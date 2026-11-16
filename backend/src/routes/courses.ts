import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'

import { db } from '../db/index.js'
import { course, video, videoProgress } from '../db/schema.js'
import {
  findSession,
  getAuth,
  getCourseAccess,
  hasCourseAccess,
  requireEntitlement,
} from '../middleware/auth.js'

const listCoursesSchema = z.object({
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const courseSlugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

export const coursesRouter = Router()

coursesRouter.get('/', async (request, response) => {
  const parsedQuery = listCoursesSchema.safeParse(request.query)

  if (!parsedQuery.success) {
    response.status(400).json({
      error: 'Invalid course filters',
      details: z.treeifyError(parsedQuery.error),
    })
    return
  }

  const { q, page, limit } = parsedQuery.data
  const search = q ? `%${escapeLikePattern(q)}%` : undefined
  const filter = and(
    eq(course.status, 'published'),
    search
      ? or(ilike(course.name, search), ilike(course.description, search))
      : undefined,
  )

  const [courses, [totalResult]] = await Promise.all([
    db
      .select({
        id: course.id,
        slug: course.slug,
        name: course.name,
        description: course.description,
        pricePaise: course.pricePaise,
        currency: course.currency,
        metadata: course.metadata,
      })
      .from(course)
      .where(filter)
      .orderBy(desc(course.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ total: count() }).from(course).where(filter),
  ])

  const total = totalResult?.total ?? 0

  response.json({
    courses,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
})

coursesRouter.get(
  '/:slug/content',
  requireEntitlement({ kind: 'courseSlug' }),
  async (request, response) => {
    const session = getAuth(request)
    const access = getCourseAccess(request)
    const [foundCourse] = await db
      .select({
        id: course.id,
        slug: course.slug,
        name: course.name,
        description: course.description,
        status: course.status,
        metadata: course.metadata,
      })
      .from(course)
      .where(eq(course.id, access.courseId))
      .limit(1)

    if (!foundCourse) {
      response.status(404).json({ error: 'Course not found' })
      return
    }

    const rows = await db
      .select({
        id: video.id,
        name: video.name,
        position: video.position,
        durationSeconds: video.durationSeconds,
        positionSeconds: videoProgress.positionSeconds,
        completed: videoProgress.completed,
        progressUpdatedAt: videoProgress.updatedAt,
      })
      .from(video)
      .leftJoin(
        videoProgress,
        and(
          eq(videoProgress.videoId, video.id),
          eq(videoProgress.userId, session.user.id),
        ),
      )
      .where(eq(video.courseId, foundCourse.id))
      .orderBy(asc(video.position))

    response.json({
      course: foundCourse,
      videos: rows.map((row) => ({
        id: row.id,
        name: row.name,
        position: row.position,
        durationSeconds: row.durationSeconds,
        progress: {
          positionSeconds: row.positionSeconds ?? 0,
          completed: row.completed ?? false,
          updatedAt: row.progressUpdatedAt,
        },
      })),
    })
  },
)

coursesRouter.get('/:slug', async (request, response) => {
  const parsedSlug = courseSlugSchema.safeParse(request.params.slug)

  if (!parsedSlug.success) {
    response.status(400).json({ error: 'Invalid course slug' })
    return
  }

  // R2 object keys stay out of every public response.
  const [foundCourse] = await db
    .select({
      id: course.id,
      slug: course.slug,
      name: course.name,
      description: course.description,
      pricePaise: course.pricePaise,
      currency: course.currency,
      metadata: course.metadata,
    })
    .from(course)
    .where(
      and(eq(course.slug, parsedSlug.data), eq(course.status, 'published')),
    )
    .limit(1)

  if (!foundCourse) {
    response.status(404).json({ error: 'Course not found' })
    return
  }

  const videos = await db
    .select({
      id: video.id,
      name: video.name,
      position: video.position,
      durationSeconds: video.durationSeconds,
    })
    .from(video)
    .where(eq(video.courseId, foundCourse.id))
    .orderBy(asc(video.position))

  const session = await findSession(request.headers)

  if (!session) {
    response.json({ course: foundCourse, videos })
    return
  }

  const owned = await hasCourseAccess(
    session.user.id,
    session.user.role,
    foundCourse.id,
  )

  response.json({ course: foundCourse, videos, owned })
})
