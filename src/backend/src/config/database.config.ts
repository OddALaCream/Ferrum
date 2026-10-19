import { DataSourceOptions } from 'typeorm';

/**
 * Opciones de conexión compartidas por la app (Nest) y por la CLI de TypeORM.
 * ADR-002: synchronize SIEMPRE desactivado; el esquema cambia solo con migraciones.
 */
export function buildDataSourceOptions(env: NodeJS.ProcessEnv): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 5432),
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: ['true', '1'].includes(String(env.DB_SSL).toLowerCase()) ? { rejectUnauthorized: false } : false,
    synchronize: false,
    migrationsRun: false,
    migrationsTableName: 'typeorm_migrations',
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    entities: [__dirname + '/../modules/**/entities/*.entity{.ts,.js}'],
  };
}
