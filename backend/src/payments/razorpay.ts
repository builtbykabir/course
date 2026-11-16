import { createHmac, timingSafeEqual } from 'node:crypto'

import Razorpay from 'razorpay'
import { z } from 'zod'

import { env } from '../config/env.js'

const orderSchema = z.object({
  id: z.string().min(1),
  amount: z.coerce.number().int().positive(),
  currency: z.string().length(3),
  receipt: z.string().nullable().optional(),
  status: z.enum(['created', 'attempted', 'paid']),
})

const paymentSchema = z.object({
  id: z.string().min(1),
  order_id: z.string().min(1),
  amount: z.coerce.number().int().positive(),
  currency: z.string().length(3),
  status: z.enum(['created', 'authorized', 'captured', 'refunded', 'failed']),
  captured: z.boolean(),
})

export type RazorpayPayment = z.infer<typeof paymentSchema>

export function safeParseRazorpayPayment(value: unknown) {
  return paymentSchema.safeParse(value)
}

const client = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
})

export async function createRazorpayOrder(input: {
  amountPaise: number
  currency: string
  receipt: string
  purchaseId: string
  courseId: string
  userId: string
}) {
  const order = await client.orders.create({
    amount: input.amountPaise,
    currency: input.currency,
    receipt: input.receipt,
    partial_payment: false,
    notes: {
      purchaseId: input.purchaseId,
      courseId: input.courseId,
      userId: input.userId,
    },
  })

  return orderSchema.parse(order)
}

export async function findRazorpayOrderByReceipt(receipt: string) {
  const result = await client.orders.all({ receipt, count: 2 })
  const orders = z.array(orderSchema).parse(result.items)
  return orders.find((order) => order.receipt === receipt) ?? null
}

export async function findRazorpayPayment(paymentId: string) {
  const payment = await client.payments.fetch(paymentId)
  return paymentSchema.parse(payment)
}

export async function findRazorpayOrderPayments(orderId: string) {
  const result = await client.orders.fetchPayments(orderId)
  return z.array(paymentSchema).parse(result.items)
}

function matchesHexSignature(message: string | Buffer, signature: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return false
  }

  const expected = createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(message)
    .digest()
  const received = Buffer.from(signature, 'hex')

  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  )
}

export function verifyCheckoutSignature(input: {
  orderId: string
  paymentId: string
  signature: string
}) {
  return matchesHexSignature(
    `${input.orderId}|${input.paymentId}`,
    input.signature,
  )
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return false
  }

  const expected = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest()
  const received = Buffer.from(signature, 'hex')

  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  )
}
