import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';

export class SolicitarRestablecimientoDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido.' })
  @MaxLength(254)
  email!: string;
}