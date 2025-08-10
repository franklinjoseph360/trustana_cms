import { Controller, Get, HttpCode, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(200)
  check() {
    return { ok: true, ts: new Date().toISOString() }
  }

  @Get('db_check')
  @HttpCode(200)
  async dbCheck() {
    const t0 = Date.now()
    try {
      // race with a short timeout so this endpoint stays snappy
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
      ])
      return { db: 'up', latencyMs: Date.now() - t0 }
    } catch (e: any) {
      return { db: 'down', error: e?.code ?? e?.message ?? 'unknown', latencyMs: Date.now() - t0 }
    }
  }
}
