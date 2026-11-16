import { z } from 'zod'

const audienceItemSchema = z.object({
  title: z.string(),
  description: z.string(),
})

const faqItemSchema = z.object({
  question: z.string(),
  answer: z.string(),
})

const courseMetadataSchema = z
  .object({
    eyebrow: z.string().optional(),
    category: z.string().optional(),
    format: z.string().optional(),
    language: z.string().optional(),
    durationLabel: z.string().optional(),
    lessonCount: z.number().optional(),
    audience: z.array(audienceItemSchema).optional(),
    outcomes: z.array(z.string()).optional(),
    features: z.array(z.string()).optional(),
    faq: z.array(faqItemSchema).optional(),
  })
  .catchall(z.unknown())

const publicCourseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  pricePaise: z.number(),
  currency: z.string(),
  metadata: courseMetadataSchema,
})

const videoSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number(),
  durationSeconds: z.number().nullable(),
})

const adminCourseSchema = publicCourseSchema.extend({
  thumbnailKey: z.string().nullable(),
  status: z.enum(['draft', 'published', 'archived']),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const adminVideoSchema = videoSchema.extend({
  courseId: z.string(),
  objectKey: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const videoUploadSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  videoName: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  partSizeBytes: z.number(),
  partCount: z.number(),
  durationSeconds: z.number().nullable(),
  status: z.enum(['initiated', 'completed', 'aborted']),
  expiresAt: z.string(),
  completedAt: z.string().nullable(),
  videoId: z.string().nullable(),
  createdAt: z.string(),
})

const entitlementSchema = z.object({
  id: z.string(),
  source: z.string(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  course: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  }),
})

const purchaseStatusSchema = z.enum(['pending', 'paid'])

const purchaseSchema = z.object({
  id: z.string(),
  status: purchaseStatusSchema,
})

const adminPurchaseSchema = z.object({
  id: z.string(),
  amountPaise: z.number(),
  currency: z.string(),
  status: purchaseStatusSchema,
  razorpayOrderId: z.string().nullable(),
  razorpayPaymentId: z.string().nullable(),
  paidAt: z.string().nullable(),
  createdAt: z.string(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  course: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  }),
})

export type Course = z.infer<typeof publicCourseSchema>
export type CourseMetadata = z.infer<typeof courseMetadataSchema>
export type Video = z.infer<typeof videoSchema>
export type AdminCourse = z.infer<typeof adminCourseSchema>
export type AdminVideo = z.infer<typeof adminVideoSchema>
export type VideoUpload = z.infer<typeof videoUploadSchema>
export type Entitlement = z.infer<typeof entitlementSchema>
export type AdminPurchase = z.infer<typeof adminPurchaseSchema>

export type CourseInput = {
  name: string
  slug: string
  description: string
  pricePaise: number
  currency: string
  status: 'draft' | 'published' | 'archived'
  metadata: CourseMetadata
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
) {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null)
    const parsedError = z.object({ error: z.string() }).safeParse(data)
    throw new ApiError(
      parsedError.success ? parsedError.data.error : 'Request failed',
      response.status,
    )
  }

  if (response.status === 204) {
    return schema.parse(undefined)
  }

  const data: unknown = await response.json()
  return schema.parse(data)
}

export function formatPrice(pricePaise: number, currency: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(pricePaise / 100)
}

export function formatDuration(seconds: number | null) {
  if (!seconds) {
    return 'Self-paced'
  }

  const minutes = Math.round(seconds / 60)
  return `${minutes} min`
}

export function listCourses(query = '') {
  const search = new URLSearchParams({ limit: '100' })
  if (query.trim()) {
    search.set('q', query.trim())
  }

  return request(
    `/api/courses?${search.toString()}`,
    z.object({
      courses: z.array(publicCourseSchema),
      pagination: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
        totalPages: z.number(),
      }),
    }),
  )
}

export function getCourse(slug: string) {
  return request(
    `/api/courses/${encodeURIComponent(slug)}`,
    z.object({
      course: publicCourseSchema,
      videos: z.array(videoSchema),
      owned: z.boolean().optional(),
    }),
  )
}

export function getCourseContent(slug: string) {
  return request(
    `/api/courses/${encodeURIComponent(slug)}/content`,
    z.object({
      course: z.object({
        id: z.string(),
        slug: z.string(),
        name: z.string(),
        description: z.string(),
        status: z.enum(['draft', 'published', 'archived']),
        metadata: courseMetadataSchema,
      }),
      videos: z.array(
        videoSchema.extend({
          progress: z.object({
            positionSeconds: z.number(),
            completed: z.boolean(),
            updatedAt: z.string().nullable(),
          }),
        }),
      ),
    }),
  )
}

export function getMyCourses() {
  return request(
    '/api/me/courses',
    z.object({
      courses: z.array(
        publicCourseSchema.extend({
          status: z.enum(['draft', 'published', 'archived']),
          access: z.object({
            source: z.string(),
            grantedAt: z.string(),
          }),
          progress: z.object({
            completedVideos: z.number(),
            totalVideos: z.number(),
          }),
        }),
      ),
    }),
  )
}

export function getPlayback(videoId: string) {
  return request(
    `/api/videos/${videoId}/playback`,
    z.object({ url: z.string(), expiresAt: z.string() }),
  )
}

export function saveProgress(
  videoId: string,
  positionSeconds: number,
  completed: boolean,
) {
  return request(
    `/api/videos/${videoId}/progress`,
    z.object({
      progress: z.object({
        userId: z.string(),
        videoId: z.string(),
        positionSeconds: z.number(),
        completed: z.boolean(),
        updatedAt: z.string(),
      }),
    }),
    {
      method: 'PUT',
      body: JSON.stringify({ positionSeconds, completed }),
    },
  )
}

