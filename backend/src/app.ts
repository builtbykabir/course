import { toNodeHandler } from 'better-auth/node'
import cors from 'cors'
import express from 'express'
import morgan from 'morgan'

import { auth } from './auth.js'
import { env } from './config/env.js'

export const app = express()

app.disable('x-powered-by')
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }))
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// Better Auth must receive the request before body-parsing middleware.
app.all('/api/auth/*splat', toNodeHandler(auth))

app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' })
})
