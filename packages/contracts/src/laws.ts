import { z } from 'zod';

export const lawSlugSchema = z.enum(['cdc', 'decreto-7962', 'decreto-11034']);
export type LawSlug = z.infer<typeof lawSlugSchema>;

export const lawSchema = z.object({
  slug: lawSlugSchema,
  title: z.string(),
  shortName: z.string(),
  reference: z.string(),
  sourceUrl: z.url(),
});
export type Law = z.infer<typeof lawSchema>;
