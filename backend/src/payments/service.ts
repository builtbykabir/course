import { randomUUID } from 'node:crypto'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '../db/index.js'
import { course, entitlement, purchase, user } from '../db/schema.js'
import {
  createRazorpayOrder,
  findRazorpayOrderByReceipt,
  findRazorpayOrderPayments,
  type RazorpayPayment,
} from './razorpay.js'

type PurchaseErrorCode =
  | 'already_owned'
  | 'course_not_found'
  | 'invalid_payment'
  | 'purchase_not_found'

export class PurchaseError extends Error {
  constructor(
    readonly code: PurchaseErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'PurchaseError'
  }
}

async function ensureRazorpayOrder(
  pendingPurchase: typeof purchase.$inferSelect,
) {
  if (pendingPurchase.razorpayOrderId) {
    return pendingPurchase
  }

  let providerOrder

  try {
    providerOrder = await createRazorpayOrder({
      amountPaise: pendingPurchase.amountPaise,
      currency: pendingPurchase.currency,
      receipt: pendingPurchase.receipt,
      purchaseId: pendingPurchase.id,
      courseId: pendingPurchase.courseId,
      userId: pendingPurchase.userId,
    })
  } catch (error: unknown) {
    // EDGE CASE: The order creation response can be lost after Razorpay has
    // accepted it. The unique receipt lets a retry recover that order.
    providerOrder = await findRazorpayOrderByReceipt(pendingPurchase.receipt)
    if (!providerOrder) {
      throw error
    }
  }

  if (
    providerOrder.amount !== pendingPurchase.amountPaise ||
    providerOrder.currency !== pendingPurchase.currency
  ) {
    throw new PurchaseError(
      'invalid_payment',
      'Razorpay order does not match the purchase',
    )
  }

  const [updatedPurchase] = await db
    .update(purchase)
    .set({ razorpayOrderId: providerOrder.id })
    .where(
      and(
        eq(purchase.id, pendingPurchase.id),
        isNull(purchase.razorpayOrderId),
      ),
    )
    .returning()

  if (updatedPurchase) {
    return updatedPurchase
  }

  const [currentPurchase] = await db
    .select()
    .from(purchase)
    .where(eq(purchase.id, pendingPurchase.id))
    .limit(1)

  if (!currentPurchase) {
    throw new PurchaseError('purchase_not_found', 'Purchase not found')
  }

  return currentPurchase
}

export async function createPurchaseOrder(userId: string, courseId: string) {
  const purchaseContext = await db.transaction(async (transaction) => {
    // NOTE: Payment finalization locks the same user row. This keeps an order
    // request from racing with access granted by a captured payment.
    await transaction
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .for('update')

    const [foundCourse] = await transaction
      .select({
        id: course.id,
        name: course.name,
        pricePaise: course.pricePaise,
        currency: course.currency,
      })
      .from(course)
      .where(and(eq(course.id, courseId), eq(course.status, 'published')))
      .limit(1)

    if (!foundCourse) {
      throw new PurchaseError('course_not_found', 'Course not found')
    }

    const [activeEntitlement] = await transaction
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

    if (activeEntitlement) {
      throw new PurchaseError(
        'already_owned',
        'You already have access to this course',
      )
    }

    if (foundCourse.pricePaise <= 0) {
      throw new PurchaseError(
        'invalid_payment',
        'This course does not have a payable price',
      )
    }

    const [existingPurchase] = await transaction
      .select()
      .from(purchase)
      .where(
        and(
          eq(purchase.userId, userId),
          eq(purchase.courseId, courseId),
          eq(purchase.status, 'pending'),
        ),
      )
      .limit(1)

    if (existingPurchase) {
      return { purchase: existingPurchase, courseName: foundCourse.name }
    }

    const purchaseId = randomUUID()
    const [createdPurchase] = await transaction
      .insert(purchase)
      .values({
        id: purchaseId,
        userId,
        courseId,
        amountPaise: foundCourse.pricePaise,
        currency: foundCourse.currency,
        receipt: purchaseId,
      })
      .returning()

    if (!createdPurchase) {
      throw new Error('Could not create a pending purchase')
    }

    return { purchase: createdPurchase, courseName: foundCourse.name }
  })

  const readyPurchase = await ensureRazorpayOrder(purchaseContext.purchase)

  if (!readyPurchase.razorpayOrderId) {
    throw new Error('Purchase is missing its Razorpay order id')
  }

  return {
    purchase: readyPurchase,
    courseName: purchaseContext.courseName,
  }
}

