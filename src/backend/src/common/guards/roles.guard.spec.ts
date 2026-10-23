import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolUsuario } from '../../modules/proyectos/entities/usuario.entity';
import { RolesGuard } from './roles.guard';

function contexto(rol?: RolUsuario): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: rol ? { rol } : undefined }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector & { getAllAndOverride: jest.Mock };
  const guard = new RolesGuard(reflector);

  it('deja pasar si la ruta no declara roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contexto(RolUsuario.TECNICO))).toBe(true);
  });

  it('deja pasar al rol permitido y responde 403 a los demás', () => {
    reflector.getAllAndOverride.mockReturnValue([RolUsuario.ADMINISTRADOR]);
    expect(guard.canActivate(contexto(RolUsuario.ADMINISTRADOR))).toBe(true);
    expect(() => guard.canActivate(contexto(RolUsuario.TECNICO))).toThrow(ForbiddenException);
  });
});