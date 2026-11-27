import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Avance } from './avance.entity';

/**
 * Archivo que prueba un avance (fuente de verificación). Tabla `evidencias`: inmutable en la base
 * (no se puede modificar; solo se borra mientras el avance está en borrador). El único cambio admitido es
 * su anulación por el Administrador, con motivo (SGP-135); el archivo original se conserva.
 */
@Entity({ name: 'evidencias' })
export class Evidencia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'avance_id', type: 'uuid' })
  avanceId!: string;

  @ManyToOne(() => Avance, (a) => a.evidencias, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'avance_id' })
  avance!: Avance;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @Column({ name: 'reemplaza_a', type: 'uuid', nullable: true })
  reemplazaA!: string | null;

  /** Nombre del objeto en el almacenamiento (un UUID, nunca el nombre original). */
  @Column({ name: 'storage_key', type: 'varchar', length: 300 })
  storageKey!: string;

  @Column({ name: 'nombre_original', type: 'varchar', length: 255 })
  nombreOriginal!: string;

  @Column({ type: 'varchar', length: 100 })
  mime!: string;

  @Column({ name: 'tamano_bytes', type: 'bigint', transformer: { to: (v?: number) => v, from: (v?: string | null) => (v == null ? v : Number(v)) } })
  tamanoBytes!: number;

  @Column({ type: 'char', length: 64 })
  sha256!: string;

  @Column({ name: 'subido_por', type: 'uuid' })
  subidoPorId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'anulada_at', type: 'timestamptz', nullable: true })
  anuladaAt!: Date | null;

  @Column({ name: 'anulada_por', type: 'uuid', nullable: true })
  anuladaPorId!: string | null;

  @Column({ name: 'motivo_anulacion', type: 'text', nullable: true })
  motivoAnulacion!: string | null;
}