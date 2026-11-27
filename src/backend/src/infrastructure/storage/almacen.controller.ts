import { Controller, Get, NotFoundException, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { LocalStorageAdapter } from './local-storage.adapter';
import { StorageAdapter } from './storage.adapter';

/**
 * Entrega los archivos del almacenamiento local. No pide sesión porque el enlace ya va firmado y vence
 * (como una URL prefirmada de S3): solo lo recibe quien pudo ver la evidencia. Con S3/MinIO responde 404.
 */
@ApiExcludeController()
@Controller('almacen')
export class AlmacenController {
  constructor(private readonly storage: StorageAdapter) {}

  @Public()
  @Get('archivo')
  async archivo(
    @Query('k') key: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!(this.storage instanceof LocalStorageAdapter)) throw new NotFoundException();
    const archivo = await this.storage.abrir(key, exp, sig);
    if (!archivo) throw new NotFoundException('El enlace no es válido o ya venció. Vuelve a abrir la evidencia desde el sistema.');
    res.setHeader('Content-Type', archivo.tipo);
    res.setHeader('Content-Length', String(archivo.tamano));
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store');
    archivo.stream.pipe(res);
  }
}