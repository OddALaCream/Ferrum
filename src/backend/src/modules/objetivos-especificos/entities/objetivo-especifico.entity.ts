import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Proyecto } from '../../proyectos/entities/proyecto.entity';

/** Tabla `objetivos_especificos` (database/01_schema.sql). Único por (proyecto_id, codigo). */
@Entity({ name: 'objetivos_especificos' })
export class ObjetivoEspecifico {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'proyecto_id', type: 'uuid' })
  proyectoId!: string;

  @ManyToOne(() => Proyecto, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto!: Proyecto;

  @Column({ type: 'varchar', length: 20 })
  codigo!: string;

  @Column({ type: 'text' })
  descripcion!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
