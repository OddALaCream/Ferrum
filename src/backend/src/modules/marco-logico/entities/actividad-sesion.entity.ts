import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Actividad } from './actividad.entity';

/** Una fecha puntual de una actividad discreta. El técnico solo marca si ya se realizó. */
@Entity({ name: 'actividad_sesiones' })
export class ActividadSesion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'actividad_id', type: 'uuid' })
  actividadId!: string;

  @ManyToOne(() => Actividad, (a) => a.sesiones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actividad_id' })
  actividad!: Actividad;

  @Column({ type: 'date' })
  fecha!: string;

  @Column({ type: 'boolean', default: false })
  realizada!: boolean;

  @Column({ name: 'realizada_at', type: 'timestamptz', nullable: true })
  realizadaAt!: Date | null;

  @Column({ name: 'realizada_por', type: 'uuid', nullable: true })
  realizadaPor!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}