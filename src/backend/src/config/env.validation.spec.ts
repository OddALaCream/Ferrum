import { validateEnv } from './env.validation';

const base = {
  DB_USER: 'sgp',
  DB_PASSWORD: 'x',
  DB_NAME: 'sgp',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'k',
  S3_SECRET_KEY: 's',
  S3_BUCKET: 'evidencias',
  SMTP_HOST: 'localhost',
};

describe('validateEnv', () => {
  it('acepta una configuración completa y aplica valores por defecto', () => {
    const env = validateEnv({ ...base });
    expect(env.API_PORT).toBe(3000);
    expect(env.DB_PORT).toBe(5432);
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
  });

  it('convierte tipos numéricos y booleanos desde texto', () => {
    const env = validateEnv({ ...base, API_PORT: '4000', DB_SSL: 'true', SMTP_SECURE: 'false' });
    expect(env.API_PORT).toBe(4000);
    expect(env.DB_SSL).toBe(true);
    expect(env.SMTP_SECURE).toBe(false);
  });

  it('rechaza secretos JWT cortos', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'corto' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('informa las variables faltantes', () => {
    expect(() => validateEnv({})).toThrow(/DB_USER/);
  });
});
