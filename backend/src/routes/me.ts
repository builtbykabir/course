import { and, count, desc, eq, isNull, sql } from 'drizzle-orm'
import { Router } from 'express'

import { db } from '../db/index.js'
import { course, entitlement, video, videoProgress } from '../db/schema.js'
import { getAuth, requireAuth } from '../middleware/auth.js'

export const meRouter = Router()

meRouter.use(requireAuth)

meRouter.get('/courses', async (request, response) => {
  const session = getAuth(request)
  const rows = await db
    .select({
      id: course.id,
      slug: course.slug,
      name: course.name,
      description: course.description,
      pricePaise: course.pricePaise,
      currency: course.currency,
      status: course.status,
      metadata: course.metadata,
      entitlementSource: entitlement.source,
      entitlementCreatedAt: entitlement.createdAt,
      totalVideos: count(video.id),
      completedVideos:
        sql<number>`count(${videoProgress.videoId}) filter (where ${videoProgress.completed} = true)`.mapWith(
          Number,
        ),
    })
    .from(entitlement)
    .innerJoin(course, eq(course.id, entitlement.courseId))
    .leftJoin(video, eq(video.courseId, course.id))
    .leftJoin(
      videoProgress,
      and(
        eq(videoProgress.videoId, video.id),
        eq(videoProgress.userId, session.user.id),
      ),
    )
    .where(
      and(
        eq(entitlement.userId, session.user.id),
        isNull(entitlement.revokedAt),
      ),
    )
    .groupBy(course.id, entitlement.source, entitlement.createdAt)
    .orderBy(desc(entitlement.createdAt))

  response.json({
    courses: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      pricePaise: row.pricePaise,
      currency: row.currency,
      status: row.status,
      metadata: row.metadata,
      access: {
        source: row.entitlementSource,
        grantedAt: row.entitlementCreatedAt,
      },
      progress: {
        completedVideos: row.completedVideos,
        totalVideos: row.totalVideos,
      },
    })),
  })
})
