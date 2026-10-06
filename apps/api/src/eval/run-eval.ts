/**
 * Avalia só o retrieval (sem LLM): recall@k e MRR em três modos e a calibração do limiar
 * de "não sei". Precisa do provedor de embeddings configurado e das leis já ingeridas.
 *
 *   pnpm eval
 */
import 'dotenv/config';
import 'reflect-metadata';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { lawSlugSchema } from '@cdc/contracts';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { z } from 'zod';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { EMBEDDER, type Embedder } from '../modules/llm/domain/embedder.port';
import { LlmModule } from '../modules/llm/llm.module';
import { RetrieveUseCase } from '../modules/retrieval/application/retrieve.use-case';
import type { RetrievalMode, RetrievalResult } from '../modules/retrieval/domain/retrieval.types';
import { RetrievalModule } from '../modules/retrieval/retrieval.module';
import {
  type EvalCase,
  type Expected,
  recommendThreshold,
  refusalTable,
  reportHeader,
  summarize,
} from './metrics';

const ROOT = join(__dirname, '..', '..', '..', '..');
const DATASET = join(ROOT, 'eval', 'dataset.jsonl');
const OUTPUT = join(ROOT, 'eval', 'results', 'latest.md');
const MODES: RetrievalMode[] = ['semantic', 'keyword', 'hybrid'];
const THRESHOLDS = Array.from({ length: 11 }, (_, i) => Number((0.3 + i * 0.05).toFixed(2)));
const MAX_FALSE_REFUSAL_RATE = 0.05;

const caseSchema = z.object({
  question: z.string().min(3),
  expected: z.array(z.object({ law: lawSlugSchema, article: z.string() })),
  tags: z.array(z.enum(['coloquial', 'ref-exata', 'fora-do-escopo'])).min(1),
});

@Module({ imports: [ConfigModule, DatabaseModule, LlmModule, RetrievalModule] })
class EvalModule {}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const toExpected = (result: RetrievalResult): Expected[] =>
  result.chunks.map((chunk) => ({ law: chunk.lawSlug, article: chunk.article }));

async function loadDataset(): Promise<EvalCase[]> {
  const lines = (await readFile(DATASET, 'utf8')).split('\n').filter((line) => line.trim());
  return lines.map((line, index) => {
    const parsed = caseSchema.safeParse(JSON.parse(line));
    if (!parsed.success)
      throw new Error(`dataset.jsonl linha ${index + 1}: ${parsed.error.message}`);
    return parsed.data;
  });
}

async function main(): Promise<void> {
  const cases = await loadDataset();
  const inScope = cases.filter((c) => !c.tags.includes('fora-do-escopo'));
  const app = await NestFactory.createApplicationContext(EvalModule, { logger: ['error', 'warn'] });
  try {
    const retrieve = app.get(RetrieveUseCase);
    const embedder = app.get<Embedder>(EMBEDDER);

    const lines: string[] = [
      ...reportHeader({
        date: new Date().toISOString().slice(0, 10),
        embeddingModel: embedder.model,
        total: cases.length,
        inScope: inScope.length,
      }),
      '',
      '## Recall e MRR (perguntas dentro do escopo)',
      '',
      '| Modo | Recall@1 | Recall@3 | Recall@6 | MRR |',
      '|---|---|---|---|---|',
    ];

    const misses: string[] = [];
    for (const mode of MODES) {
      const rows = [];
      for (const c of inScope) {
        const result = await retrieve.execute({ text: c.question, mode });
        const retrieved = toExpected(result);
        rows.push({ retrieved, expected: c.expected });
        if (
          mode === 'hybrid' &&
          !retrieved.some((r) => c.expected.some((e) => e.law === r.law && e.article === r.article))
        ) {
          misses.push(
            `- "${c.question}" → esperado ${c.expected.map((e) => `${e.law} art. ${e.article}`).join(', ')}; veio ${retrieved
              .slice(0, 3)
              .map((r) => `${r.law} art. ${r.article}`)
              .join(', ')}`,
          );
        }
      }
      const s = summarize(rows);
      lines.push(
        `| ${mode} | ${pct(s.recall1)} | ${pct(s.recall3)} | ${pct(s.recall6)} | ${s.mrr.toFixed(3)} |`,
      );
    }

    const guardRows = [];
    for (const c of cases) {
      const result = await retrieve.execute({ text: c.question, mode: 'hybrid' });
      guardRows.push({
        topSimilarity: result.topSimilarity,
        exactMatch: result.exactMatch,
        outOfScope: c.tags.includes('fora-do-escopo'),
      });
    }
    const table = refusalTable(guardRows, THRESHOLDS);
    const recommended = recommendThreshold(table, inScope.length, MAX_FALSE_REFUSAL_RATE);
    const outOfScopeCount = cases.length - inScope.length;

    lines.push(
      '',
      '## Calibração do limiar de "não sei"',
      '',
      `Recusa quando não há artigo citado e a melhor similaridade fica abaixo do limiar. Orçamento de recusas indevidas: ${pct(MAX_FALSE_REFUSAL_RATE)} das perguntas válidas.`,
      '',
      '| Limiar | Recusas corretas | Recusas indevidas |',
      '|---|---|---|',
      ...table.map(
        (row) =>
          `| ${row.threshold.toFixed(2)} | ${row.correctRefusals}/${outOfScopeCount} | ${row.falseRefusals}/${inScope.length} |`,
      ),
      '',
      `**Limiar recomendado:** ${recommended === null ? 'nenhum dentro do orçamento' : recommended.toFixed(2)}`,
      '',
      '## Perguntas que o modo híbrido errou (top 6)',
      '',
      ...(misses.length > 0 ? misses : ['Nenhuma.']),
      '',
    );

    await writeFile(OUTPUT, lines.join('\n'), 'utf8');
    console.log(lines.join('\n'));
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
