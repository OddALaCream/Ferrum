import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { numerico } from '../utils/numerico';
import { Resultado } from './resultado.entity';

/** Indicador objetivamente verificable (I.O.V. 1.1…). Tabla `iov`. */
@Entity({ name: 'iov' })
export class Iov {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'resultado_id', type: 'uuid' })
  resultadoId!: string;

  @ManyToOne(() => Resultado, (r) => r.indicadores, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'resultado_id' })
  resultado!: Resultado;

  @Column({ type: 'varchar', length: 20 })
  codigo!: string;

  @Column({ type: 'text' })
  descripcion!: string;

  /** Unidad del valor meta: "%", "beneficiarios", "asociaciones", "Bs anual"… */
  @Column({ type: 'varchar', length: 50 })
  unidad!: string;

  @Column({ name: 'linea_base', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: numerico })
  lineaBase!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numerico })
  meta!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0, transformer: numerico })
  peso!: number;

  /** Fuentes de verificación (F.V.): qué documentos o registros prueban el indicador. */
  @Column({ name: 'tipo_fuente_verificacion', type: 'text' })
  fuenteVerificacion!: string;

  @Column({ name: 'responsable_id', type: 'uuid', nullable: true })
  responsableId!: string | null;

  @Column({ name: 'valor_actual', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: numerico })
  valorActual!: number;

  @Column({ name: 'cumplimiento_pct', type: 'numeric', precision: 5, scale: 2, default: 0, transformer: numerico })
  cumplimientoPct!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}