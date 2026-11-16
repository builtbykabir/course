import { toNodeHandler } from 'better-auth/node'
import cors from 'cors'
import express from 'express'
import morgan from 'morgan'

import { auth } from './auth.js'
import { env } from './config/env.js'
import { adminRouter } from './routes/admin.js'
import { coursesRouter } from './routes/courses.js'
import { meRouter } from './routes/me.js'
import { paymentsRouter } from './routes/payments.js'
import { razorpayWebhookHandler } from './routes/razorpay-webhook.js'
import { videosRouter } from './routes/videos.js'

export const app = express()

app.disable('x-powered-by')
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }))
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// Better Auth must receive the request before body-parsing middleware.
app.all('/api/auth/*splat', toNodeHandler(auth))
app.post(
  '/api/webhooks/razorpay',
  express.raw({ type: 'application/json', limit: '1mb' }),
  razorpayWebhookHandler,
)

app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.use('/api/courses', coursesRouter)
app.use('/api/me', meRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/videos', videosRouter)
app.use('/api/admin', adminRouter)

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' })
})

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof Error && 'code' in error) {
      if (error.code === '23505') {
        response
          .status(409)
          .json({ error: 'A record with that value already exists' })
        return
      }

      if (error.code === '23503') {
        response.status(409).json({ error: 'This record is still in use' })
        return
      }
    }

    console.error(error)
    response.status(500).json({ error: 'Internal server error' })
  },
)