export function createPaymentOrder(courseId: string) {
  return request(
    '/api/payments/orders',
    z.object({
      purchase: purchaseSchema,
      checkout: z.object({
        keyId: z.string(),
        orderId: z.string(),
        amount: z.number(),
        currency: z.string(),
        name: z.string(),
        description: z.string(),
        prefill: z.object({ name: z.string(), email: z.string() }),
      }),
    }),
    { method: 'POST', body: JSON.stringify({ courseId }) },
  )
}

export function verifyPayment(input: {
  purchaseId: string
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}) {
  return request(
    '/api/payments/verify',
    z.object({ purchase: purchaseSchema }),
    { method: 'POST', body: JSON.stringify(input) },
  )
}

export function getPurchase(id: string) {
  return request(`/api/payments/${id}`, z.object({ purchase: purchaseSchema }))
}

export function listAdminCourses() {
  return request(
    '/api/admin/courses',
    z.object({ courses: z.array(adminCourseSchema) }),
  )
}

export function getAdminCourse(id: string) {
  return request(
    `/api/admin/courses/${id}`,
    z.object({
      course: adminCourseSchema,
      videos: z.array(adminVideoSchema),
    }),
  )
}

export function createCourse(input: CourseInput) {
  return request(
    '/api/admin/courses',
    z.object({ course: adminCourseSchema }),
    { method: 'POST', body: JSON.stringify(input) },
  )
}

export function updateCourse(id: string, input: CourseInput) {
  return request(
    `/api/admin/courses/${id}`,
    z.object({ course: adminCourseSchema }),
    { method: 'PATCH', body: JSON.stringify(input) },
  )
}

export function deleteCourse(id: string) {
  return request(`/api/admin/courses/${id}`, z.undefined(), {
    method: 'DELETE',
  })
}

export function addVideo(
  courseId: string,
  input: { name: string; objectKey: string; durationSeconds?: number },
) {
  return request(
    `/api/admin/courses/${courseId}/videos`,
    z.object({ video: adminVideoSchema }),
    { method: 'POST', body: JSON.stringify(input) },
  )
}

export function createVideoUpload(
  courseId: string,
  input: {
    videoName: string
    fileName: string
    contentType: string
    sizeBytes: number
    durationSeconds?: number
  },
) {
  return request(
    `/api/admin/courses/${courseId}/video-uploads`,
    z.object({ upload: videoUploadSchema }),
    { method: 'POST', body: JSON.stringify(input) },
  )
}

export function signVideoUploadParts(uploadId: string, partNumbers: number[]) {
  return request(
    `/api/admin/video-uploads/${uploadId}/parts`,
    z.object({
      parts: z.array(z.object({ partNumber: z.number(), url: z.string() })),
      expiresAt: z.string(),
    }),
    { method: 'POST', body: JSON.stringify({ partNumbers }) },
  )
}

export function completeVideoUpload(
  uploadId: string,
  parts: { partNumber: number; eTag: string }[],
) {
  return request(
    `/api/admin/video-uploads/${uploadId}/complete`,
    z.object({ video: adminVideoSchema }),
    { method: 'POST', body: JSON.stringify({ parts }) },
  )
}

export function abortVideoUpload(uploadId: string) {
  return request(`/api/admin/video-uploads/${uploadId}`, z.undefined(), {
    method: 'DELETE',
  })
}

export function updateVideo(
  id: string,
  input: { name?: string; objectKey?: string; durationSeconds?: number },
) {
  return request(
    `/api/admin/videos/${id}`,
    z.object({ video: adminVideoSchema }),
    { method: 'PATCH', body: JSON.stringify(input) },
  )
}

export function deleteVideo(id: string) {
  return request(`/api/admin/videos/${id}`, z.undefined(), {
    method: 'DELETE',
  })
}

export function orderVideos(courseId: string, videoIds: string[]) {
  return request(
    `/api/admin/courses/${courseId}/videos/order`,
    z.object({ videos: z.array(adminVideoSchema) }),
    { method: 'PUT', body: JSON.stringify({ videoIds }) },
  )
}

export function listEntitlements(userId?: string) {
  const search = new URLSearchParams()
  if (userId) {
    search.set('userId', userId)
  }

  const query = search.size ? `?${search.toString()}` : ''
  return request(
    `/api/admin/entitlements${query}`,
    z.object({ entitlements: z.array(entitlementSchema) }),
  )
}

export function listPurchases() {
  return request(
    '/api/admin/purchases',
    z.object({ purchases: z.array(adminPurchaseSchema) }),
  )
}

export function reconcilePayment(purchaseId: string) {
  return request(
    `/api/admin/purchases/${purchaseId}/reconcile`,
    z.object({
      purchase: purchaseSchema.extend({
        razorpayPaymentId: z.string().nullable(),
        paidAt: z.string().nullable(),
      }),
    }),
    { method: 'POST' },
  )
}

export function grantEntitlement(userId: string, courseId: string) {
  return request(
    '/api/admin/entitlements',
    z.object({
      entitlement: z.object({
        id: z.string(),
        userId: z.string(),
        courseId: z.string(),
        source: z.string(),
        revokedAt: z.string().nullable(),
        createdAt: z.string(),
      }),
    }),
    { method: 'POST', body: JSON.stringify({ userId, courseId }) },
  )
}

export function revokeEntitlement(id: string) {
  return request(
    `/api/admin/entitlements/${id}`,
    z.object({ entitlement: z.object({ id: z.string() }).passthrough() }),
    { method: 'DELETE' },
  )
}
