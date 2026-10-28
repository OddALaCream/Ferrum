import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { numerico } from '../utils/numerico';
import { ActividadSesion } from './actividad-sesion.entity';
import { Resultado } from './resultado.entity';
import { Tarea } from './tarea.entity';

export const ESTADOS_ACTIVIDAD = ['PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'RETRASADA'] as const;
export type EstadoActividad = (typeof ESTADOS_ACTIVIDAD)[number];

/**
 * CONTINUO: corre de la fecha de inicio a la de fin (p. ej. mantenimiento de un camino).
 * DISCRETO: ocurre en sesiones puntuales (p. ej. talleres 1 o 2 días por semana).
 */
export const TIPOS_CRONOGRAMA = ['CONTINUO', 'DISCRETO'] as const;
export type TipoCronograma = (typeof TIPOS_CRONOGRAMA)[number];

/** Actividad de un resultado (A.1.1…). Tabla `actividades`. */
@Entity({ name: 'actividades' })
export class Actividad {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'resultado_id', type: 'uuid' })
  resultadoId!: string;

  @ManyToOne(() => Resultado, (r) => r.actividades, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'resultado_id' })
  resultado!: Resultado;

  @Column({ name: 'iov_id', type: 'uuid', nullable: true })
  iovId!: string | null;

  @Column({ type: 'varchar', length: 20 })
  codigo!: string;

  @Column({ type: 'varchar', length: 250 })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ name: 'responsable_id', type: 'uuid', nullable: true })
  responsableId!: string | null;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio!: string;

  @Column({ name: 'fecha_fin', type: 'date' })
  fechaFin!: string;

  @Column({ type: 'enum', enum: ESTADOS_ACTIVIDAD, enumName: 'estado_actividad', default: 'PENDIENTE' })
  estado!: EstadoActividad;

  @Column({ name: 'tipo_cronograma', type: 'enum', enum: TIPOS_CRONOGRAMA, enumName: 'tipo_cronograma', default: 'CONTINUO' })
  tipoCronograma!: TipoCronograma;

  /** Meta de la actividad ("Número" del marco lógico), por ejemplo 10. */
  @Column({ name: 'meta_cuantitativa', type: 'numeric', precision: 14, scale: 2, nullable: true, transformer: numerico })
  metaCuantitativa!: number | null;

  /** Unidad de la meta, por ejemplo "sesiones de capacitación". */
  @Column({ name: 'unidad_meta', type: 'varchar', length: 150, nullable: true })
  unidadMeta!: string | null;

  @Column({ name: 'fuentes_verificacion', type: 'text', nullable: true })
  fuentesVerificacion!: string | null;

  @Column({ name: 'cumplimiento_pct', type: 'numeric', precision: 5, scale: 2, default: 0, transformer: numerico })
  cumplimientoPct!: number;

  @OneToMany(() => ActividadSesion, (s) => s.actividad)
  sesiones!: ActividadSesion[];

  @OneToMany(() => Tarea, (t) => t.actividad)
  tareas!: Tarea[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}