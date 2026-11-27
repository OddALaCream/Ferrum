import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolUsuario } from '../proyectos/entities/usuario.entity';
import { AvancesService } from './avances.service';

/** SGP-96: bandeja de revisión del Administrador. */
@ApiTags('Avances y evidencias')
@Controller('avances')
export class RevisionController {
  constructor(private readonly avances: AvancesService) {}

  /** Avances enviados de todos los proyectos abiertos, del más antiguo al más reciente. */
  @Roles(RolUsuario.ADMINISTRADOR)
  @Get('revision')
  bandeja() {
    return this.avances.bandeja();
  }
}