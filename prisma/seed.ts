import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { seedCategories } from './seeds/categories'
import { seedAttributes } from './seeds/attributes'

const prisma = new PrismaClient({ log: ['warn', 'error'] })

async function main() {
  // Safety guard for prod runs (enable explicitly via SEED_OK=true)
  if (process.env.NODE_ENV === 'production' && process.env.SEED_OK !== 'true') {
    console.warn('SEED_OK!=true in production — skipping seed')
    return
  }

  console.log('Connecting to database…')
  await prisma.$connect()
  console.log('Connected.')

  console.time('seed:categories')
  await seedCategories(prisma)
  console.timeEnd('seed:categories')

  console.time('seed:attributes')
  await seedAttributes(prisma)
  console.timeEnd('seed:attributes')
}

main()
  .then(async () => {
    await prisma.$disconnect()
    console.log('Seeding complete ✅')
  })
  .catch(async (e) => {
    console.error('Seeding failed', e)
    try { await prisma.$disconnect() } catch { }
    process.exit(1)
  })

// graceful shutdown (useful when run locally)
process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
