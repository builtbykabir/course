import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'

import { db } from '../db/index.js'
import { course, entitlement, user } from '../db/schema.js'

const listEntitlementsSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  courseId: z.uuid().optional(),
})

const grantEntitlementSchema = z.object({
  userId: z.string().trim().min(1),
  courseId: z.uuid(),
})

export const adminEntitlementsRouter = Router()

adminEntitlementsRouter.get('/entitlements', async (request, response) => {
  const parsedQuery = listEntitlementsSchema.safeParse(request.query)

  if (!parsedQuery.success) {
    response.status(400).json({
      error: 'Invalid entitlement filters',
      details: z.treeifyError(parsedQuery.error),
    })
    return
  }

  const rows = await db
    .select({
      id: entitlement.id,
      userId: entitlement.userId,
      courseId: entitlement.courseId,
      source: entitlement.source,
      revokedAt: entitlement.revokedAt,
      createdAt: entitlement.createdAt,
      userName: user.name,
      userEmail: user.email,
      courseName: course.name,
      courseSlug: course.slug,
    })
    .from(entitlement)
    .innerJoin(user, eq(user.id, entitlement.userId))
    .innerJoin(course, eq(course.id, entitlement.courseId))
    .where(
      and(
        parsedQuery.data.userId
          ? eq(entitlement.userId, parsedQuery.data.userId)
          : undefined,
        parsedQuery.data.courseId
          ? eq(entitlement.courseId, parsedQuery.data.courseId)
          : undefined,
      ),
    )
    .orderBy(desc(entitlement.createdAt))

  response.json({
    entitlements: rows.map((row) => ({
      id: row.id,
      source: row.source,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
      user: {
        id: row.userId,
        name: row.userName,
        email: row.userEmail,
      },
      course: {
        id: row.courseId,
        name: row.courseName,
        slug: row.courseSlug,
      },
    })),
  })
})

adminEntitlementsRouter.post('/entitlements', async (request, response) => {
  const parsedBody = grantEntitlementSchema.safeParse(request.body)

  if (!parsedBody.success) {
    response.status(400).json({
      error: 'Invalid entitlement',
      details: z.treeifyError(parsedBody.error),
    })
    return
  }

  const [[foundUser], [foundCourse]] = await Promise.all([
    db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, parsedBody.data.userId))
      .limit(1),
    db
      .select({ id: course.id })
      .from(course)
      .where(eq(course.id, parsedBody.data.courseId))
      .limit(1),
  ])

  if (!foundUser) {
    response.status(404).json({ error: 'User not found' })
    return
  }

  if (!foundCourse) {
    response.status(404).json({ error: 'Course not found' })
    return
  }

  const [grantedEntitlement] = await db
    .insert(entitlement)
    .values({
      userId: foundUser.id,
      courseId: foundCourse.id,
      source: 'admin_grant',
    })
    .onConflictDoUpdate({
      target: [entitlement.userId, entitlement.courseId],
      set: {
        source: sql<string>`case when ${entitlement.revokedAt} is null then ${entitlement.source} else 'admin_grant' end`,
        revokedAt: null,
      },
    })
    .returning()

  response.json({ entitlement: grantedEntitlement })
})

adminEntitlementsRouter.delete(
  '/entitlements/:id',
  async (request, response) => {
    const parsedId = z.uuid().safeParse(request.params.id)

    if (!parsedId.success) {
      response.status(400).json({ error: 'Invalid entitlement id' })
      return
    }

    const [revokedEntitlement] = await db
      .update(entitlement)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(entitlement.id, parsedId.data), isNull(entitlement.revokedAt)),
      )
      .returning()

    if (revokedEntitlement) {
      response.json({ entitlement: revokedEntitlement })
      return
    }

    const [existingEntitlement] = await db
      .select()
      .from(entitlement)
      .where(eq(entitlement.id, parsedId.data))
      .limit(1)

    if (!existingEntitlement) {
      response.status(404).json({ error: 'Entitlement not found' })
      return
    }

    response.json({ entitlement: existingEntitlement })
  },
)
