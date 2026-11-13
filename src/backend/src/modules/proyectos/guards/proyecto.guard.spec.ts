import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { ProyectoEquipo } from '../entities/proyecto-equipo.entity';
import { ProyectoSupervisor } from '../entities/proyecto-supervisor.entity';
import { RolUsuario } from '../entities/usuario.entity';
import { AlcanceProyectoGuard } from './alcance-proyecto.guard';

const PROYECTO = '33333333-3333-4333-8333-333333333333';

function contexto(rol: RolUsuario, params: Record<string, string> = { id: PROYECTO }): ExecutionContext {
  return {
    getHandler: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u-1', rol }, params }) }),
  } as unknown as ExecutionContext;
}

describe('AlcanceProyectoGuard (SGP-50): cada rol entra solo a lo suyo', () => {
  const equipo = { exists: jest.fn() };
  const supervisores = { exists: jest.fn() };
  const reflector = { get: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
  const guard = new AlcanceProyectoGuard(
    reflector,
    equipo as unknown as Repository<ProyectoEquipo>,
    supervisores as unknown as Repository<ProyectoSupervisor>,
  );

  beforeEach(() => {
    equipo.exists.mockReset();
    supervisores.exists.mockReset();
  });

  it('el Administrador entra a cualquier proyecto sin consultar nada', async () => {
    await expect(guard.canActivate(contexto(RolUsuario.ADMINISTRADOR))).resolves.toBe(true);
    expect(equipo.exists).not.toHaveBeenCalled();
    expect(supervisores.exists).not.toHaveBeenCalled();
  });

  it('el Técnico asignado (sin fecha de retiro) pasa, y solo se consulta el equipo', async () => {
    equipo.exists.mockResolvedValue(true);
    await expect(guard.canActivate(contexto(RolUsuario.TECNICO))).resolves.toBe(true);
    expect(equipo.exists).toHaveBeenCalledWith({
      where: expect.objectContaining({ proyectoId: PROYECTO, usuarioId: 'u-1' }),
    });
    expect(supervisores.exists).not.toHaveBeenCalled();
  });

  it('CP-23: el Técnico no asignado o retirado recibe 403', async () => {
    equipo.exists.mockResolvedValue(false);
    await expect(guard.canActivate(contexto(RolUsuario.TECNICO))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el Supervisor que supervisa el proyecto pasa, y solo se consulta la supervisión', async () => {
    supervisores.exists.mockResolvedValue(true);
    await expect(guard.canActivate(contexto(RolUsuario.SUPERVISOR))).resolves.toBe(true);
    expect(supervisores.exists).toHaveBeenCalledWith({
      where: expect.objectContaining({ proyectoId: PROYECTO, usuarioId: 'u-1' }),
    });
    expect(equipo.exists).not.toHaveBeenCalled();
  });

  it('el Supervisor que no supervisa el proyecto (o fue retirado) recibe 403', async () => {
    supervisores.exists.mockResolvedValue(false);
    await expect(guard.canActivate(contexto(RolUsuario.SUPERVISOR))).rejects.toThrow('No supervisas este proyecto.');
  });

  it('un id mal formado no se consulta: lo rechaza después el pipe con 400', async () => {
    await expect(guard.canActivate(contexto(RolUsuario.SUPERVISOR, { id: 'no-es-uuid' }))).resolves.toBe(true);
    expect(supervisores.exists).not.toHaveBeenCalled();
  });
});