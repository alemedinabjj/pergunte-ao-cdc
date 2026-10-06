/**
 * Ingestão das leis: parse → chunks → embeddings → Postgres.
 *
 *   pnpm ingest                 # todas as leis
 *   pnpm ingest --law cdc       # uma lei
 *   pnpm ingest --force         # reindexa tudo (ex.: depois de trocar o modelo de embedding)
 */
import 'dotenv/config';
import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { lawSlugSchema } from '@cdc/contracts';
import { NestFactory } from '@nestjs/core';
import { formatReport, IngestLawUseCase } from '../modules/ingestion/ingest-law.use-case';
import { IngestionModule } from '../modules/ingestion/ingestion.module';
import { LAWS_CATALOG } from '../modules/ingestion/laws.catalog';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { law: { type: 'string' }, force: { type: 'boolean', default: false } },
  });
  const slugs = values.law ? [lawSlugSchema.parse(values.law)] : LAWS_CATALOG.map((l) => l.slug);

  const app = await NestFactory.createApplicationContext(IngestionModule, {
    logger: ['error', 'warn'],
  });
  try {
    const useCase = app.get(IngestLawUseCase);
    for (const slug of slugs) {
      console.log(formatReport(await useCase.execute(slug, { force: values.force })));
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
