import { z } from 'zod';

const status = z.enum(['ok', 'down']);

export const healthSchema = z.object({ db: status, llm: status });
export type Health = z.infer<typeof healthSchema>;
