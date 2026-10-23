import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración 0002 (RF-02): el presupuesto del proyecto admite BOB, USD o EUR.
 * Las bases creadas con la migración 0001 anterior solo tenían BOB y USD.
 * `IF NOT EXISTS` la vuelve inocua en bases nuevas, donde 01_schema.sql ya incluye EUR.
 */
export class MonedaEur1760000000001 implements MigrationInterface {
  name = 'MonedaEur1760000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE moneda_tipo ADD VALUE IF NOT EXISTS 'EUR'`);
  }

  public async down(): Promise<void> {
    // PostgreSQL no permite quitar un valor de un ENUM sin recrear el tipo y sus columnas;
    // se conserva EUR para no perder datos ya registrados en esa moneda.
  }
}
