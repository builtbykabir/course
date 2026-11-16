import type { RequestHandler } from 'express'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../db/index.js'
import { paymentEvent } from '../db/schema.js'
import {
  safeParseRazorpayPayment,
  verifyWebhookSignature,
} from '../payments/razorpay.js'
import { finalizePurchase, PurchaseError } from '../payments/service.js'

const webhookSchema = z.object({
  event: z.string().min(1),
  payload: z
    .object({
      payment: z.object({ entity: z.unknown() }).optional(),
    })
    .passthrough(),
})

const eventPaymentSchema = z.object({
  id: z.string().min(1),
  order_id: z.string().min(1).nullable().optional(),
})

export const razorpayWebhookHandler: RequestHandler = async (
  request,
  response,
) => {
  if (!Buffer.isBuffer(request.body)) {
    response.status(415).json({ error: 'Expected a raw JSON body' })
    return
  }

  const signature = request.get('X-Razorpay-Signature')
  const eventId = request.get('x-razorpay-event-id')

  if (!signature || !eventId) {
    response.status(400).json({ error: 'Missing Razorpay webhook headers' })
    return
  }

  if (!verifyWebhookSignature(request.body, signature)) {
    response.status(400).json({ error: 'Invalid webhook signature' })
    return
  }

  let body: unknown
  try {
    body = JSON.parse(request.body.toString('utf8'))
  } catch {
    response.status(400).json({ error: 'Invalid webhook JSON' })
    return
  }

  const parsedBody = webhookSchema.safeParse(body)
  if (!parsedBody.success) {
    response.status(400).json({ error: 'Invalid webhook payload' })
    return
  }

  const paymentValue = parsedBody.data.payload.payment?.entity
  const eventPayment = eventPaymentSchema.safeParse(paymentValue)

  await db
    .insert(paymentEvent)
    .values({
      eventId,
      type: parsedBody.data.event,
      razorpayOrderId: eventPayment.success
        ? eventPayment.data.order_id
        : undefined,
      razorpayPaymentId: eventPayment.success
        ? eventPayment.data.id
        : undefined,
    })
    .onConflictDoNothing()

  const [storedEvent] = await db
    .select()
    .from(paymentEvent)
    .where(eq(paymentEvent.eventId, eventId))
    .limit(1)

  if (storedEvent?.processedAt) {
    response.status(204).send()
    return
  }

  if (
    parsedBody.data.event === 'order.paid' ||
    parsedBody.data.event === 'payment.captured'
  ) {
    const parsedPayment = safeParseRazorpayPayment(paymentValue)

    if (!parsedPayment.success) {
      response.status(400).json({ error: 'Webhook is missing its payment' })
      return
    }

    try {
      await finalizePurchase(parsedPayment.data)
    } catch (error: unknown) {
      if (
        error instanceof PurchaseError &&
        error.code === 'purchase_not_found'
      ) {
        // NOTE: A Razorpay account can send events for another application.
        // Unknown orders are acknowledged without changing local state.
      } else {
        throw error
      }
    }
  }

  await db
    .update(paymentEvent)
    .set({ processedAt: new Date() })
    .where(eq(paymentEvent.eventId, eventId))

  response.status(204).send()
}
