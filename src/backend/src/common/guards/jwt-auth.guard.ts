import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ES_PUBLICO } from '../decorators/public.decorator';

/** Guard global: toda ruta exige un access token válido salvo las marcadas con @Public. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const publico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [
      context.getHandler(),
      context.getClass(),
    ]);
    return publico ? true : super.canActivate(context);
  }

  override handleRequest<T>(err: unknown, user: T | false): T {
    if (err || !user) {
      throw err instanceof UnauthorizedException
        ? err
        : new UnauthorizedException('Tu sesión expiró o no es válida. Inicia sesión de nuevo.');
    }
    return user;
  }
}