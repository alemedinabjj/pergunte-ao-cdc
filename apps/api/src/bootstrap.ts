import type { INestApplication } from '@nestjs/common';

/** Configuração compartilhada entre main.ts e os testes de integração. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
}
