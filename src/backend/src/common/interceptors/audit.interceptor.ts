import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { isIP } from 'node:net';
import { Observable } from 'rxjs';
import { ContextoAuditoria, DatosPeticion } from '../../modules/auditoria/contexto-auditoria';

const METODOS_ESCRITURA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER_AGENT_MAX = 300;

/** Forma mínima del usuario que dejará el JwtAuthGuard en `req.user` (SGP-4). */
interface UsuarioPeticion {
  id?: string;
  sub?: string;
  email?: string;
}

/** IP válida o `null`; una IPv4 mapeada en IPv6 (`::ffff:10.0.0.1`) se guarda como IPv4. */
export function normalizarIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : null;
  if (v4 && isIP(v4) === 4) return v4;
  return isIP(ip) ? ip : null;
}

export function datosDePeticion(req: Request): DatosPeticion {
  const usuario = (req as Request & { user?: UsuarioPeticion }).user;
  const usuarioId = usuario?.id ?? usuario?.sub ?? null;
  const ip = normalizarIp(req.ip);
  const userAgent = req.get('user-agent')?.slice(0, USER_AGENT_MAX) ?? null;
  return {
    usuarioId: usuarioId && UUID.test(usuarioId) ? usuarioId : null,
    usuarioEmail: usuario?.email ?? null,
    ip,
    userAgent,
  };
}

/**
 * RF-34 / SGP-58: en toda petición de escritura deja disponibles usuario, IP y user-agent
 * para que el AuditSubscriber registre cada cambio en la misma transacción de la operación.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly contexto: ContextoAuditoria) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Request>();
    if (!METODOS_ESCRITURA.has(req.method)) return next.handle();

    const datos = datosDePeticion(req);
    // next.handle() se invoca dentro del contexto para que el handler herede el AsyncLocalStorage
    return new Observable((suscriptor) =>
      this.contexto.ejecutar(datos, () => next.handle().subscribe(suscriptor)),
    );
  }
}
