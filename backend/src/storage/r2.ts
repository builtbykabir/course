import { randomUUID } from 'node:crypto'

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  S3ServiceException,
  UploadPartCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { env } from '../config/env.js'

const minimumPartSizeBytes = 5 * 1_024 * 1_024
const preferredPartSizeBytes = 16 * 1_024 * 1_024
const maximumPartCount = 10_000
const mebibyte = 1_024 * 1_024

const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
})

export const presignedUrlTtlSeconds = env.S3_PRESIGNED_URL_TTL_HOURS * 60 * 60

export type CompletedPart = {
  partNumber: number
  eTag: string
}

function fileExtension(fileName: string) {
  const match = /\.[a-z0-9]{1,10}$/i.exec(fileName)
  return match?.[0].toLowerCase() ?? ''
}

export function makeVideoObjectKey(courseId: string, fileName: string) {
  return `courses/${courseId}/videos/${randomUUID()}${fileExtension(fileName)}`
}

export function findMultipartShape(sizeBytes: number) {
  const minimumSizeForPartLimit = Math.ceil(sizeBytes / maximumPartCount)
  const roundedMinimum =
    Math.ceil(minimumSizeForPartLimit / mebibyte) * mebibyte
  const partSizeBytes = Math.max(
    minimumPartSizeBytes,
    preferredPartSizeBytes,
    roundedMinimum,
  )
  const partCount = Math.ceil(sizeBytes / partSizeBytes)

  if (partCount > maximumPartCount) {
    throw new Error('Video is too large for a multipart upload')
  }

  return { partSizeBytes, partCount }
}

export async function startMultipartUpload(input: {
  objectKey: string
  contentType: string
}) {
  const result = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: env.S3_BUCKET,
      Key: input.objectKey,
      ContentType: input.contentType,
      ContentDisposition: 'inline',
    }),
  )

  if (!result.UploadId) {
    throw new Error('R2 did not return a multipart upload id')
  }

  return result.UploadId
}

export async function signUploadParts(input: {
  objectKey: string
  providerUploadId: string
  partNumbers: number[]
}) {
  return Promise.all(
    input.partNumbers.map(async (partNumber) => ({
      partNumber,
      url: await getSignedUrl(
        client,
        new UploadPartCommand({
          Bucket: env.S3_BUCKET,
          Key: input.objectKey,
          UploadId: input.providerUploadId,
          PartNumber: partNumber,
        }),
        { expiresIn: presignedUrlTtlSeconds },
      ),
    })),
  )
}

export async function completeMultipartUpload(input: {
  objectKey: string
  providerUploadId: string
  parts: CompletedPart[]
}) {
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: env.S3_BUCKET,
      Key: input.objectKey,
      UploadId: input.providerUploadId,
      MultipartUpload: {
        Parts: input.parts.map((part) => ({
          ETag: part.eTag,
          PartNumber: part.partNumber,
        })),
      },
    }),
  )
}

export async function abortMultipartUpload(input: {
  objectKey: string
  providerUploadId: string
}) {
  try {
    await client.send(
      new AbortMultipartUploadCommand({
        Bucket: env.S3_BUCKET,
        Key: input.objectKey,
        UploadId: input.providerUploadId,
      }),
    )
  } catch (error: unknown) {
    // EDGE CASE: R2 may have already removed an expired upload. Treat that as
    // an idempotent abort so the application lifecycle can close too.
    if (error instanceof S3ServiceException && error.name === 'NoSuchUpload') {
      return
    }
    throw error
  }
}

export async function findObject(objectKey: string) {
  try {
    const result = await client.send(
      new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }),
    )
    return {
      found: true,
      sizeBytes: result.ContentLength ?? null,
      contentType: result.ContentType ?? null,
    }
  } catch (error: unknown) {
    if (
      error instanceof S3ServiceException &&
      (error.name === 'NotFound' || error.$metadata.httpStatusCode === 404)
    ) {
      return { found: false, sizeBytes: null, contentType: null }
    }

    throw error
  }
}

export async function signVideoPlayback(objectKey: string) {
  const createdAt = new Date()
  const url = await getSignedUrl(
    client,
    // NOTE: Range is not signed so the browser can issue changing byte
    // ranges while seeking without requesting a new playback URL.
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }),
    { expiresIn: presignedUrlTtlSeconds },
  )

  return {
    url,
    expiresAt: new Date(createdAt.getTime() + presignedUrlTtlSeconds * 1_000),
  }
}
