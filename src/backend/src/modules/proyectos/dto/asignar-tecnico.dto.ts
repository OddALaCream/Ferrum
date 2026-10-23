import { IsUUID } from 'class-validator';

export class AsignarTecnicoDto {
  @IsUUID()
  usuarioId!: string;
}
