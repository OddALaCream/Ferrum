import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Proyecto } from './proyecto.entity';
import { Usuario } from './usuario.entity';

@Entity({ name: 'proyecto_equipo' })
export class ProyectoEquipo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'proyecto_id', type: 'uuid' })
  proyectoId!: string;

  @ManyToOne(() => Proyecto, (p) => p.equipo, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto!: Proyecto;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @ManyToOne(() => Usuario, (u) => u.asignaciones, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @Column({ name: 'asignado_por', type: 'uuid' })
  asignadoPorId!: string;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'asignado_por' })
  asignadoPor!: Usuario;

  @Column({ name: 'asignado_at', type: 'timestamptz', default: () => 'now()' })
  asignadoAt!: Date;

  @Column({ name: 'retirado_at', type: 'timestamptz', nullable: true })
  retiradoAt!: Date | null;
}
