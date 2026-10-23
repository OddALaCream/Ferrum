import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MONEDAS, type Moneda } from '../presupuesto';
import { Financiador } from './financiador.entity';
import { ProyectoEquipo } from './proyecto-equipo.entity';
import { Usuario } from './usuario.entity';

export const ESTADOS_PROYECTO = ['PLANIFICACION', 'EN_EJECUCION', 'PAUSADO', 'CERRADO'] as const;
export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number];

/** Tabla `proyectos` (database/01_schema.sql). */
@Entity({ name: 'proyectos' })
export class Proyecto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30 })
  codigo!: string;

  @Column({ type: 'varchar', length: 250 })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ name: 'objetivo_general', type: 'text', nullable: true })
  objetivoGeneral!: string | null;

  @Column({ name: 'financiador_id', type: 'uuid' })
  financiadorId!: string;

  @ManyToOne(() => Financiador, (f) => f.proyectos, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'financiador_id' })
  financiador!: Financiador;

  /** NUMERIC(14,2). El driver pg lo devuelve como texto, así no se pierde precisión (RF-02 / SGP-7). */
  @Column({ name: 'presupuesto_total', type: 'numeric', precision: 14, scale: 2, default: 0 })
  presupuestoTotal!: string;

  @Column({ type: 'enum', enum: MONEDAS, enumName: 'moneda_tipo', default: 'BOB' })
  moneda!: Moneda;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio!: string;

  @Column({ name: 'fecha_fin', type: 'date' })
  fechaFin!: string;

  @Column({
    type: 'enum',
    enum: ESTADOS_PROYECTO,
    enumName: 'estado_proyecto',
    default: 'PLANIFICACION',
  })
  estado!: EstadoProyecto;

  @Column({
    name: 'cumplimiento_pct',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
  })
  cumplimientoPct!: string;

  @Column({ name: 'creado_por', type: 'uuid' })
  creadoPorId!: string;

  @ManyToOne(() => Usuario, (u) => u.proyectosCreados, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creado_por' })
  creadoPor!: Usuario;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt!: Date | null;

  @OneToMany(() => ProyectoEquipo, (e) => e.proyecto)
  equipo!: ProyectoEquipo[];
}
