import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../config/database.config';

loadEnv({ path: resolve(__dirname, '../../../../.env') });

/** Carga datos de demostración (solo desarrollo). Idempotente. */
async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed:dev está deshabilitado en producción.');
  }
  const ds = new DataSource(buildDataSourceOptions(process.env));
  await ds.initialize();
  try {
    const sql = readFileSync(resolve(__dirname, '../../../../database/02_seed_dev.sql'), 'utf8');
    await ds.query(sql);
    console.log('Datos de desarrollo cargados. Usuarios: director@serfamilia.test, tecnico@serfamilia.test, financiador@serfamilia.test');
  } finally {
    await ds.destroy();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
