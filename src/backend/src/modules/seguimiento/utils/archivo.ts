import { createHash } from 'node:crypto';

/** Archivo recibido en una subida multipart (lo que entrega multer en memoria). */
export interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Máximo por archivo: 25 MB (RN-04, igual que el CHECK de `evidencias.tamano_bytes`). */
export const TAMANO_MAXIMO = 25 * 1024 * 1024;

/** Tipos de evidencia admitidos (los mismos que permite la base de datos). */
export const TIPOS_ADMITIDOS = {
  'application/pdf': { extension: 'pdf', nombre: 'PDF' },
  'image/jpeg': { extension: 'jpg', nombre: 'JPG' },
  'image/png': { extension: 'png', nombre: 'PNG' },
  'image/webp': { extension: 'webp', nombre: 'WEBP' },
} as const;
export type MimeAdmitido = keyof typeof TIPOS_ADMITIDOS;

export const LISTA_TIPOS = Object.values(TIPOS_ADMITIDOS).map((t) => t.nombre).join(', ');

/**
 * Tipo real del archivo según sus primeros bytes (su "firma"), sin confiar en la extensión ni en lo que dice el navegador.
 * Devuelve null si no es uno de los tipos admitidos.
 */
export function detectarTipo(contenido: Buffer): MimeAdmitido | null {
  const empieza = (bytes: number[], desde = 0) => bytes.every((b, i) => contenido[desde + i] === b);
  if (contenido.length >= 5 && contenido.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (empieza([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (empieza([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (contenido.length >= 12 && contenido.subarray(0, 4).toString('latin1') === 'RIFF' && contenido.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/** Motivo por el que se rechaza un archivo, o null si se acepta. */
export function motivoRechazo(archivo: ArchivoSubido | undefined): string | null {
  if (!archivo || archivo.size === 0) return 'Adjunta un archivo: el campo "archivo" llegó vacío.';
  if (archivo.size > TAMANO_MAXIMO) {
    return `El archivo pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB y el máximo es 25 MB.`;
  }
  if (!detectarTipo(archivo.buffer)) {
    return `El archivo "${archivo.originalname}" no es de un tipo admitido. Solo se aceptan ${LISTA_TIPOS}.`;
  }
  return null;
}

export const sha256 = (contenido: Buffer): string => createHash('sha256').update(contenido).digest('hex');

/**
 * Nombre original limpio para guardar y mostrar: sin rutas ni caracteres de control, y como mucho 255 caracteres.
 * multer entrega el nombre en latin1; se pasa a UTF-8 para conservar tildes y eñes.
 */
export function nombreLimpio(original: string): string {
  const utf8 = Buffer.from(original, 'latin1').toString('utf8');
  const nombre = (utf8.includes('�') ? original : utf8)
    .split(/[\\/]/)
    .pop()!
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return (nombre || 'evidencia').slice(0, 255);
}