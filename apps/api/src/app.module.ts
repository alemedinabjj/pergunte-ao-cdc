import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from './config/config.module';
import { ENV, type Env } from './config/env';
import { DatabaseModule } from './database/database.module';
import { ChatModule } from './modules/chat/chat.module';
import { LlmModule } from './modules/llm/llm.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    LlmModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 20 }]),
    ChatModule,
    LoggerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        pinoHttp: {
          level: env.LOG_LEVEL,
          transport:
            env.NODE_ENV === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          // Nunca logar corpo de request: as perguntas dos usuários ficam fora dos logs.
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          serializers: {
            req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
          },
        },
      }),
    }),
  ],
})
export class AppModule {}
