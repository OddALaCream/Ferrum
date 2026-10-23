import { ForbiddenException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { hashSync } from 'bcryptjs';
import { RolUsuario, Usuario } from '../../proyectos/entities/usuario.entity';
import { AuthService } from './auth.service';
import { RefreshToken } from '../entities/refresh-token.entity';

const PASSWORD = 'Serfamilia2026';
const HASH = hashSync(PASSWORD, 4); // costo bajo solo para que la prueba sea rápida

function usuario(cambios: Partial<Usuario> = {}): Usuario {
  return Object.assign(new Usuario(), {
    id: 'u-1',
    email: 'tecnico@serfamilia.test',
    nombre: 'Lucía Condori',
    rol: RolUsuario.TECNICO,
    passwordHash: HASH,
    activo: true,
    intentosFallidos: 0,
    bloqueadoHasta: null,
    debeCambiarPassword: false,
    deletedAt: null,
    ...cambios,
  });
}

describe('AuthService', () => {
  let service: AuthService;
  const usuarios = { findOne: jest.fn(), update: jest.fn() };
  const tokens = { findOne: jest.fn(), update: jest.fn(), insert: jest.fn() };
  const jwt = { signAsync: jest.fn().mockResolvedValue('access.jwt') };

  beforeEach(async () => {
    jest.clearAllMocks();
    tokens.update.mockResolvedValue({ affected: 1 });
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Usuario), useValue: usuarios },
        { provide: getRepositoryToken(RefreshToken), useValue: tokens },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: (_k: string, def: string) => def } },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe('login', () => {
    it('con credenciales válidas emite la sesión y reinicia el contador', async () => {
      usuarios.findOne.mockResolvedValue(usuario({ intentosFallidos: 3 }));

      const sesion = await service.login('tecnico@serfamilia.test', PASSWORD);

      expect(sesion.accessToken).toBe('access.jwt');
      expect(sesion.expiraEn).toBe(15 * 60);
      expect(sesion.usuario).toMatchObject({ id: 'u-1', rol: RolUsuario.TECNICO });
      expect(sesion.refreshToken).toHaveLength(43);
      expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'u-1', rol: RolUsuario.TECNICO }, expect.anything());
      expect(usuarios.update).toHaveBeenCalledWith('u-1', expect.objectContaining({ intentosFallidos: 0, bloqueadoHasta: null }));
      // solo se guarda el hash del refresh token
      const guardado = tokens.insert.mock.calls[0][0];
      expect(guardado.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(guardado.tokenHash).not.toBe(sesion.refreshToken);
    });

    it('responde lo mismo si el correo no existe o si la contraseña es incorrecta', async () => {
      usuarios.findOne.mockResolvedValueOnce(null);
      const sinCorreo = service.login('nadie@serfamilia.test', PASSWORD);
      await expect(sinCorreo).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(sinCorreo).rejects.toThrow('Correo o contraseña incorrectos.');

      usuarios.findOne.mockResolvedValueOnce(usuario());
      const malaClave = service.login('tecnico@serfamilia.test', 'otra');
      await expect(malaClave).rejects.toThrow('Correo o contraseña incorrectos.');
    });

    it('suma un intento fallido', async () => {
      usuarios.findOne.mockResolvedValue(usuario({ intentosFallidos: 2 }));
      await expect(service.login('tecnico@serfamilia.test', 'otra')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usuarios.update).toHaveBeenCalledWith('u-1', { intentosFallidos: 3 });
    });

    it('CP-17: al 5.º fallo bloquea la cuenta 15 minutos (423)', async () => {
      usuarios.findOne.mockResolvedValue(usuario({ intentosFallidos: 4 }));
      const antes = Date.now();

      const error = await service.login('tecnico@serfamilia.test', 'otra').catch((e: HttpException) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.LOCKED);
      expect((error as HttpException).message).toContain('15 minutos');
      const { bloqueadoHasta } = usuarios.update.mock.calls[0][1];
      expect(bloqueadoHasta.getTime() - antes).toBeGreaterThanOrEqual(15 * 60_000 - 1000);
    });

    it('CP-17: mientras dura el bloqueo rechaza incluso la contraseña correcta', async () => {
      const hasta = new Date(Date.now() + 10 * 60_000);
      usuarios.findOne.mockResolvedValue(usuario({ bloqueadoHasta: hasta }));

      const error = await service.login('tecnico@serfamilia.test', PASSWORD).catch((e: HttpException) => e);

      expect((error as HttpException).getStatus()).toBe(HttpStatus.LOCKED);
      expect((error as HttpException).message).toContain('10 minutos');
      expect(tokens.insert).not.toHaveBeenCalled();
    });

    it('cuando el bloqueo venció deja entrar con la contraseña correcta', async () => {
      usuarios.findOne.mockResolvedValue(usuario({ bloqueadoHasta: new Date(Date.now() - 1000) }));
      await expect(service.login('tecnico@serfamilia.test', PASSWORD)).resolves.toHaveProperty('accessToken');
    });

    it('una cuenta desactivada no entra aunque la contraseña sea correcta', async () => {
      usuarios.findOne.mockResolvedValue(usuario({ activo: false }));
      await expect(service.login('tecnico@serfamilia.test', PASSWORD)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('refrescar', () => {
    const vigente = () => ({
      id: 't-1',
      familiaId: 'f-1',
      expiraAt: new Date(Date.now() + 60_000),
      revocadoAt: null,
      usuario: usuario(),
    });

    it('rota el token: revoca el actual y emite uno nuevo de la misma familia', async () => {
      tokens.findOne.mockResolvedValueOnce(vigente()).mockResolvedValueOnce({ id: 't-2' });

      const sesion = await service.refrescar('token-viejo');

      expect(sesion.accessToken).toBe('access.jwt');
      expect(tokens.insert.mock.calls[0][0]).toMatchObject({ familiaId: 'f-1' });
      expect(tokens.update).toHaveBeenCalledWith({ id: 't-1', revocadoAt: expect.anything() }, expect.anything());
      expect(tokens.update).toHaveBeenCalledWith('t-1', { reemplazadoPor: 't-2' });
    });

    it('si se reutiliza un token ya rotado revoca toda la familia', async () => {
      tokens.findOne.mockResolvedValue({ ...vigente(), revocadoAt: new Date() });

      await expect(service.refrescar('token-robado')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokens.update).toHaveBeenCalledWith({ familiaId: 'f-1', revocadoAt: expect.anything() }, expect.anything());
      expect(tokens.insert).not.toHaveBeenCalled();
    });

    it('rechaza un token vencido o inexistente', async () => {
      tokens.findOne.mockResolvedValueOnce({ ...vigente(), expiraAt: new Date(Date.now() - 1) });
      await expect(service.refrescar('vencido')).rejects.toBeInstanceOf(UnauthorizedException);

      tokens.findOne.mockResolvedValueOnce(null);
      await expect(service.refrescar('no-existe')).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.refrescar(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  it('cerrarSesion revoca la familia del refresh token', async () => {
    tokens.findOne.mockResolvedValue({ id: 't-1', familiaId: 'f-1' });
    await service.cerrarSesion('token');
    expect(tokens.update).toHaveBeenCalledWith({ familiaId: 'f-1', revocadoAt: expect.anything() }, expect.anything());
  });
});