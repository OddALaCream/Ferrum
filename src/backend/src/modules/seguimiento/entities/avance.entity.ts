import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { numerico } from '../../marco-logico/utils/numerico';
import { Evidencia } from './evidencia.entity';

/** Enum `estado_avance` (ADR-007): BORRADOR → ENVIADO → APROBADO u OBSERVADO; OBSERVADO → ENVIADO. */
export const ESTADOS_AVANCE = ['BORRADOR', 'ENVIADO', 'APROBADO', 'OBSERVADO', 'ANULADO'] as const;
export type EstadoAvance = (typeof ESTADOS_AVANCE)[number];

/**
 * Avance que reporta el técnico responsable sobre un indicador (I.O.V.) o una actividad, con su evidencia.
 * Tabla `avances`: pertenece a un I.O.V. o a una actividad, nunca a ambos.
 */
@Entity({ name: 'avances' })
export class Avance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'iov_id', type: 'uuid', nullable: true })
  iovId!: string | null;

  @Column({ name: 'actividad_id', type: 'uuid', nullable: true })
  actividadId!: string | null;

  @Column({ name: 'autor_id', type: 'uuid' })
  autorId!: string;

  /** Cantidad alcanzada en este periodo (obligatoria en un indicador; p. ej. 40 beneficiarios). */
  @Column({ name: 'valor_reportado', type: 'numeric', precision: 14, scale: 2, nullable: true, transformer: numerico })
  valorReportado!: number | null;

  @Column({ name: 'fecha_corte', type: 'date' })
  fechaCorte!: string;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ type: 'enum', enum: ESTADOS_AVANCE, enumName: 'estado_avance', default: 'BORRADOR' })
  estado!: EstadoAvance;

  @Column({ name: 'enviado_at', type: 'timestamptz', nullable: true })
  enviadoAt!: Date | null;

  @Column({ name: 'revisado_por', type: 'uuid', nullable: true })
  revisadoPorId!: string | null;

  @Column({ name: 'revisado_at', type: 'timestamptz', nullable: true })
  revisadoAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  observacion!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => Evidencia, (e) => e.avance)
  evidencias!: Evidencia[];
}