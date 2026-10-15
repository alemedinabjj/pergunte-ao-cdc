import type { NestExpressApplication } from '@nestjs/platform-express';

/** Configuração compartilhada entre main.ts e os testes de integração. */
export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  // Na Vercel toda requisição chega pelo proxy: sem isso o rate limit veria um IP só para todos.
  if (process.env.VERCEL) app.set('trust proxy', true);
}
