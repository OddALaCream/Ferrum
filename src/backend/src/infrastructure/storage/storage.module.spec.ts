import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { LocalStorageAdapter } from './local-storage.adapter';
import { S3StorageAdapter } from './s3-storage.adapter';
import { StorageAdapter } from './storage.adapter';
import { StorageModule } from './storage.module';

describe('StorageModule: STORAGE_DRIVER elige dónde se guardan las evidencias', () => {
  const montar = async (valores: Record<string, string>) => {
    const config = { get: (k: string, d?: unknown) => valores[k] ?? d, getOrThrow: (k: string) => valores[k] ?? 'x'.repeat(40) };
    const mod = await Test.createTestingModule({ imports: [StorageModule] })
      .useMocker((token) => (token === ConfigService ? config : undefined))
      .overrideProvider(ConfigService)
      .useValue(config)
      .compile();
    return mod.get(StorageAdapter);
  };

  it('sin configurar nada usa la carpeta local', async () => {
    expect(await montar({})).toBeInstanceOf(LocalStorageAdapter);
  });

  it('con STORAGE_DRIVER=s3 usa MinIO o S3', async () => {
    const s3 = { STORAGE_DRIVER: 's3', S3_ENDPOINT: 'http://localhost:9000', S3_ACCESS_KEY: 'k', S3_SECRET_KEY: 's', S3_BUCKET: 'evidencias' };
    expect(await montar(s3)).toBeInstanceOf(S3StorageAdapter);
  });
});