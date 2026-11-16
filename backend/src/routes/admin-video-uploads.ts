import { and, eq, max } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'

import { db } from '../db/index.js'
import { course, video, videoUpload } from '../db/schema.js'
import { getAuth } from '../middleware/auth.js'
import {
  abortMultipartUpload,
  completeMultipartUpload,
  findMultipartShape,
  findObject,
  makeVideoObjectKey,
  presignedUrlTtlSeconds,
  signUploadParts,
  startMultipartUpload,
} from '../storage/r2.js'

const maximumVideoSizeBytes = 5 * 1_024 * 1_024 * 1_024 * 1_024

const createUploadSchema = z.object({
  videoName: z.string().trim().min(1).max(200),
  fileName: z.string().trim().min(1).max(255),
  contentType: z
    .string()
    .trim()
    .max(200)
    .regex(/^video\/[a-z0-9.+-]+$/i, 'A video content type is required'),
  sizeBytes: z.number().int().positive().max(maximumVideoSizeBytes),
  durationSeconds: z.number().int().min(0).nullable().optional(),
})

const signPartsSchema = z.object({
  partNumbers: z.array(z.number().int().min(1).max(10_000)).min(1).max(100),
})

const completeUploadSchema = z.object({
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().min(1).max(10_000),
        eTag: z.string().trim().min(1).max(512),
      }),
    )
    .min(1)
    .max(10_000),
})

const idSchema = z.uuid()

type CompleteResult =
  | { status: 'not_found' }
  | { status: 'inactive' }
  | { status: 'expired' }
  | { status: 'invalid_parts' }
  | { status: 'completed'; video: typeof video.$inferSelect }

function uploadResponse(upload: typeof videoUpload.$inferSelect) {
  return {
    id: upload.id,
    courseId: upload.courseId,
    videoName: upload.videoName,
    fileName: upload.fileName,
    contentType: upload.contentType,
    sizeBytes: upload.sizeBytes,
    partSizeBytes: upload.partSizeBytes,
    partCount: upload.partCount,
    durationSeconds: upload.durationSeconds,
    status: upload.status,
    expiresAt: upload.expiresAt,
    completedAt: upload.completedAt,
    videoId: upload.videoId,
    createdAt: upload.createdAt,
  }
}

function hasExpired(expiresAt: Date) {
  return expiresAt.getTime() <= Date.now()
}

export const adminVideoUploadsRouter = Router()

adminVideoUploadsRouter.post(
  '/courses/:courseId/video-uploads',
  async (request, response) => {
    const parsedCourseId = idSchema.safeParse(request.params.courseId)
    const parsedBody = createUploadSchema.safeParse(request.body)

    if (!parsedCourseId.success || !parsedBody.success) {
      response.status(400).json({
        error: 'Invalid video upload',
        details: parsedBody.success
          ? undefined
          : z.treeifyError(parsedBody.error),
      })
      return
    }

    const [foundCourse] = await db
      .select({ id: course.id })
      .from(course)
      .where(eq(course.id, parsedCourseId.data))
      .limit(1)

    if (!foundCourse) {
      response.status(404).json({ error: 'Course not found' })
      return
    }

    const session = getAuth(request)
    const { partSizeBytes, partCount } = findMultipartShape(
      parsedBody.data.sizeBytes,
    )
    const objectKey = makeVideoObjectKey(
      foundCourse.id,
      parsedBody.data.fileName,
    )
    const providerUploadId = await startMultipartUpload({
      objectKey,
      contentType: parsedBody.data.contentType,
    })
    const expiresAt = new Date(Date.now() + presignedUrlTtlSeconds * 1_000)

    try {
      const [createdUpload] = await db
        .insert(videoUpload)
        .values({
          courseId: foundCourse.id,
          createdBy: session.user.id,
          providerUploadId,
          objectKey,
          videoName: parsedBody.data.videoName,
          fileName: parsedBody.data.fileName,
          contentType: parsedBody.data.contentType,
          sizeBytes: parsedBody.data.sizeBytes,
          partSizeBytes,
          partCount,
          durationSeconds: parsedBody.data.durationSeconds,
          expiresAt,
        })
        .returning()

      if (!createdUpload) {
        throw new Error('Could not save the video upload')
      }

      response.status(201).json({ upload: uploadResponse(createdUpload) })
    } catch (error: unknown) {
      try {
        await abortMultipartUpload({ objectKey, providerUploadId })
      } catch (abortError: unknown) {
        console.error('Could not abort an untracked R2 upload', abortError)
      }
      throw error
    }
  },
)

