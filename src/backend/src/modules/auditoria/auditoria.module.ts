import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { AuditSubscriber } from './audit.subscriber';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';
import { ContextoAuditoria } from './contexto-auditoria';
import { AuditLog } from './entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditoriaController],
  providers: [
    ContextoAuditoria,
    AuditoriaService,
    AuditSubscriber,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
