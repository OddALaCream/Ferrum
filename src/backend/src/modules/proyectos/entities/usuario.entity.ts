import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Financiador } from './financiador.entity';
import { Proyecto } from './proyecto.entity';
import { ProyectoEquipo } from './proyecto-equipo.entity';

export enum RolUsuario {
  DIRECTOR = 'DIRECTOR',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
  TECNICO = 'TECNICO',
  FINANCIADOR = 'FINANCIADOR',
}

@Entity({ name: 'usuarios' })
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'citext' })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 100 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 150 })
  nombre!: string;

  @Column({ type: 'enum', enum: RolUsuario, enumName: 'rol_usuario' })
  rol!: RolUsuario;

  @Column({ name: 'financiador_id', type: 'uuid', nullable: true })
  financiadorId!: string | null;

  @ManyToOne(() => Financiador, (f) => f.usuarios, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'financiador_id' })
  financiador!: Financiador | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @Column({ name: 'intentos_fallidos', type: 'smallint', default: 0 })
  intentosFallidos!: number;

  @Column({ name: 'bloqueado_hasta', type: 'timestamptz', nullable: true })
  bloqueadoHasta!: Date | null;

  @Column({ name: 'debe_cambiar_password', type: 'boolean', default: false })
  debeCambiarPassword!: boolean;

  @Column({ name: 'ultimo_login_at', type: 'timestamptz', nullable: true })
  ultimoLoginAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @OneToMany(() => Proyecto, (p) => p.creadoPor)
  proyectosCreados!: Proyecto[];

  @OneToMany(() => ProyectoEquipo, (e) => e.usuario)
  asignaciones!: ProyectoEquipo[];
}
