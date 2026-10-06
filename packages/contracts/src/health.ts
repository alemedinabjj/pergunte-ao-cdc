import { z } from 'zod';

const status = z.enum(['ok', 'down']);

export const healthSchema = z.object({ db: status, ollama: status });
export type Health = z.infer<typeof healthSchema>;
