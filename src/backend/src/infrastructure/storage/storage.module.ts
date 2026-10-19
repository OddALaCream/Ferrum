import { Global, Module } from '@nestjs/common';
import { S3StorageAdapter } from './s3-storage.adapter';
import { StorageAdapter } from './storage.adapter';

@Global()
@Module({
  providers: [{ provide: StorageAdapter, useClass: S3StorageAdapter }],
  exports: [StorageAdapter],
})
export class StorageModule {}
