import { Router, type Response } from 'express'
import { z } from 'zod'

import { env } from '../config/env.js'
import { getAuth, requireAuth } from '../middleware/auth.js'
import {
  createPurchaseOrder,
  finalizePurchase,
  findUserPurchase,
  PurchaseError,
} from '../payments/service.js'
import {
  findRazorpayPayment,
  verifyCheckoutSignature,
} from '../payments/razorpay.js'

const createOrderSchema = z.object({
  courseId: z.uuid(),
})

const verifyPaymentSchema = z.object({
  purchaseId: z.uuid(),
  razorpayOrderId: z.string().trim().min(1),
  razorpayPaymentId: z.string().trim().min(1),
  razorpaySignature: z.string().trim().min(1),
})

export const paymentsRouter = Router()

paymentsRouter.use(requireAuth)

function sendPurchaseError(error: PurchaseError, response: Response) {
  const status =
    error.code === 'course_not_found' || error.code === 'purchase_not_found'
      ? 404
      : 409
  response.status(status).json({ error: error.message })
}

paymentsRouter.post('/orders', async (request, response) => {
  const parsedBody = createOrderSchema.safeParse(request.body)

  if (!parsedBody.success) {
    response.status(400).json({
      error: 'Invalid course purchase',
      details: z.treeifyError(parsedBody.error),
    })
    return
  }

  const session = getAuth(request)

  try {
    const result = await createPurchaseOrder(
      session.user.id,
      parsedBody.data.courseId,
    )

    response.json({
      purchase: {
        id: result.purchase.id,
        status: result.purchase.status,
      },
      checkout: {
        keyId: env.RAZORPAY_KEY_ID,
        orderId: result.purchase.razorpayOrderId,
        amount: result.purchase.amountPaise,
        currency: result.purchase.currency,
        name: 'Course Website',
        description: result.courseName,
        prefill: {
          name: session.user.name,
          email: session.user.email,
        },
      },
    })
  } catch (error: unknown) {
    if (error instanceof PurchaseError) {
      sendPurchaseError(error, response)
      return
    }
    throw error
  }
})

paymentsRouter.post('/verify', async (request, response) => {
  const parsedBody = verifyPaymentSchema.safeParse(request.body)

  if (!parsedBody.success) {
    response.status(400).json({
      error: 'Invalid payment verification',
      details: z.treeifyError(parsedBody.error),
    })
    return
  }

  const session = getAuth(request)
  const foundPurchase = await findUserPurchase(
    parsedBody.data.purchaseId,
    session.user.id,
  )

  if (!foundPurchase || !foundPurchase.razorpayOrderId) {
    response.status(404).json({ error: 'Purchase not found' })
    return
  }

  if (foundPurchase.razorpayOrderId !== parsedBody.data.razorpayOrderId) {
    response.status(400).json({ error: 'Payment order does not match' })
    return
  }

  if (
    !verifyCheckoutSignature({
      orderId: foundPurchase.razorpayOrderId,
      paymentId: parsedBody.data.razorpayPaymentId,
      signature: parsedBody.data.razorpaySignature,
    })
  ) {
    response.status(400).json({ error: 'Invalid payment signature' })
    return
  }

  const payment = await findRazorpayPayment(parsedBody.data.razorpayPaymentId)

  if (payment.status !== 'captured' || !payment.captured) {
    response.status(202).json({
      purchase: { id: foundPurchase.id, status: foundPurchase.status },
    })
    return
  }

  try {
    const paidPurchase = await finalizePurchase(payment)
    response.json({
      purchase: { id: paidPurchase.id, status: paidPurchase.status },
    })
  } catch (error: unknown) {
    if (error instanceof PurchaseError) {
      sendPurchaseError(error, response)
      return
    }
    throw error
  }
})

paymentsRouter.get('/:id', async (request, response) => {
  const parsedId = z.uuid().safeParse(request.params.id)

  if (!parsedId.success) {
    response.status(400).json({ error: 'Invalid purchase id' })
    return
  }

  const session = getAuth(request)
  const foundPurchase = await findUserPurchase(parsedId.data, session.user.id)

  if (!foundPurchase) {
    response.status(404).json({ error: 'Purchase not found' })
    return
  }

  response.json({
    purchase: { id: foundPurchase.id, status: foundPurchase.status },
  })
})
