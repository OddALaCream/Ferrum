import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
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
    for (const archivo of ['02_seed_dev.sql', '03_usuarios_demo.sql', '04_datos_demo.sql']) {
      const ruta = resolve(__dirname, '../../../../database', archivo);
      if (existsSync(ruta)) await ds.query(readFileSync(ruta, 'utf8'));
    }
    console.log(
      'Datos de desarrollo cargados. Usuarios (contraseña Serfamilia2026): ' +
        'admin@serfamilia.test, supervisor@serfamilia.test, tecnico@serfamilia.test',
    );
  } finally {
    await ds.destroy();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});