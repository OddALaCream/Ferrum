import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UsuarioActual } from '../../../common/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../auth/types/auth.types';
import { RolUsuario } from '../../proyectos/entities/usuario.entity';
import { CrearUsuarioDto } from '../dto/crear-usuario.dto';
import { EditarUsuarioDto } from '../dto/editar-usuario.dto';
import { ListarUsuariosDto } from '../dto/listar-usuarios.dto';
import { RestablecerPasswordDto } from '../dto/restablecer-password.dto';
import { UsuariosService } from '../services/usuarios.service';

/** SGP-53: gestión de cuentas. Todo el controlador es solo para el Administrador. */
@Roles(RolUsuario.ADMINISTRADOR)
@ApiTags('Usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  listar(@Query() filtros: ListarUsuariosDto) {
    return this.usuarios.listar(filtros);
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuarios.obtener(id);
  }

  @Post()
  crear(@Body() dto: CrearUsuarioDto) {
    return this.usuarios.crear(dto);
  }

  @Patch(':id')
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditarUsuarioDto,
    @UsuarioActual() actor: UsuarioAutenticado,
  ) {
    return this.usuarios.editar(id, dto, actor.id);
  }

  @Patch(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async restablecerPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RestablecerPasswordDto,
  ): Promise<void> {
    await this.usuarios.restablecerPassword(id, dto.password);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioAutenticado): Promise<void> {
    await this.usuarios.eliminar(id, actor.id);
  }
}