import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { ProyectoEquipo } from '../entities/proyecto-equipo.entity';
import { RolUsuario } from '../entities/usuario.entity';
import { AlcanceProyectoGuard } from './alcance-proyecto.guard';

const PROYECTO = '33333333-3333-4333-8333-333333333333';

function contexto(rol: RolUsuario, params: Record<string, string> = { id: PROYECTO }): ExecutionContext {
  return {
    getHandler: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u-1', rol }, params }) }),
  } as unknown as ExecutionContext;
}

describe('AlcanceProyectoGuard (SGP-50)', () => {
  const equipo = { exists: jest.fn() };
  const reflector = { get: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
  const guard = new AlcanceProyectoGuard(reflector, equipo as unknown as Repository<ProyectoEquipo>);

  beforeEach(() => equipo.exists.mockReset());

  it('Administrador y Supervisor pasan sin consultar el equipo', async () => {
    await expect(guard.canActivate(contexto(RolUsuario.ADMINISTRADOR))).resolves.toBe(true);
    await expect(guard.canActivate(contexto(RolUsuario.SUPERVISOR))).resolves.toBe(true);
    expect(equipo.exists).not.toHaveBeenCalled();
  });

  it('el Técnico asignado (sin fecha de retiro) pasa', async () => {
    equipo.exists.mockResolvedValue(true);
    await expect(guard.canActivate(contexto(RolUsuario.TECNICO))).resolves.toBe(true);
    expect(equipo.exists).toHaveBeenCalledWith({
      where: expect.objectContaining({ proyectoId: PROYECTO, usuarioId: 'u-1' }),
    });
  });

  it('CP-23: el Técnico no asignado o retirado recibe 403', async () => {
    equipo.exists.mockResolvedValue(false);
    await expect(guard.canActivate(contexto(RolUsuario.TECNICO))).rejects.toBeInstanceOf(ForbiddenException);
  });
});