import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Tabla `audit_log` (database/01_schema.sql). Solo inserción: la BD rechaza UPDATE, DELETE y TRUNCATE. */
@Entity({ name: 'audit_log' })
export class AuditLog {
  /** bigint GENERATED ALWAYS AS IDENTITY; el driver pg lo devuelve como texto. */
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id!: string;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuarioId!: string | null;

  @Column({ name: 'usuario_email', type: 'citext', nullable: true })
  usuarioEmail!: string | null;

  @Column({ type: 'varchar', length: 60 })
  accion!: string;

  @Column({ type: 'varchar', length: 60 })
  entidad!: string;

  @Column({ name: 'entidad_id', type: 'varchar', length: 64, nullable: true })
  entidadId!: string | null;

  @Column({ name: 'proyecto_id', type: 'uuid', nullable: true })
  proyectoId!: string | null;

  @Column({ name: 'valor_anterior', type: 'jsonb', nullable: true })
  valorAnterior!: Record<string, unknown> | null;

  @Column({ name: 'valor_nuevo', type: 'jsonb', nullable: true })
  valorNuevo!: Record<string, unknown> | null;

  @Column({ type: 'inet', nullable: true })
  ip!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 300, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