adminVideoUploadsRouter.get(
  '/video-uploads/:uploadId',
  async (request, response) => {
    const parsedId = idSchema.safeParse(request.params.uploadId)

    if (!parsedId.success) {
      response.status(400).json({ error: 'Invalid upload id' })
      return
    }

    const [foundUpload] = await db
      .select()
      .from(videoUpload)
      .where(eq(videoUpload.id, parsedId.data))
      .limit(1)

    if (!foundUpload) {
      response.status(404).json({ error: 'Video upload not found' })
      return
    }

    response.json({ upload: uploadResponse(foundUpload) })
  },
)

adminVideoUploadsRouter.post(
  '/video-uploads/:uploadId/parts',
  async (request, response) => {
    const parsedId = idSchema.safeParse(request.params.uploadId)
    const parsedBody = signPartsSchema.safeParse(request.body)

    if (!parsedId.success || !parsedBody.success) {
      response.status(400).json({
        error: 'Invalid upload parts',
        details: parsedBody.success
          ? undefined
          : z.treeifyError(parsedBody.error),
      })
      return
    }

    const partNumbers = parsedBody.data.partNumbers
    const uniquePartNumbers = new Set(partNumbers)
    if (uniquePartNumbers.size !== partNumbers.length) {
      response.status(400).json({ error: 'Part numbers must be unique' })
      return
    }

    const [foundUpload] = await db
      .select()
      .from(videoUpload)
      .where(eq(videoUpload.id, parsedId.data))
      .limit(1)

    if (!foundUpload) {
      response.status(404).json({ error: 'Video upload not found' })
      return
    }

    if (foundUpload.status !== 'initiated') {
      response.status(409).json({ error: 'Video upload is no longer active' })
      return
    }

    if (hasExpired(foundUpload.expiresAt)) {
      response.status(410).json({ error: 'Video upload has expired' })
      return
    }

    if (partNumbers.some((partNumber) => partNumber > foundUpload.partCount)) {
      response
        .status(400)
        .json({ error: 'Part number exceeds the upload size' })
      return
    }

    const parts = await signUploadParts({
      objectKey: foundUpload.objectKey,
      providerUploadId: foundUpload.providerUploadId,
      partNumbers,
    })

    response.json({ parts, expiresAt: foundUpload.expiresAt })
  },
)

