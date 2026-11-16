import {
  abortVideoUpload,
  completeVideoUpload,
  createVideoUpload,
  signVideoUploadParts,
} from './api'

const signedPartBatchSize = 100
const uploadConcurrency = 3
const maximumAttempts = 3

type CompletedPart = {
  partNumber: number
  eTag: string
}

type SignedPart = {
  partNumber: number
  url: string
}

function uploadPart(input: {
  url: string
  body: Blob
  signal: AbortSignal
  onProgress: (loadedBytes: number) => void
}) {
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest()
    let lastLoadedBytes = 0

    function abort() {
      request.abort()
    }

    input.signal.addEventListener('abort', abort, { once: true })
    request.open('PUT', input.url)
    request.upload.addEventListener('progress', (event) => {
      const addedBytes = event.loaded - lastLoadedBytes
      lastLoadedBytes = event.loaded
      input.onProgress(addedBytes)
    })
    request.addEventListener('load', () => {
      input.signal.removeEventListener('abort', abort)
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`R2 rejected an upload part (${request.status})`))
        return
      }

      const eTag = request.getResponseHeader('ETag')
      if (!eTag) {
        reject(
          new Error(
            'R2 did not expose the ETag header. Check the bucket CORS policy.',
          ),
        )
        return
      }
      resolve(eTag)
    })
    request.addEventListener('error', () => {
      input.signal.removeEventListener('abort', abort)
      reject(new Error('The upload connection to R2 failed'))
    })
    request.addEventListener('abort', () => {
      input.signal.removeEventListener('abort', abort)
      reject(new DOMException('Upload cancelled', 'AbortError'))
    })
    request.send(input.body)
  })
}

async function uploadPartWithRetry(input: {
  url: string
  body: Blob
  partNumber: number
  signal: AbortSignal
  onProgress: (loadedBytes: number) => void
}): Promise<CompletedPart> {
  let attempt = 0

  while (attempt < maximumAttempts) {
    attempt += 1
    let loadedThisAttempt = 0
    try {
      const eTag = await uploadPart({
        url: input.url,
        body: input.body,
        signal: input.signal,
        onProgress: (loadedBytes) => {
          loadedThisAttempt += loadedBytes
          input.onProgress(loadedBytes)
        },
      })
      return { partNumber: input.partNumber, eTag }
    } catch (error: unknown) {
      input.onProgress(-loadedThisAttempt)
      if (
        input.signal.aborted ||
        attempt === maximumAttempts ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        throw error
      }
    }
  }

  throw new Error('Upload part failed')
}

export async function uploadCourseVideo(input: {
  courseId: string
  videoName: string
  durationSeconds?: number
  file: File
  signal: AbortSignal
  onProgress: (uploadedBytes: number, totalBytes: number) => void
}) {
  const created = await createVideoUpload(input.courseId, {
    videoName: input.videoName,
    fileName: input.file.name,
    contentType: input.file.type || 'video/mp4',
    sizeBytes: input.file.size,
    durationSeconds: input.durationSeconds,
  })
  const upload = created.upload
  let uploadedBytes = 0

  try {
    const signedParts: SignedPart[] = []
    for (
      let start = 1;
      start <= upload.partCount;
      start += signedPartBatchSize
    ) {
      const end = Math.min(start + signedPartBatchSize - 1, upload.partCount)
      const partNumbers = Array.from(
        { length: end - start + 1 },
        (_, index) => start + index,
      )
      const signed = await signVideoUploadParts(upload.id, partNumbers)
      signedParts.push(...signed.parts)
    }

    const completedParts: CompletedPart[] = []
    let nextPartIndex = 0

    async function worker() {
      while (nextPartIndex < signedParts.length) {
        const currentIndex = nextPartIndex
        nextPartIndex += 1
        const signedPart = signedParts[currentIndex]
        if (!signedPart) return

        const start = (signedPart.partNumber - 1) * upload.partSizeBytes
        const end = Math.min(start + upload.partSizeBytes, input.file.size)
        const completedPart = await uploadPartWithRetry({
          url: signedPart.url,
          body: input.file.slice(start, end),
          partNumber: signedPart.partNumber,
          signal: input.signal,
          onProgress: (addedBytes) => {
            uploadedBytes += addedBytes
            input.onProgress(uploadedBytes, input.file.size)
          },
        })
        completedParts.push(completedPart)
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(uploadConcurrency, signedParts.length) },
        () => worker(),
      ),
    )

    completedParts.sort((first, second) => first.partNumber - second.partNumber)
    return await completeVideoUpload(upload.id, completedParts)
  } catch (error: unknown) {
    await abortVideoUpload(upload.id).catch(() => undefined)
    throw error
  }
}
