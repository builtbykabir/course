import { fromNodeHeaders } from 'better-auth/node'
import { and, eq, isNull } from 'drizzle-orm'
import type { Request, RequestHandler } from 'express'
import { z } from 'zod'

import { auth } from '../auth.js'
import { db } from '../db/index.js'
import { course, entitlement, video } from '../db/schema.js'

type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>

type EntitlementTarget = { kind: 'courseSlug' } | { kind: 'videoId' }

type CourseAccess = {
  courseId: string
  videoId?: string
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthSession
      courseAccess?: CourseAccess
    }
  }
}

export async function findSession(
  headers: Parameters<typeof fromNodeHeaders>[0],
) {
  return auth.api.getSession({
    headers: fromNodeHeaders(headers),
  })
}

export function getAuth(request: Request) {
  if (!request.auth) {
    throw new Error('Authenticated request is missing its session')
  }

  return request.auth
}

export function getCourseAccess(request: Request) {
  if (!request.courseAccess) {
    throw new Error('Entitled request is missing its course access')
  }

  return request.courseAccess
}

export async function hasCourseAccess(
  userId: string,
  role: string | null | undefined,
  courseId: string,
) {
  if (role === 'admin') {
    return true
  }

  const [activeEntitlement] = await db
    .select({ id: entitlement.id })
    .from(entitlement)
    .where(
      and(
        eq(entitlement.userId, userId),
        eq(entitlement.courseId, courseId),
        isNull(entitlement.revokedAt),
      ),
    )
    .limit(1)

  return Boolean(activeEntitlement)
}

export const requireAuth: RequestHandler = async (request, response, next) => {
  const session = await findSession(request.headers)

  if (!session) {
    response.status(401).json({ error: 'Authentication required' })
    return
  }

  request.auth = session
  next()
}

export const requireAdmin: RequestHandler = async (request, response, next) => {
  const session = await findSession(request.headers)

  if (!session) {
    response.status(401).json({ error: 'Authentication required' })
    return
  }

  if (session.user.role !== 'admin') {
    response.status(403).json({ error: 'Admin access required' })
    return
  }

  request.auth = session
  next()
}

export function requireEntitlement(target: EntitlementTarget): RequestHandler {
  return async (request, response, next) => {
    const session = request.auth ?? (await findSession(request.headers))

    if (!session) {
      response.status(401).json({ error: 'Authentication required' })
      return
    }

    if (target.kind === 'courseSlug') {
      const parsedSlug = z.string().min(1).safeParse(request.params.slug)

      if (!parsedSlug.success) {
        response.status(400).json({ error: 'Invalid course slug' })
        return
      }

      const [foundCourse] = await db
        .select({ id: course.id })
        .from(course)
        .where(eq(course.slug, parsedSlug.data))
        .limit(1)

      if (!foundCourse) {
        response.status(404).json({ error: 'Course not found' })
        return
      }

      const allowed = await hasCourseAccess(
        session.user.id,
        session.user.role,
        foundCourse.id,
      )

      if (!allowed) {
        response.status(403).json({ error: 'Course access required' })
        return
      }

      request.auth = session
      request.courseAccess = { courseId: foundCourse.id }
      next()
      return
    }

    const parsedVideoId = z.uuid().safeParse(request.params.videoId)

    if (!parsedVideoId.success) {
      response.status(400).json({ error: 'Invalid video id' })
      return
    }

    const [foundVideo] = await db
      .select({ courseId: video.courseId, id: video.id })
      .from(video)
      .where(eq(video.id, parsedVideoId.data))
      .limit(1)

    if (!foundVideo) {
      response.status(404).json({ error: 'Video not found' })
      return
    }

    const allowed = await hasCourseAccess(
      session.user.id,
      session.user.role,
      foundVideo.courseId,
    )

    if (!allowed) {
      response.status(403).json({ error: 'Course access required' })
      return
    }

    request.auth = session
    request.courseAccess = {
      courseId: foundVideo.courseId,
      videoId: foundVideo.id,
    }
    next()
  }
}
