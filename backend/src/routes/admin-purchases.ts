import { desc, eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'

import { db } from '../db/index.js'
import { course, purchase, user } from '../db/schema.js'
import { PurchaseError, reconcilePurchase } from '../payments/service.js'

export const adminPurchasesRouter = Router()

adminPurchasesRouter.get('/purchases', async (_request, response) => {
  const purchases = await db
    .select({
      id: purchase.id,
      amountPaise: purchase.amountPaise,
      currency: purchase.currency,
      status: purchase.status,
      razorpayOrderId: purchase.razorpayOrderId,
      razorpayPaymentId: purchase.razorpayPaymentId,
      paidAt: purchase.paidAt,
      createdAt: purchase.createdAt,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      courseId: course.id,
      courseName: course.name,
      courseSlug: course.slug,
    })
    .from(purchase)
    .innerJoin(user, eq(user.id, purchase.userId))
    .innerJoin(course, eq(course.id, purchase.courseId))
    .orderBy(desc(purchase.createdAt))

  response.json({
    purchases: purchases.map((item) => ({
      id: item.id,
      amountPaise: item.amountPaise,
      currency: item.currency,
      status: item.status,
      razorpayOrderId: item.razorpayOrderId,
      razorpayPaymentId: item.razorpayPaymentId,
      paidAt: item.paidAt,
      createdAt: item.createdAt,
      user: {
        id: item.userId,
        name: item.userName,
        email: item.userEmail,
      },
      course: {
        id: item.courseId,
        name: item.courseName,
        slug: item.courseSlug,
      },
    })),
  })
})

adminPurchasesRouter.post(
  '/purchases/:id/reconcile',
  async (request, response) => {
    const parsedId = z.uuid().safeParse(request.params.id)

    if (!parsedId.success) {
      response.status(400).json({ error: 'Invalid purchase id' })
      return
    }

    try {
      const reconciledPurchase = await reconcilePurchase(parsedId.data)
      response.json({
        purchase: {
          id: reconciledPurchase.id,
          status: reconciledPurchase.status,
          razorpayPaymentId: reconciledPurchase.razorpayPaymentId,
          paidAt: reconciledPurchase.paidAt,
        },
      })
    } catch (error: unknown) {
      if (
        error instanceof PurchaseError &&
        error.code === 'purchase_not_found'
      ) {
        response.status(404).json({ error: error.message })
        return
      }
      throw error
    }
  },
)
