import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../config/database.config';

// Permite ejecutar la CLI desde src/backend/ usando el .env de la raíz del repositorio.
loadEnv({ path: resolve(__dirname, '../../../../.env') });

/** DataSource usado únicamente por la CLI de TypeORM (migration:run, migration:revert...). */
export default new DataSource(buildDataSourceOptions(process.env));
