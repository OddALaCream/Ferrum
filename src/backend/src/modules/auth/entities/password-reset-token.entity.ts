import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from '../../proyectos/entities/usuario.entity';

/**
 * Tabla `password_reset_tokens` (database/01_schema.sql).
 * Se guarda solo el SHA-256 del token que viaja en el enlace del correo.
 * Un token se usa una sola vez (`usado_at`) y vence a los 30 min (`expira_at`).
 */
@Entity({ name: 'password_reset_tokens' })
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash!: string;

  @Column({ name: 'expira_at', type: 'timestamptz' })
  expiraAt!: Date;

  @Column({ name: 'usado_at', type: 'timestamptz', nullable: true })
  usadoAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}