import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from '../../proyectos/entities/usuario.entity';

/**
 * Tabla `refresh_tokens` (database/01_schema.sql, ADR-004).
 * Se guarda solo el SHA-256 del token. Cada renovación crea un token nuevo de la
 * misma familia; si alguien reutiliza uno ya rotado se revoca la familia entera.
 */
@Entity({ name: 'refresh_tokens' })
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @Column({ name: 'familia_id', type: 'uuid' })
  familiaId!: string;

  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash!: string;

  @Column({ name: 'expira_at', type: 'timestamptz' })
  expiraAt!: Date;

  @Column({ name: 'revocado_at', type: 'timestamptz', nullable: true })
  revocadoAt!: Date | null;

  @Column({ name: 'reemplazado_por', type: 'uuid', nullable: true })
  reemplazadoPor!: string | null;

  @Column({ type: 'inet', nullable: true })
  ip!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 300, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}