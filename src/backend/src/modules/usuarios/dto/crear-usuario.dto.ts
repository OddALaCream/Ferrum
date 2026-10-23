import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { RolUsuario } from '../../proyectos/entities/usuario.entity';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CrearUsuarioDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Ingresa el nombre completo.' })
  @MaxLength(150)
  nombre!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido.' })
  @MaxLength(254)
  email!: string;

  @IsEnum(RolUsuario, { message: 'El rol debe ser ADMINISTRADOR, SUPERVISOR o TECNICO.' })
  rol!: RolUsuario;

  /** Contraseña inicial que el administrador le comunica a la persona. */
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(128)
  password!: string;
}