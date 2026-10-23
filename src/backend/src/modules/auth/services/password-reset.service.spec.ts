import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { compare } from 'bcryptjs';
import { MailService } from '../../../infrastructure/mail/mail.service';
import { RolUsuario, Usuario } from '../../proyectos/entities/usuario.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';

function usuario(cambios: Partial<Usuario> = {}): Usuario {
  return Object.assign(new Usuario(), {
    id: 'u-1',
    nombre: 'Lucía Condori',
    email: 'tecnico@serfamilia.test',
    rol: RolUsuario.TECNICO,
    activo: true,
    deletedAt: null,
    ...cambios,
  });
}

describe('PasswordResetService (SGP-110)', () => {
  let service: PasswordResetService;
  const usuarios = { findOne: jest.fn(), update: jest.fn() };
  const tokens = { findOne: jest.fn(), update: jest.fn(), insert: jest.fn() };
  const mail = { send: jest.fn() };
  const auth = { revocarSesionesDe: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    tokens.update.mockResolvedValue({ affected: 1 });
    mail.send.mockResolvedValue(undefined);
    const mod = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: getRepositoryToken(Usuario), useValue: usuarios },
        { provide: getRepositoryToken(PasswordResetToken), useValue: tokens },
        { provide: MailService, useValue: mail },
        { provide: AuthService, useValue: auth },
        { provide: ConfigService, useValue: { get: () => 'http://localhost:5173/' } },
      ],
    }).compile();
    service = mod.get(PasswordResetService);
  });

  describe('solicitar', () => {
    it('guarda solo el hash del token, vigencia de 30 min, y envía el enlace por correo', async () => {
      usuarios.findOne.mockResolvedValue(usuario());
      const antes = Date.now();

      await service.solicitar('tecnico@serfamilia.test');

      const guardado = tokens.insert.mock.calls[0][0];
      expect(guardado.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(guardado.expiraAt.getTime() - antes).toBeGreaterThan(29 * 60_000);
      expect(guardado.expiraAt.getTime() - antes).toBeLessThanOrEqual(30 * 60_000 + 1000);

      const correo = mail.send.mock.calls[0][0];
      expect(correo.to).toBe('tecnico@serfamilia.test');
      const [, token] = /restablecer\?token=([\w-]+)/.exec(correo.text) ?? [];
      expect(token).toHaveLength(43);
      expect(token).not.toBe(guardado.tokenHash);
      expect(correo.html).toContain('http://localhost:5173/restablecer?token=');
    });

    it('invalida los enlaces anteriores sin usar', async () => {
      usuarios.findOne.mockResolvedValue(usuario());
      await service.solicitar('tecnico@serfamilia.test');
      expect(tokens.update).toHaveBeenCalledWith({ usuarioId: 'u-1', usadoAt: expect.anything() }, { usadoAt: expect.any(Date) });
    });

    it('si el correo no existe no envía nada ni lanza error (no revela qué correos hay)', async () => {
      usuarios.findOne.mockResolvedValue(null);
      await expect(service.solicitar('nadie@serfamilia.test')).resolves.toBeUndefined();
      expect(mail.send).not.toHaveBeenCalled();
      expect(tokens.insert).not.toHaveBeenCalled();
    });

    it('si el SMTP falla la solicitud no se rompe', async () => {
      usuarios.findOne.mockResolvedValue(usuario());
      mail.send.mockRejectedValue(new Error('SMTP caído'));
      await expect(service.solicitar('tecnico@serfamilia.test')).resolves.toBeUndefined();
    });
  });

  describe('restablecer', () => {
    const vigente = () => ({ id: 't-1', usuarioId: 'u-1', usuario: usuario() });

    it('cambia la contraseña, desbloquea la cuenta y cierra sus sesiones', async () => {
      tokens.findOne.mockResolvedValue(vigente());

      await service.restablecer('token-del-enlace', 'Nueva-clave-1');

      expect(tokens.update).toHaveBeenCalledWith({ id: 't-1', usadoAt: expect.anything() }, { usadoAt: expect.any(Date) });
      const cambios = usuarios.update.mock.calls[0][1];
      expect(await compare('Nueva-clave-1', cambios.passwordHash)).toBe(true);
      expect(cambios).toMatchObject({ debeCambiarPassword: false, intentosFallidos: 0, bloqueadoHasta: null });
      expect(auth.revocarSesionesDe).toHaveBeenCalledWith('u-1');
    });

    it('CP-33: un enlace usado, vencido o inexistente se rechaza con el mismo mensaje (400)', async () => {
      tokens.findOne.mockResolvedValue(null);
      const error = await service.restablecer('invalido', 'Nueva-clave-1').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toContain('no es válido o ya venció');
      expect(usuarios.update).not.toHaveBeenCalled();
    });

    it('CP-33: si el mismo enlace se usa dos veces a la vez, solo una gana', async () => {
      tokens.findOne.mockResolvedValue(vigente());
      tokens.update.mockResolvedValue({ affected: 0 });
      await expect(service.restablecer('token', 'Nueva-clave-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(usuarios.update).not.toHaveBeenCalled();
    });

    it('rechaza el enlace de una cuenta desactivada', async () => {
      tokens.findOne.mockResolvedValue({ ...vigente(), usuario: usuario({ activo: false }) });
      await expect(service.restablecer('token', 'Nueva-clave-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});