import { readFileSync, readdirSync } from 'node:fs';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';

/**
 * SGP-110 (CP-33): recuperación de contraseña por correo, de punta a punta.
 * Requiere la BD con migraciones y database/03_usuarios_demo.sql, y un SMTP que guarde los correos
 * como JSON en la carpeta indicada por MAIL_SINK_DIR (en desarrollo se puede usar Mailpit sin esta prueba).
 * Si MAIL_SINK_DIR no está definida, la prueba se omite.
 */
const CARPETA = process.env.MAIL_SINK_DIR;
const describeSiHayCorreo = CARPETA ? describe : describe.skip;
const EMAIL = 'supervisor@serfamilia.test';
const CLAVE_ORIGINAL = 'Serfamilia2026';
const CLAVE_NUEVA = 'Recuperada-2026';

describeSiHayCorreo('Recuperación de contraseña (e2e, RF-33)', () => {
  let app: INestApplication;
  let ds: DataSource;

  const numero = (archivo: string) => Number(/mail_(\d+)/.exec(archivo)?.[1] ?? 0);
  const esperarCorreo = async (cantidadPrevia: number): Promise<{ to: string; text: string }> => {
    for (let i = 0; i < 40; i++) {
      const archivos = readdirSync(CARPETA!).filter((f) => f.startsWith('mail_')).sort((a, b) => numero(a) - numero(b));
      if (archivos.length > cantidadPrevia) return JSON.parse(readFileSync(`${CARPETA}/${archivos[archivos.length - 1]}`, 'utf8'));
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('No llegó el correo');
  };
  const cantidadCorreos = () => readdirSync(CARPETA!).filter((f) => f.startsWith('mail_')).length;
  const tokenDe = (texto: string) => /restablecer\?token=([\w-]+)/.exec(texto)![1];

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ProblemDetailsFilter());
    // Cada petición simula una IP distinta para no chocar con el límite de 5 solicitudes por minuto
    (app.getHttpAdapter().getInstance() as { set: (k: string, v: unknown) => void }).set('trust proxy', true);
    await app.init();
    ds = app.get(DataSource);
  });

  afterAll(async () => {
    // Deja la cuenta de demostración como estaba
    const { hash } = (await ds.query(`SELECT crypt($1, gen_salt('bf', 12)) AS hash`, [CLAVE_ORIGINAL]))[0];
    await ds.query(`UPDATE usuarios SET password_hash = $1 WHERE email = $2`, [hash, EMAIL]);
    await app.close();
  });

  let ipSimulada = 10;
  const pedirEnlace = (email: string) =>
    request(app.getHttpServer())
      .post('/api/auth/olvide-mi-contrasena')
      .set('X-Forwarded-For', `10.9.0.${ipSimulada++}`)
      .send({ email });

  it('un correo que no existe responde 404 con mensaje claro; solo se envía correo a una cuenta real', async () => {
    const previos = cantidadCorreos();
    await pedirEnlace(EMAIL).expect(202);
    const falso = await pedirEnlace('nadie@serfamilia.test').expect(404);
    expect(falso.body.detail).toContain('No encontramos una cuenta activa');

    const correo = await esperarCorreo(previos);
    expect(correo.to).toContain(EMAIL);
    await new Promise((r) => setTimeout(r, 400));
    expect(cantidadCorreos()).toBe(previos + 1);
  });

  it('CP-33: el enlace sirve una vez, cierra las sesiones y la contraseña vieja deja de funcionar', async () => {
    const server = app.getHttpServer();
    const sesion = await request(server).post('/api/auth/login').send({ email: EMAIL, password: CLAVE_ORIGINAL }).expect(200);
    const cookie = (sesion.headers['set-cookie'] as unknown as string[])[0];

    const previos = cantidadCorreos();
    await pedirEnlace(EMAIL).expect(202);
    const token = tokenDe((await esperarCorreo(previos)).text);

    await request(server).post('/api/auth/restablecer-password').send({ token, password: CLAVE_NUEVA }).expect(204);

    // Usarlo otra vez se rechaza
    const reuso = await request(server).post('/api/auth/restablecer-password').send({ token, password: 'Otra-clave-99' }).expect(400);
    expect(reuso.body.detail).toContain('no es válido o ya venció');

    await request(server).post('/api/auth/login').send({ email: EMAIL, password: CLAVE_ORIGINAL }).expect(401);
    await request(server).post('/api/auth/login').send({ email: EMAIL, password: CLAVE_NUEVA }).expect(200);
    // La sesión abierta antes del cambio ya no se puede renovar
    await request(server).post('/api/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('CP-33: un enlace vencido (más de 30 min) se rechaza', async () => {
    const previos = cantidadCorreos();
    await pedirEnlace(EMAIL).expect(202);
    const token = tokenDe((await esperarCorreo(previos)).text);

    await ds.query(
      `UPDATE password_reset_tokens SET expira_at = now() - interval '1 minute'
        WHERE usuario_id = (SELECT id FROM usuarios WHERE email = $1) AND usado_at IS NULL`,
      [EMAIL],
    );
    await request(app.getHttpServer())
      .post('/api/auth/restablecer-password')
      .send({ token, password: 'Otra-clave-99' })
      .expect(400);
  });

  it('un enlace nuevo invalida el anterior', async () => {
    const previos = cantidadCorreos();
    await pedirEnlace(EMAIL).expect(202);
    const primero = tokenDe((await esperarCorreo(previos)).text);
    await pedirEnlace(EMAIL).expect(202);
    const segundo = tokenDe((await esperarCorreo(previos + 1)).text);

    const server = app.getHttpServer();
    await request(server).post('/api/auth/restablecer-password').send({ token: primero, password: 'Otra-clave-99' }).expect(400);
    await request(server).post('/api/auth/restablecer-password').send({ token: segundo, password: CLAVE_NUEVA }).expect(204);
  });

  it('el límite de solicitudes por IP responde 429 tras 5 intentos seguidos', async () => {
    const server = app.getHttpServer();
    const ip = '10.8.0.1';
    for (let i = 0; i < 5; i++) {
      await request(server).post('/api/auth/olvide-mi-contrasena').set('X-Forwarded-For', ip).send({ email: 'nadie@serfamilia.test' }).expect(404);
    }
    await request(server).post('/api/auth/olvide-mi-contrasena').set('X-Forwarded-For', ip).send({ email: 'nadie@serfamilia.test' }).expect(429);
  });

  it('rechaza una contraseña de menos de 8 caracteres sin consumir el enlace', async () => {
    const previos = cantidadCorreos();
    await pedirEnlace(EMAIL).expect(202);
    const token = tokenDe((await esperarCorreo(previos)).text);
    const server = app.getHttpServer();
    await request(server).post('/api/auth/restablecer-password').send({ token, password: 'corta' }).expect(400);
    await request(server).post('/api/auth/restablecer-password').send({ token, password: CLAVE_NUEVA }).expect(204);
  });
});