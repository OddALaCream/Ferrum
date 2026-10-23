import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

/** Quién hizo la petición de escritura y desde dónde (RF-34). */
export interface DatosPeticion {
  usuarioId: string | null;
  usuarioEmail: string | null;
  ip: string | null;
  userAgent: string | null;
}

/**
 * Lleva los datos de la petición HTTP en curso hasta el AuditSubscriber de TypeORM,
 * que no tiene acceso al objeto Request. Lo llena el AuditInterceptor.
 */
@Injectable()
export class ContextoAuditoria {
  private readonly almacen = new AsyncLocalStorage<DatosPeticion>();

  ejecutar<T>(datos: DatosPeticion, fn: () => T): T {
    return this.almacen.run(datos, fn);
  }

  /** `undefined` fuera de una petición HTTP (seeds, tareas programadas…). */
  actual(): DatosPeticion | undefined {
    return this.almacen.getStore();
  }
}
