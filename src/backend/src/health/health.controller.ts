import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, HealthIndicatorResult, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { MailService } from '../infrastructure/mail/mail.service';
import { StorageAdapter } from '../infrastructure/storage/storage.adapter';

@Public()
@SkipThrottle()
@ApiTags('Salud')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly storage: StorageAdapter,
    private readonly mail: MailService,
  ) {}

  /** Liveness + base de datos. */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }

  /** Readiness completo: base de datos, almacenamiento (MinIO) y SMTP. */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.probe('storage', () => this.storage.ping()),
      () => this.probe('smtp', () => this.mail.verify()),
    ]);
  }

  private async probe(key: string, fn: () => Promise<unknown>): Promise<HealthIndicatorResult> {
    try {
      await fn();
      return { [key]: { status: 'up' } };
    } catch (e) {
      const { HealthCheckError } = await import('@nestjs/terminus');
      throw new HealthCheckError(`${key} no disponible`, { [key]: { status: 'down', message: (e as Error).message } });
    }
  }
}