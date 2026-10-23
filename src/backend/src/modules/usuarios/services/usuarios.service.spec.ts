import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { compare } from 'bcryptjs';
import { AuthService } from '../../auth/services/auth.service';
import { RolUsuario, Usuario } from '../../proyectos/entities/usuario.entity';
import { UsuariosService } from './usuarios.service';

const ADMIN = 'a-1';

function usuario(cambios: Partial<Usuario> = {}): Usuario {
  return Object.assign(new Usuario(), {
    id: 'u-1',
    nombre: 'Lucía Condori',
    email: 'tecnico@serfamilia.test',
    rol: RolUsuario.TECNICO,
    passwordHash: 'x',
    activo: true,
    intentosFallidos: 0,
    bloqueadoHasta: null,
    debeCambiarPassword: false,
    ultimoLoginAt: null,
    createdAt: new Date(),
    deletedAt: null,
    ...cambios,
  });
}

describe('UsuariosService (SGP-52)', () => {
  let service: UsuariosService;
  const repo = {
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn((d: Partial<Usuario>) => usuario({ id: 'nuevo', ...d })),
    save: jest.fn(async (u: Usuario) => u),
  };
  const auth = { revocarSesionesDe: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: getRepositoryToken(Usuario), useValue: repo },
        { provide: AuthService, useValue: auth },
      ],
    }).compile();
    service = mod.get(UsuariosService);
  });

  describe('crear', () => {
    it('guarda la contraseña con bcrypt y nunca la devuelve', async () => {
      repo.findOne.mockResolvedValue(null);

      const vista = await service.crear({
        nombre: 'Rodrigo Mamani',
        email: 'rodrigo@serfamilia.org',
        rol: RolUsuario.SUPERVISOR,
        password: 'Clave-segura-1',
      });

      const guardado = repo.save.mock.calls[0][0] as Usuario;
      expect(await compare('Clave-segura-1', guardado.passwordHash)).toBe(true);
      expect(guardado.debeCambiarPassword).toBe(true);
      expect(vista).not.toHaveProperty('passwordHash');
      expect(vista).toMatchObject({ email: 'rodrigo@serfamilia.org', rol: RolUsuario.SUPERVISOR });
    });

    it('rechaza un correo que ya está en uso (409)', async () => {
      repo.findOne.mockResolvedValue({ id: 'otro' });
      await expect(
        service.crear({ nombre: 'X', email: 'tecnico@serfamilia.test', rol: RolUsuario.TECNICO, password: '12345678' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('editar', () => {
    it('cambia nombre y rol', async () => {
      repo.findOne.mockResolvedValue(usuario());
      const vista = await service.editar('u-1', { nombre: 'Lucía C.', rol: RolUsuario.SUPERVISOR }, ADMIN);
      expect(vista).toMatchObject({ nombre: 'Lucía C.', rol: RolUsuario.SUPERVISOR });
      expect(auth.revocarSesionesDe).not.toHaveBeenCalled();
    });

    it('SGP-54: al desactivar cierra todas sus sesiones', async () => {
      repo.findOne.mockResolvedValue(usuario());
      await service.editar('u-1', { activo: false }, ADMIN);
      expect((repo.save.mock.calls[0][0] as Usuario).activo).toBe(false);
      expect(auth.revocarSesionesDe).toHaveBeenCalledWith('u-1');
    });

    it('al reactivar limpia el bloqueo por intentos fallidos', async () => {
      repo.findOne.mockResolvedValue(usuario({ activo: false, intentosFallidos: 3, bloqueadoHasta: new Date(Date.now() + 60_000) }));
      const vista = await service.editar('u-1', { activo: true }, ADMIN);
      expect(vista.bloqueado).toBe(false);
      expect((repo.save.mock.calls[0][0] as Usuario).intentosFallidos).toBe(0);
    });

    it('el administrador no puede quitarse su propio rol ni desactivarse', async () => {
      repo.findOne.mockResolvedValue(usuario({ id: ADMIN, rol: RolUsuario.ADMINISTRADOR }));
      await expect(service.editar(ADMIN, { rol: RolUsuario.TECNICO }, ADMIN)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.editar(ADMIN, { activo: false }, ADMIN)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('no deja el sistema sin ningún Administrador activo', async () => {
      repo.findOne.mockResolvedValue(usuario({ id: 'a-2', rol: RolUsuario.ADMINISTRADOR }));
      repo.count.mockResolvedValue(0);
      await expect(service.editar('a-2', { activo: false }, ADMIN)).rejects.toBeInstanceOf(ConflictException);
    });

    it('responde 404 si el usuario no existe o ya fue eliminado', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.editar('x', { nombre: 'Y' }, ADMIN)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('restablecerPassword guarda el hash nuevo, desbloquea y cierra sesiones', async () => {
    repo.findOne.mockResolvedValue(usuario({ intentosFallidos: 4, bloqueadoHasta: new Date(Date.now() + 60_000) }));

    await service.restablecerPassword('u-1', 'Nueva-clave-1');

    const guardado = repo.save.mock.calls[0][0] as Usuario;
    expect(await compare('Nueva-clave-1', guardado.passwordHash)).toBe(true);
    expect(guardado).toMatchObject({ intentosFallidos: 0, bloqueadoHasta: null, debeCambiarPassword: true });
    expect(auth.revocarSesionesDe).toHaveBeenCalledWith('u-1');
  });

  describe('eliminar', () => {
    it('hace baja lógica: marca deleted_at, desactiva y cierra sesiones', async () => {
      repo.findOne.mockResolvedValue(usuario());

      await service.eliminar('u-1', ADMIN);

      const guardado = repo.save.mock.calls[0][0] as Usuario;
      expect(guardado.deletedAt).toBeInstanceOf(Date);
      expect(guardado.activo).toBe(false);
      expect(auth.revocarSesionesDe).toHaveBeenCalledWith('u-1');
    });

    it('no permite eliminarse a sí mismo', async () => {
      await expect(service.eliminar(ADMIN, ADMIN)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});