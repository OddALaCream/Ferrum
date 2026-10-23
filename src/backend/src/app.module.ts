import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions } from './config/database.config';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { MailModule } from './infrastructure/mail/mail.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProyectosModule } from './modules/proyectos/proyectos.module';

@Module({
  imports: [
    // El .env vive en la raíz del repositorio; src/backend/.env tiene prioridad si existe.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'], validate: validateEnv }),
    // RNF-04: límite de tasa global (se endurecerá en /auth/login)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...buildDataSourceOptions({
          DB_HOST: config.get('DB_HOST'),
          DB_PORT: String(config.get('DB_PORT')),
          DB_USER: config.get('DB_USER'),
          DB_PASSWORD: config.get('DB_PASSWORD'),
          DB_NAME: config.get('DB_NAME'),
          DB_SSL: String(config.get('DB_SSL')),
        }),
        autoLoadEntities: true,
      }),
    }),
    StorageModule,
    MailModule,
    HealthModule,
    AuditoriaModule,
    AuthModule,
    ProyectosModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}