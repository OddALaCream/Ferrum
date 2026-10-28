import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { numerico } from '../utils/numerico';
import { Actividad } from './actividad.entity';
import { Iov } from './iov.entity';

/** Resultado esperado del marco lógico (R.1, R.2…). Tabla `resultados`. */
@Entity({ name: 'resultados' })
export class Resultado {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'proyecto_id', type: 'uuid' })
  proyectoId!: string;

  @Column({ type: 'varchar', length: 20 })
  codigo!: string;

  @Column({ type: 'text' })
  descripcion!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0, transformer: numerico })
  peso!: number;

  @Column({ name: 'cumplimiento_pct', type: 'numeric', precision: 5, scale: 2, default: 0, transformer: numerico })
  cumplimientoPct!: number;

  @OneToMany(() => Iov, (i) => i.resultado)
  indicadores!: Iov[];

  @OneToMany(() => Actividad, (a) => a.resultado)
  actividades!: Actividad[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}