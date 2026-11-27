import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlmacenController } from './almacen.controller';
import { LocalStorageAdapter } from './local-storage.adapter';
import { S3StorageAdapter } from './s3-storage.adapter';
import { StorageAdapter } from './storage.adapter';

/**
 * Almacenamiento de evidencias (ADR-003). STORAGE_DRIVER elige dónde se guardan:
 * - local (por defecto): una carpeta del servidor; no hay que instalar nada.
 * - s3: MinIO o cualquier servicio compatible con S3.
 */
@Global()
@Module({
  controllers: [AlmacenController],
  providers: [
    {
      provide: StorageAdapter,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('STORAGE_DRIVER', 'local') === 's3' ? new S3StorageAdapter(config) : new LocalStorageAdapter(config),
    },
  ],
  exports: [StorageAdapter],
})
export class StorageModule {}