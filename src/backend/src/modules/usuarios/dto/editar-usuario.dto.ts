import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { RolUsuario } from '../../proyectos/entities/usuario.entity';

/** Todos los campos son opcionales: solo se cambia lo que llega. */
export class EditarUsuarioDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede quedar vacío.' })
  @MaxLength(150)
  nombre?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido.' })
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsEnum(RolUsuario, { message: 'El rol debe ser ADMINISTRADOR, SUPERVISOR o TECNICO.' })
  rol?: RolUsuario;

  /** false = desactivar la cuenta (no puede entrar, pero se conserva). */
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}