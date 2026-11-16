import { eq } from 'drizzle-orm'

import { db, pool } from '../db/index.js'
import { user } from '../db/schema.js'

async function promoteAdmin() {
  const email = process.argv[2]?.trim().toLowerCase()

  if (!email) {
    throw new Error('Usage: npm run admin:promote -- person@example.com')
  }

  const [updatedUser] = await db
    .update(user)
    .set({ role: 'admin' })
    .where(eq(user.email, email))
    .returning({ email: user.email, id: user.id })

  if (!updatedUser) {
    throw new Error(`No user exists with email ${email}`)
  }

  console.log(`Promoted ${updatedUser.email} (${updatedUser.id}) to admin`)
}

promoteAdmin()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
