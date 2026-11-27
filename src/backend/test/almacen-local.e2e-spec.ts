import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { LocalStorageAdapter } from '../src/infrastructure/storage/local-storage.adapter';
import { StorageAdapter } from '../src/infrastructure/storage/storage.adapter';

/** STORAGE_DRIVER=local: las evidencias se guardan en una carpeta y se descargan con enlace firmado. */
describe('Almacenamiento local (e2e)', () => {
  let app: INestApplication;
  let almacen: StorageAdapter;
  const dir = mkdtempSync(join(tmpdir(), 'sgp-e2e-almacen-'));

  beforeAll(async () => {
    // Una carpeta temporal propia, para no tocar la del proyecto
    const config = { get: (k: string, d?: string) => (k === 'STORAGE_DIR' ? dir : d), getOrThrow: () => 'x'.repeat(40) } as unknown as ConfigService;
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(StorageAdapter)
      .useValue(new LocalStorageAdapter(config))
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
    almacen = app.get(StorageAdapter);
  });

  afterAll(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('el enlace firmado descarga el archivo sin sesión, con su tipo', async () => {
    await almacen.upload('avances/demo/acta.pdf', Buffer.from('%PDF-1.7 contenido'), 'application/pdf');
    const url = await almacen.presignedDownloadUrl('avances/demo/acta.pdf');

    const r = await request(app.getHttpServer()).get(url).expect(200);
    expect(r.headers['content-type']).toBe('application/pdf');
    expect(r.headers['cache-control']).toBe('private, no-store');
    expect(Buffer.from(r.body as Buffer).toString()).toBe('%PDF-1.7 contenido');
  });

  it('sin firma, con firma alterada o vencida responde 404', async () => {
    await request(app.getHttpServer()).get('/api/almacen/archivo?k=avances/demo/acta.pdf').expect(404);
    const url = await almacen.presignedDownloadUrl('avances/demo/acta.pdf');
    await request(app.getHttpServer()).get(url.replace(/sig=./, 'sig=A')).expect(404);
    const vencida = await almacen.presignedDownloadUrl('avances/demo/acta.pdf', -5);
    const r = await request(app.getHttpServer()).get(vencida).expect(404);
    expect(r.body.detail).toContain('ya venció');
  });

  it('no deja leer archivos fuera de la carpeta', async () => {
    await request(app.getHttpServer()).get('/api/almacen/archivo?k=../../.env&exp=9999999999&sig=x').expect(404);
  });

  it('el chequeo del almacenamiento (el que usa /health/ready) pasa sin MinIO', async () => {
    await expect(almacen.ping()).resolves.toBeUndefined();
  });
});