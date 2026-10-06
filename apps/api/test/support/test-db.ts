import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { createDb, type Db } from '../../src/database/database.module';
import { runMigrations } from '../../src/database/migrate';

export interface TestDatabase {
  db: Db;
  pool: Pool;
  url: string;
  stop(): Promise<void>;
}

export const TEST_PG_IMAGE = 'pgvector/pgvector:0.8.1-pg17';

export async function startTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer(TEST_PG_IMAGE).start();
  const url = container.getConnectionUri();
  await runMigrations(url);
  const pool = new Pool({ connectionString: url });
  return {
    db: createDb(pool),
    pool,
    url,
    async stop() {
      await pool.end();
      await container.stop();
    },
  };
}
