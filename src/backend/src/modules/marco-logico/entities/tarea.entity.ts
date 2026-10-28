import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Actividad } from './actividad.entity';

export const ESTADOS_TAREA = ['PENDIENTE', 'EN_CURSO', 'COMPLETADA'] as const;
export type EstadoTarea = (typeof ESTADOS_TAREA)[number];

/** Subdivisión de una actividad ("hablar con los jefes de manzana", "hacer encuestas"…). Tabla `tareas`. */
@Entity({ name: 'tareas' })
export class Tarea {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'actividad_id', type: 'uuid' })
  actividadId!: string;

  @ManyToOne(() => Actividad, (a) => a.tareas, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actividad_id' })
  actividad!: Actividad;

  @Column({ type: 'varchar', length: 250 })
  nombre!: string;

  @Column({ name: 'responsable_id', type: 'uuid', nullable: true })
  responsableId!: string | null;

  @Column({ type: 'enum', enum: ESTADOS_TAREA, enumName: 'estado_tarea', default: 'PENDIENTE' })
  estado!: EstadoTarea;

  @Column({ name: 'fecha_limite', type: 'date', nullable: true })
  fechaLimite!: string | null;

  @Column({ name: 'cerrado_at', type: 'timestamptz', nullable: true })
  cerradoAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}