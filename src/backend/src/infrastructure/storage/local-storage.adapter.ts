import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { constants, createReadStream, type ReadStream } from 'node:fs';
import { access, mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, resolve, sep } from 'node:path';
import { StorageAdapter } from './storage.adapter';

/** Ruta del controlador que entrega los archivos (relativa: funciona con el proxy de Vite y con Nginx). */
export const RUTA_DESCARGA = '/api/almacen/archivo';

const TIPOS: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Almacenamiento en una carpeta del servidor (STORAGE_DRIVER=local). Para desarrollo y para la demo:
 * no hay que instalar nada. Cumple el mismo contrato que MinIO/S3 (ADR-003): los archivos no son públicos
 * y se descargan con un enlace firmado que vence, igual que una URL prefirmada de S3.
 */
@Injectable()
export class LocalStorageAdapter extends StorageAdapter {
  readonly raiz: string;
  private readonly clave: Buffer;

  constructor(config: ConfigService) {
    super();
    const carpeta = config.get<string>('STORAGE_DIR', './almacen');
    this.raiz = isAbsolute(carpeta) ? carpeta : resolve(process.cwd(), carpeta);
    // Clave propia para firmar los enlaces, derivada del secreto JWT (no hace falta otra variable)
    this.clave = createHmac('sha256', config.getOrThrow<string>('JWT_ACCESS_SECRET')).update('sgp-almacen-local').digest();
  }

  /** El tipo no se guarda aparte: al descargar se deduce de la extensión, que elige el sistema (.pdf, .jpg…). */
  async upload(key: string, body: Buffer, _contentType?: string): Promise<void> {
    const ruta = this.ruta(key);
    await mkdir(dirname(ruta), { recursive: true });
    await writeFile(ruta, body, { flag: 'wx' }); // nunca sobrescribe: las evidencias son inmutables
  }

  /** Enlace de descarga firmado que vence (5 minutos por defecto). */
  async presignedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
    this.ruta(key);
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const q = new URLSearchParams({ k: key, exp: String(exp), sig: this.firma(key, exp) });
    return `${RUTA_DESCARGA}?${q.toString()}`;
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(this.ruta(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }

  /** Comprueba que la carpeta exista (la crea si falta) y que se pueda escribir. */
  async ping(): Promise<void> {
    await mkdir(this.raiz, { recursive: true });
    await access(this.raiz, constants.W_OK);
  }

  /** Abre el archivo si la firma es válida y no venció; si no, devuelve null. */
  async abrir(key: string, exp: string, sig: string): Promise<{ stream: ReadStream; tipo: string; tamano: number } | null> {
    const vence = Number(exp);
    if (!key || !Number.isInteger(vence) || vence < Math.floor(Date.now() / 1000)) return null;
    const esperada = Buffer.from(this.firma(key, vence));
    const recibida = Buffer.from(sig ?? '');
    if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
    let ruta: string;
    try {
      ruta = this.ruta(key);
      const info = await stat(ruta);
      if (!info.isFile()) return null;
      return { stream: createReadStream(ruta), tipo: TIPOS[extname(ruta).toLowerCase()] ?? 'application/octet-stream', tamano: info.size };
    } catch {
      return null;
    }
  }

  private firma(key: string, exp: number): string {
    return createHmac('sha256', this.clave).update(`${key}\n${exp}`).digest('base64url');
  }

  /** Ruta dentro de la carpeta. Rechaza nombres raros o que intenten salir de ella ("../"). */
  private ruta(key: string): string {
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(key) || key.split('/').includes('..')) {
      throw new Error(`Nombre de archivo no válido: ${key}`);
    }
    const ruta = resolve(this.raiz, key);
    if (!ruta.startsWith(this.raiz + sep)) throw new Error(`Nombre de archivo no válido: ${key}`);
    return ruta;
  }
}