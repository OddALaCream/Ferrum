import { IsUUID } from 'class-validator';

export class AsignarSupervisorDto {
  /** Usuario con rol SUPERVISOR que supervisará el proyecto. */
  @IsUUID()
  usuarioId!: string;
}