import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración 0001: crea el esquema completo del SGP.
 * La fuente de verdad del DDL es /database/01_schema.sql (PostgreSQL 16).
 * TypeORM ya ejecuta cada migración dentro de una transacción, por lo que se
 * quitan los BEGIN/COMMIT del archivo para no anidar transacciones.
 */
export class EsquemaInicial1760000000000 implements MigrationInterface {
  name = 'EsquemaInicial1760000000000';

  private leerSql(): string {
    // src/backend/src/database/migrations (o src/backend/dist/...) -> raíz del repo -> database/
    const ruta = resolve(__dirname, '../../../../../database/01_schema.sql');
    return readFileSync(ruta, 'utf8')
      .replace(/^\s*BEGIN;\s*$/gim, '')
      .replace(/^\s*COMMIT;\s*$/gim, '');
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(this.leerSql());
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Solo para desarrollo: elimina todo el esquema público y lo recrea vacío.
    await queryRunner.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }
}
