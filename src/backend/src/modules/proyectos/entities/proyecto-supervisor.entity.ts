import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Proyecto } from './proyecto.entity';
import { Usuario } from './usuario.entity';

/**
 * Supervisión de un proyecto. Un supervisor puede estar en muchos proyectos y un proyecto puede tener
 * varios supervisores. Tabla `proyecto_supervisores`; se conserva el historial con `retirado_at`.
 */
@Entity({ name: 'proyecto_supervisores' })
export class ProyectoSupervisor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'proyecto_id', type: 'uuid' })
  proyectoId!: string;

  @ManyToOne(() => Proyecto, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto!: Proyecto;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @Column({ name: 'asignado_por', type: 'uuid' })
  asignadoPorId!: string;

  @Column({ name: 'asignado_at', type: 'timestamptz', default: () => 'now()' })
  asignadoAt!: Date;

  @Column({ name: 'retirado_at', type: 'timestamptz', nullable: true })
  retiradoAt!: Date | null;
}