import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración 0003 (RF-34 / SGP-57): bitácora filtrable por proyecto y append-only a nivel de permisos.
 * - Agrega audit_log.proyecto_id (sin FK, para que el registro no dependa del proyecto).
 * - Retira UPDATE, DELETE y TRUNCATE sobre audit_log; el trigger trg_audit_no_modificar
 *   de la migración 0001 sigue siendo la primera barrera.
 * Es idempotente: en bases nuevas 01_schema.sql ya incluye estos cambios.
 */
export class AuditLogAppendOnly1760000000002 implements MigrationInterface {
  name = 'AuditLogAppendOnly1760000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS proyecto_id uuid`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_audit_proyecto ON audit_log (proyecto_id, created_at DESC) WHERE proyecto_id IS NOT NULL`,
    );
    await queryRunner.query(`REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM PUBLIC`);
    await queryRunner.query(`REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM CURRENT_USER`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`GRANT UPDATE, DELETE, TRUNCATE ON audit_log TO CURRENT_USER`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_audit_proyecto`);
    // Se conserva la columna proyecto_id: quitarla exigiría modificar filas de una tabla append-only.
  }
}
