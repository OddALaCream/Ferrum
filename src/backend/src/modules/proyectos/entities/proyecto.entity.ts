import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { MONEDAS, type Moneda } from '../presupuesto';

export const ESTADOS_PROYECTO = ['PLANIFICACION', 'EN_EJECUCION', 'PAUSADO', 'CERRADO'] as const;
export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number];

/** Tabla `proyectos` (database/01_schema.sql). */
@Entity({ name: 'proyectos' })
export class Proyecto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30 })
  codigo: string;

  @Column({ type: 'varchar', length: 250 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ name: 'objetivo_general', type: 'text', nullable: true })
  objetivoGeneral: string | null;

  @Column({ name: 'financiador_id', type: 'uuid' })
  financiadorId: string;

  /** NUMERIC(14,2). El driver pg lo devuelve como texto, así no se pierde precisión. */
  @Column({ name: 'presupuesto_total', type: 'numeric', precision: 14, scale: 2 })
  presupuestoTotal: string;

  @Column({ type: 'enum', enum: MONEDAS, enumName: 'moneda_tipo' })
  moneda: Moneda;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: string;

  @Column({ name: 'fecha_fin', type: 'date' })
  fechaFin: string;

  @Column({ type: 'enum', enum: ESTADOS_PROYECTO, enumName: 'estado_proyecto' })
  estado: EstadoProyecto;

  @Column({ name: 'creado_por', type: 'uuid' })
  creadoPor: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date | null;
}
