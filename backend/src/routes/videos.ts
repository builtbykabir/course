import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'

import { db } from '../db/index.js'
import { video, videoProgress } from '../db/schema.js'
import {
  getAuth,
  getCourseAccess,
  requireEntitlement,
} from '../middleware/auth.js'
import { signVideoPlayback } from '../storage/r2.js'

const updateProgressSchema = z.object({
  positionSeconds: z.int().min(0),
  completed: z.boolean(),
})

export const videosRouter = Router()

videosRouter.get(
  '/:videoId/playback',
  requireEntitlement({ kind: 'videoId' }),
  async (request, response) => {
    const access = getCourseAccess(request)

    if (!access.videoId) {
      throw new Error('Playback request is missing its video id')
    }

    const [foundVideo] = await db
      .select({ objectKey: video.objectKey })
      .from(video)
      .where(eq(video.id, access.videoId))
      .limit(1)

    if (!foundVideo) {
      response.status(404).json({ error: 'Video not found' })
      return
    }

    response.json(await signVideoPlayback(foundVideo.objectKey))
  },
)

videosRouter.put(
  '/:videoId/progress',
  requireEntitlement({ kind: 'videoId' }),
  async (request, response) => {
    const parsedBody = updateProgressSchema.safeParse(request.body)

    if (!parsedBody.success) {
      response.status(400).json({
        error: 'Invalid video progress',
        details: z.treeifyError(parsedBody.error),
      })
      return
    }

    const session = getAuth(request)
    const access = getCourseAccess(request)

    if (!access.videoId) {
      throw new Error('Video progress request is missing its video id')
    }

    const updatedAt = new Date()
    const [progress] = await db
      .insert(videoProgress)
      .values({
        userId: session.user.id,
        videoId: access.videoId,
        ...parsedBody.data,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: [videoProgress.userId, videoProgress.videoId],
        set: {
          ...parsedBody.data,
          updatedAt,
        },
      })
      .returning()

    response.json({ progress })
  },
)
