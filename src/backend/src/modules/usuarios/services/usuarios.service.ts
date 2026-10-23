import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { AuthService } from '../../auth/services/auth.service';
import { hashPassword } from '../../auth/utils/password';
import { RolUsuario, Usuario } from '../../proyectos/entities/usuario.entity';
import { CrearUsuarioDto } from '../dto/crear-usuario.dto';
import { EditarUsuarioDto } from '../dto/editar-usuario.dto';
import { ListarUsuariosDto } from '../dto/listar-usuarios.dto';
import type { UsuarioVista } from '../types/usuarios.types';

const MSG_CORREO_EN_USO = 'Ya existe una cuenta con ese correo.';
const MSG_ULTIMO_ADMIN = 'Debe quedar al menos un Administrador activo en el sistema.';

/**
 * RF-32 / SGP-52: el Administrador crea, edita, desactiva y elimina cuentas.
 * Eliminar es una baja lógica (deleted_at): el registro y su historial en la bitácora se conservan.
 */
@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly auth: AuthService,
  ) {}

  async listar(filtros: ListarUsuariosDto): Promise<UsuarioVista[]> {
    const qb = this.usuarios.createQueryBuilder('u').where('u.deleted_at IS NULL').orderBy('u.nombre', 'ASC');
    if (filtros.q?.trim()) {
      qb.andWhere('(u.nombre ILIKE :q OR u.email ILIKE :q)', { q: `%${filtros.q.trim()}%` });
    }
    if (filtros.rol) qb.andWhere('u.rol = :rol', { rol: filtros.rol });
    if (filtros.activo !== undefined) qb.andWhere('u.activo = :activo', { activo: filtros.activo });
    return (await qb.getMany()).map(aVista);
  }

  async obtener(id: string): Promise<UsuarioVista> {
    return aVista(await this.buscar(id));
  }

  async crear(dto: CrearUsuarioDto): Promise<UsuarioVista> {
    await this.verificarCorreoLibre(dto.email);
    const usuario = this.usuarios.create({
      nombre: dto.nombre,
      email: dto.email,
      rol: dto.rol,
      passwordHash: await hashPassword(dto.password),
      // La contraseña la eligió el administrador: la persona deberá cambiarla
      debeCambiarPassword: true,
    });
    return aVista(await this.usuarios.save(usuario));
  }

  async editar(id: string, dto: EditarUsuarioDto, actorId: string): Promise<UsuarioVista> {
    const usuario = await this.buscar(id);

    if (dto.email !== undefined && dto.email !== usuario.email.toLowerCase()) {
      await this.verificarCorreoLibre(dto.email, id);
      usuario.email = dto.email;
    }
    if (dto.nombre !== undefined) usuario.nombre = dto.nombre;

    const pierdeAdmin =
      usuario.rol === RolUsuario.ADMINISTRADOR &&
      usuario.activo &&
      ((dto.rol !== undefined && dto.rol !== RolUsuario.ADMINISTRADOR) || dto.activo === false);
    if (pierdeAdmin) {
      if (id === actorId) {
        throw new BadRequestException('No puedes quitarte el rol de Administrador ni desactivar tu propia cuenta.');
      }
      await this.verificarOtroAdmin(id);
    }

    if (dto.rol !== undefined) usuario.rol = dto.rol;

    const desactiva = dto.activo === false && usuario.activo;
    if (dto.activo !== undefined) {
      usuario.activo = dto.activo;
      if (dto.activo) {
        // Al reactivar se limpia cualquier bloqueo por intentos fallidos
        usuario.intentosFallidos = 0;
        usuario.bloqueadoHasta = null;
      }
    }

    const guardado = await this.usuarios.save(usuario);
    if (desactiva) await this.auth.revocarSesionesDe(id); // SGP-54
    return aVista(guardado);
  }

  /** El administrador asigna una contraseña nueva: desbloquea la cuenta y cierra sus sesiones. */
  async restablecerPassword(id: string, password: string): Promise<void> {
    const usuario = await this.buscar(id);
    usuario.passwordHash = await hashPassword(password);
    usuario.debeCambiarPassword = true;
    usuario.intentosFallidos = 0;
    usuario.bloqueadoHasta = null;
    await this.usuarios.save(usuario);
    await this.auth.revocarSesionesDe(id);
  }

  /** Baja lógica: deja de aparecer y no puede entrar, pero su historial queda intacto. */
  async eliminar(id: string, actorId: string): Promise<void> {
    if (id === actorId) throw new BadRequestException('No puedes eliminar tu propia cuenta.');
    const usuario = await this.buscar(id);
    if (usuario.rol === RolUsuario.ADMINISTRADOR && usuario.activo) await this.verificarOtroAdmin(id);

    usuario.activo = false;
    usuario.deletedAt = new Date();
    await this.usuarios.save(usuario);
    await this.auth.revocarSesionesDe(id);
  }

  private async buscar(id: string): Promise<Usuario> {
    const usuario = await this.usuarios.findOne({ where: { id, deletedAt: IsNull() } });
    if (!usuario) throw new NotFoundException('El usuario no existe.');
    return usuario;
  }

  private async verificarCorreoLibre(email: string, exceptoId?: string): Promise<void> {
    const existente = await this.usuarios.findOne({
      where: { email, deletedAt: IsNull(), ...(exceptoId ? { id: Not(exceptoId) } : {}) },
      select: { id: true },
    });
    if (existente) throw new ConflictException(MSG_CORREO_EN_USO);
  }

  private async verificarOtroAdmin(exceptoId: string): Promise<void> {
    const otros = await this.usuarios.count({
      where: { rol: RolUsuario.ADMINISTRADOR, activo: true, deletedAt: IsNull(), id: Not(exceptoId) },
    });
    if (otros === 0) throw new ConflictException(MSG_ULTIMO_ADMIN);
  }
}

function aVista(u: Usuario): UsuarioVista {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    activo: u.activo,
    bloqueado: u.bloqueadoHasta !== null && u.bloqueadoHasta > new Date(),
    debeCambiarPassword: u.debeCambiarPassword,
    ultimoLoginAt: u.ultimoLoginAt,
    createdAt: u.createdAt,
  };
}