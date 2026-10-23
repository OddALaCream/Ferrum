import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RestablecerPasswordDto {
  /** Token del enlace recibido por correo. */
  @IsString()
  @IsNotEmpty({ message: 'El enlace no es válido.' })
  @MaxLength(200)
  token!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(128)
  password!: string;
}