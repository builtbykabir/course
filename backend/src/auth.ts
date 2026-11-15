import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth/minimal'

import { env } from './config/env.js'
import { db } from './db/index.js'
import * as schema from './db/schema.js'
import { sendEmail } from './email.js'

export const auth = betterAuth({
  appName: 'Course Website',
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.FRONTEND_URL],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
    transaction: true,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // Do not make auth response timing depend on the email provider.
      void sendEmail({
        to: user.email,
        subject: 'Reset your password',
        text: `Reset your password: ${url}`,
      }).catch((error: unknown) =>
        console.error('Password reset email failed', error),
      )
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Do not make auth response timing depend on the email provider.
      void sendEmail({
        to: user.email,
        subject: 'Verify your email address',
        text: `Verify your email address: ${url}`,
      }).catch((error: unknown) =>
        console.error('Verification email failed', error),
      )
    },
  },
})
