import { Resend } from 'resend'

import { env } from './config/env.js'

const resend = new Resend(env.RESEND_API_KEY)

export async function sendEmail(options: {
  to: string
  subject: string
  text: string
}) {
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    ...options,
  })

  if (error) {
    throw new Error(`Resend could not send email: ${error.message}`)
  }
}
