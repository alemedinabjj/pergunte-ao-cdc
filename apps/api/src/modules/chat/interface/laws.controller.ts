import { type Law, lawSchema } from '@cdc/contracts';
import { Controller, Get, Inject } from '@nestjs/common';
import { asc } from 'drizzle-orm';
import { z } from 'zod';
import { DB, type Db } from '../../../database/database.module';
import { laws } from '../../../database/schema';

@Controller('laws')
export class LawsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async list(): Promise<Law[]> {
    const rows = await this.db.select().from(laws).orderBy(asc(laws.id));
    return z.array(lawSchema).parse(rows);
  }
}
