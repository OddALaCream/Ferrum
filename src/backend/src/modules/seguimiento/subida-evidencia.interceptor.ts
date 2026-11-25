import { CallHandler, ExecutionContext, Injectable, NestInterceptor, PayloadTooLargeException, Type } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Observable } from 'rxjs';
import { TAMANO_MAXIMO } from './utils/archivo';

/** Interceptor de multer: un solo archivo en el campo "archivo", en memoria y con el tope de 25 MB. */
const Multer: Type<NestInterceptor> = FileInterceptor('archivo', { limits: { fileSize: TAMANO_MAXIMO, files: 1 } });

/** Igual que FileInterceptor, pero el archivo demasiado grande responde 413 con un mensaje en español. */
@Injectable()
export class SubidaEvidenciaInterceptor implements NestInterceptor {
  private readonly multer = new Multer();

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try {
      return await this.multer.intercept(context, next);
    } catch (e) {
      if (e instanceof PayloadTooLargeException) {
        throw new PayloadTooLargeException('El archivo supera el máximo de 25 MB.');
      }
      throw e;
    }
  }
}