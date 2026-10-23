import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolUsuario } from '../proyectos/entities/usuario.entity';
import { AuditoriaService, OpcionesAuditoria, PaginaAuditoria } from './auditoria.service';
import { ConsultarAuditoriaDto } from './dto/consultar-auditoria.dto';

/**
 * RF-34 / SGP-59: consulta de la bitácora. Solo lectura: no existen rutas para modificarla.
 * Solo la consulta el Administrador.
 */
@Roles(RolUsuario.ADMINISTRADOR)
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  consultar(@Query() filtros: ConsultarAuditoriaDto): Promise<PaginaAuditoria> {
    return this.auditoria.consultar(filtros);
  }

  @Get('opciones')
  opciones(): Promise<OpcionesAuditoria> {
    return this.auditoria.opciones();
  }
}