adminVideoUploadsRouter.post(
  '/video-uploads/:uploadId/complete',
  async (request, response) => {
    const parsedId = idSchema.safeParse(request.params.uploadId)
    const parsedBody = completeUploadSchema.safeParse(request.body)

    if (!parsedId.success || !parsedBody.success) {
      response.status(400).json({
        error: 'Invalid completed upload',
        details: parsedBody.success
          ? undefined
          : z.treeifyError(parsedBody.error),
      })
      return
    }

    const parts = [...parsedBody.data.parts].sort(
      (first, second) => first.partNumber - second.partNumber,
    )
    const uniquePartNumbers = new Set(parts.map((part) => part.partNumber))

    const result = await db.transaction(
      async (transaction): Promise<CompleteResult> => {
        const [foundUpload] = await transaction
          .select()
          .from(videoUpload)
          .where(eq(videoUpload.id, parsedId.data))
          .limit(1)
          .for('update')

        if (!foundUpload) return { status: 'not_found' }

        if (foundUpload.status === 'completed' && foundUpload.videoId) {
          const [existingVideo] = await transaction
            .select()
            .from(video)
            .where(eq(video.id, foundUpload.videoId))
            .limit(1)

          if (!existingVideo) {
            throw new Error('Completed video upload is missing its video')
          }

          return { status: 'completed', video: existingVideo }
        }

        if (foundUpload.status !== 'initiated') {
          return { status: 'inactive' }
        }

        if (hasExpired(foundUpload.expiresAt)) {
          return { status: 'expired' }
        }

        const containsEveryPart =
          parts.length === foundUpload.partCount &&
          uniquePartNumbers.size === parts.length &&
          parts.every((part, index) => part.partNumber === index + 1)

        if (!containsEveryPart) {
          return { status: 'invalid_parts' }
        }

        let storedObject = await findObject(foundUpload.objectKey)
        if (!storedObject.found) {
          await completeMultipartUpload({
            objectKey: foundUpload.objectKey,
            providerUploadId: foundUpload.providerUploadId,
            parts,
          })
          storedObject = await findObject(foundUpload.objectKey)
        }

        if (
          !storedObject.found ||
          storedObject.sizeBytes !== foundUpload.sizeBytes
        ) {
          throw new Error(
            'Completed R2 object does not match the uploaded video',
          )
        }

        const [positionResult] = await transaction
          .select({ position: max(video.position) })
          .from(video)
          .where(eq(video.courseId, foundUpload.courseId))

        const [createdVideo] = await transaction
          .insert(video)
          .values({
            courseId: foundUpload.courseId,
            name: foundUpload.videoName,
            objectKey: foundUpload.objectKey,
            position: (positionResult?.position ?? -1) + 1,
            durationSeconds: foundUpload.durationSeconds,
          })
          .returning()

        if (!createdVideo) {
          throw new Error('Could not create the video after upload')
        }

        await transaction
          .update(videoUpload)
          .set({
            status: 'completed',
            completedAt: new Date(),
            videoId: createdVideo.id,
          })
          .where(
            and(
              eq(videoUpload.id, foundUpload.id),
              eq(videoUpload.status, 'initiated'),
            ),
          )

        return { status: 'completed', video: createdVideo }
      },
    )

    if (result.status === 'not_found') {
      response.status(404).json({ error: 'Video upload not found' })
      return
    }

    if (result.status === 'inactive') {
      response.status(409).json({ error: 'Video upload is no longer active' })
      return
    }

    if (result.status === 'expired') {
      response.status(410).json({ error: 'Video upload has expired' })
      return
    }

    if (result.status === 'invalid_parts') {
      response.status(400).json({
        error: 'Completed parts must include every upload part exactly once',
      })
      return
    }

    response.json({ video: result.video })
  },
)

adminVideoUploadsRouter.delete(
  '/video-uploads/:uploadId',
  async (request, response) => {
    const parsedId = idSchema.safeParse(request.params.uploadId)

    if (!parsedId.success) {
      response.status(400).json({ error: 'Invalid upload id' })
      return
    }

    const result = await db.transaction(async (transaction) => {
      const [foundUpload] = await transaction
        .select()
        .from(videoUpload)
        .where(eq(videoUpload.id, parsedId.data))
        .limit(1)
        .for('update')

      if (!foundUpload) return 'not_found'
      if (foundUpload.status === 'completed') return 'completed'
      if (foundUpload.status === 'aborted') return 'aborted'

      await abortMultipartUpload({
        objectKey: foundUpload.objectKey,
        providerUploadId: foundUpload.providerUploadId,
      })
      await transaction
        .update(videoUpload)
        .set({ status: 'aborted' })
        .where(eq(videoUpload.id, foundUpload.id))
      return 'aborted'
    })

    if (result === 'not_found') {
      response.status(404).json({ error: 'Video upload not found' })
      return
    }

    if (result === 'completed') {
      response.status(409).json({ error: 'Completed video cannot be aborted' })
      return
    }

    response.status(204).send()
  },
)
