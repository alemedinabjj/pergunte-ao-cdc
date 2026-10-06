import { type Health, healthSchema } from '@cdc/contracts';
import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Pool } from 'pg';
import { PG_POOL } from '../../../database/database.module';
import { OllamaHealth } from '../../llm/infrastructure/ollama.health';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(OllamaHealth) private readonly ollama: Pick<OllamaHealth, 'ping'>,
  ) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<Health> {
    const [db, ollama] = await Promise.all([
      this.pool
        .query('select 1')
        .then(() => 'ok' as const)
        .catch(() => 'down' as const),
      this.ollama.ping().then((up) => (up ? ('ok' as const) : ('down' as const))),
    ]);
    const health = healthSchema.parse({ db, ollama });
    if (db === 'down' || ollama === 'down') res.status(503);
    return health;
  }
}