function paymentMatchesPurchase(
  payment: RazorpayPayment,
  foundPurchase: typeof purchase.$inferSelect,
) {
  return (
    payment.order_id === foundPurchase.razorpayOrderId &&
    payment.amount === foundPurchase.amountPaise &&
    payment.currency === foundPurchase.currency &&
    payment.status === 'captured' &&
    payment.captured
  )
}

export async function finalizePurchase(payment: RazorpayPayment) {
  const [purchaseIdentity] = await db
    .select({ id: purchase.id, userId: purchase.userId })
    .from(purchase)
    .where(eq(purchase.razorpayOrderId, payment.order_id))
    .limit(1)

  if (!purchaseIdentity) {
    throw new PurchaseError('purchase_not_found', 'Purchase not found')
  }

  return db.transaction(async (transaction) => {
    await transaction
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, purchaseIdentity.userId))
      .for('update')

    const [foundPurchase] = await transaction
      .select()
      .from(purchase)
      .where(eq(purchase.id, purchaseIdentity.id))
      .limit(1)
      .for('update')

    if (!foundPurchase) {
      throw new PurchaseError('purchase_not_found', 'Purchase not found')
    }

    if (!paymentMatchesPurchase(payment, foundPurchase)) {
      throw new PurchaseError(
        'invalid_payment',
        'Captured payment does not match the purchase',
      )
    }

    if (foundPurchase.status === 'paid') {
      if (foundPurchase.razorpayPaymentId !== payment.id) {
        throw new PurchaseError(
          'invalid_payment',
          'Purchase is already linked to another payment',
        )
      }
      return foundPurchase
    }

    const paidAt = new Date()
    const [paidPurchase] = await transaction
      .update(purchase)
      .set({
        status: 'paid',
        razorpayPaymentId: payment.id,
        paidAt,
      })
      .where(
        and(eq(purchase.id, foundPurchase.id), eq(purchase.status, 'pending')),
      )
      .returning()

    if (!paidPurchase) {
      throw new Error('Purchase changed while payment was being finalized')
    }

    await transaction
      .insert(entitlement)
      .values({
        userId: paidPurchase.userId,
        courseId: paidPurchase.courseId,
        purchaseId: paidPurchase.id,
        source: 'purchase',
      })
      .onConflictDoUpdate({
        target: [entitlement.userId, entitlement.courseId],
        set: {
          purchaseId: paidPurchase.id,
          source: 'purchase',
          revokedAt: null,
        },
      })

    return paidPurchase
  })
}

export async function findUserPurchase(purchaseId: string, userId: string) {
  const [foundPurchase] = await db
    .select()
    .from(purchase)
    .where(and(eq(purchase.id, purchaseId), eq(purchase.userId, userId)))
    .limit(1)

  return foundPurchase ?? null
}

export async function reconcilePurchase(purchaseId: string) {
  const [foundPurchase] = await db
    .select()
    .from(purchase)
    .where(eq(purchase.id, purchaseId))
    .limit(1)

  if (!foundPurchase) {
    throw new PurchaseError('purchase_not_found', 'Purchase not found')
  }

  if (foundPurchase.status === 'paid' || !foundPurchase.razorpayOrderId) {
    return foundPurchase
  }

  const payments = await findRazorpayOrderPayments(
    foundPurchase.razorpayOrderId,
  )
  const capturedPayment = payments.find((payment) =>
    paymentMatchesPurchase(payment, foundPurchase),
  )

  if (!capturedPayment) {
    return foundPurchase
  }

  return finalizePurchase(capturedPayment)
}
