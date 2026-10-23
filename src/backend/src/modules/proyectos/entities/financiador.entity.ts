import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Proyecto } from './proyecto.entity';
import { Usuario } from './usuario.entity';

@Entity({ name: 'financiadores' })
export class Financiador {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  nombre!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  contacto!: string | null;

  @Column({ type: 'citext', nullable: true })
  email!: string | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;

  @OneToMany(() => Proyecto, (p) => p.financiador)
  proyectos!: Proyecto[];

  @OneToMany(() => Usuario, (u) => u.financiador)
  usuarios!: Usuario[];
}
