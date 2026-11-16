type CheckoutSuccess = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

type CheckoutOptions = {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description: string
  prefill: {
    name: string
    email: string
  }
  handler: (result: CheckoutSuccess) => void
  modal: {
    ondismiss: () => void
  }
  theme: {
    color: string
  }
}

type CheckoutInstance = {
  open: () => void
}

type CheckoutConstructor = new (options: CheckoutOptions) => CheckoutInstance

declare global {
  interface Window {
    Razorpay?: CheckoutConstructor
  }
}

let scriptPromise: Promise<void> | null = null

function loadCheckoutScript() {
  if (window.Razorpay) {
    return Promise.resolve()
  }

  if (scriptPromise) {
    return scriptPromise
  }

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout'))
    document.head.append(script)
  })

  return scriptPromise
}

export async function openRazorpayCheckout(input: {
  keyId: string
  orderId: string
  amount: number
  currency: string
  name: string
  description: string
  prefill: { name: string; email: string }
}) {
  await loadCheckoutScript()

  const Checkout = window.Razorpay
  if (!Checkout) {
    throw new Error('Razorpay Checkout is unavailable')
  }

  return new Promise<CheckoutSuccess>((resolve, reject) => {
    const checkout = new Checkout({
      key: input.keyId,
      order_id: input.orderId,
      amount: input.amount,
      currency: input.currency,
      name: input.name,
      description: input.description,
      prefill: input.prefill,
      handler: resolve,
      modal: {
        ondismiss: () => reject(new Error('Checkout was closed')),
      },
      theme: { color: '#5f174f' },
    })

    checkout.open()
  })
}
