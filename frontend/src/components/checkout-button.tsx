import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import type { Course } from '../lib/api'
import { createPaymentOrder, getPurchase, verifyPayment } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { openRazorpayCheckout } from '../lib/razorpay-checkout'

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

export function CheckoutButton({ course }: { course: Course }) {
  const { data: session, isPending } = authClient.useSession()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (isPending) {
    return (
      <button className="button" type="button" disabled>
        Checking account…
      </button>
    )
  }

  if (!session) {
    return (
      <Link
        className="button"
        to="/login"
        state={{ from: `/courses/${course.slug}` }}
      >
        Sign in to purchase
      </Link>
    )
  }

  async function purchaseCourse() {
    setBusy(true)
    setError('')
    setMessage('Preparing secure checkout…')

    try {
      const order = await createPaymentOrder(course.id)
      const result = await openRazorpayCheckout(order.checkout)
      setMessage('Confirming your payment…')

      const verification = await verifyPayment({
        purchaseId: order.purchase.id,
        razorpayOrderId: result.razorpay_order_id,
        razorpayPaymentId: result.razorpay_payment_id,
        razorpaySignature: result.razorpay_signature,
      })

      if (verification.purchase.status === 'paid') {
        navigate(`/courses/${course.slug}/content`)
        return
      }

      for (let attempt = 0; attempt < 10; attempt += 1) {
        await wait(1_500)
        const current = await getPurchase(order.purchase.id)
        if (current.purchase.status === 'paid') {
          navigate(`/courses/${course.slug}/content`)
          return
        }
      }

      setMessage(
        'Payment is still being confirmed. Your course will appear in My learning when capture completes.',
      )
    } catch (purchaseError: unknown) {
      setMessage('')
      setError(
        purchaseError instanceof Error
          ? purchaseError.message
          : 'Could not complete checkout',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="checkout-action">
      <button
        className="button"
        type="button"
        disabled={busy}
        onClick={() => void purchaseCourse()}
      >
        {busy ? 'Processing…' : 'Buy course'}
      </button>
      {message ? <small className="checkout-message">{message}</small> : null}
      {error ? <small className="checkout-error">{error}</small> : null}
    </div>
  )
}
