import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Cuerpo para registrar un objetivo específico bajo un proyecto (SGP-162). */
export class CreateObjetivoEspecificoDto {
  /** Código dentro del proyecto, por ejemplo "OE.1". */
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  codigo!: string;

  /** Qué se busca lograr con este objetivo específico. */
  @IsString()
  @IsNotEmpty()
  descripcion!: string;
}
