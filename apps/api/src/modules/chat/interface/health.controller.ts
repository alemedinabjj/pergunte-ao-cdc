import { type Health, healthSchema } from '@cdc/contracts';
import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Pool } from 'pg';
import { PG_POOL } from '../../../database/database.module';
import { LLM_HEALTH, type LlmHealth } from '../../llm/domain/llm-health.port';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(LLM_HEALTH) private readonly llm: LlmHealth,
  ) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<Health> {
    const [db, llm] = await Promise.all([
      this.pool
        .query('select 1')
        .then(() => 'ok' as const)
        .catch(() => 'down' as const),
      this.llm.ping().then((up) => (up ? ('ok' as const) : ('down' as const))),
    ]);
    const health = healthSchema.parse({ db, llm });
    if (db === 'down' || llm === 'down') res.status(503);
    return health;
  }
}
