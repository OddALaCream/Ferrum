import type { ObjectLiteral } from 'typeorm';

/** Acciones que se registran en `audit_log.accion`. */
export const ACCIONES_AUDITORIA = ['CREAR', 'ACTUALIZAR', 'ELIMINAR'] as const;
export type AccionAuditoria = (typeof ACCIONES_AUDITORIA)[number];

/** Lo mínimo que se usa de ColumnMetadata / EntityMetadata de TypeORM (facilita las pruebas). */
export interface ColumnaAuditable {
  databaseName: string;
  getEntityValue(entidad: ObjectLiteral): unknown;
}

export interface MetadataAuditable {
  tableName: string;
  columns: readonly ColumnaAuditable[];
  primaryColumns: readonly ColumnaAuditable[];
}

export type Valores = Record<string, unknown>;

/** Tablas que no se auditan: la propia bitácora y los tokens de sesión (solo hashes, sin valor de negocio). */
export const TABLAS_EXCLUIDAS = new Set(['audit_log', 'refresh_tokens', 'password_reset_tokens']);

const CAMPO_SENSIBLE = /password|token|secret/i;
export const REDACTADO = '[REDACTADO]';

function aJson(valor: unknown): unknown {
  if (valor instanceof Date) return valor.toISOString();
  if (Buffer.isBuffer(valor)) return '[binario]';
  if (typeof valor === 'bigint') return valor.toString();
  return valor;
}

function leer(columna: ColumnaAuditable, entidad: ObjectLiteral | undefined): unknown {
  if (!entidad) return undefined;
  const valor = columna.getEntityValue(entidad);
  return valor === undefined ? undefined : aJson(valor);
}

function protegido(columna: string, valor: unknown): unknown {
  return CAMPO_SENSIBLE.test(columna) && valor !== null ? REDACTADO : valor;
}

/** Todas las columnas de la entidad, con su nombre en la BD y los campos sensibles ocultos. */
export function instantanea(meta: MetadataAuditable, entidad: ObjectLiteral | undefined): Valores | null {
  if (!entidad) return null;
  const valores: Valores = {};
  for (const columna of meta.columns) {
    const valor = leer(columna, entidad);
    if (valor !== undefined && !(columna.databaseName in valores)) {
      valores[columna.databaseName] = protegido(columna.databaseName, valor);
    }
  }
  return valores;
}

/** Solo las columnas que cambiaron, con su valor anterior y nuevo; `null` si no cambió nada. */
export function diferencias(
  columnas: readonly ColumnaAuditable[],
  antes: ObjectLiteral | undefined,
  despues: ObjectLiteral | undefined,
): { anterior: Valores; nuevo: Valores } | null {
  const anterior: Valores = {};
  const nuevo: Valores = {};
  for (const columna of columnas) {
    const nombre = columna.databaseName;
    if (nombre in nuevo) continue;
    const a = leer(columna, antes) ?? null;
    const b = leer(columna, despues) ?? null;
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    anterior[nombre] = protegido(nombre, a);
    nuevo[nombre] = protegido(nombre, b);
  }
  return Object.keys(nuevo).length ? { anterior, nuevo } : null;
}

/** Clave primaria como texto (varchar(64) en la BD); `null` si no se conoce. */
export function idEntidad(meta: MetadataAuditable, ...candidatas: (ObjectLiteral | undefined)[]): string | null {
  for (const entidad of candidatas) {
    const partes = meta.primaryColumns.map((c) => leer(c, entidad));
    if (partes.length && partes.every((p) => p !== undefined && p !== null)) {
      return partes.map(String).join(',').slice(0, 64);
    }
  }
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Proyecto al que pertenece el cambio: el propio proyecto o su columna `proyecto_id`. */
export function proyectoDe(meta: MetadataAuditable, ...candidatas: (ObjectLiteral | undefined)[]): string | null {
  const nombre = meta.tableName === 'proyectos' ? 'id' : 'proyecto_id';
  const columna = meta.columns.find((c) => c.databaseName === nombre);
  if (!columna) return null;
  for (const entidad of candidatas) {
    const valor = leer(columna, entidad);
    if (typeof valor === 'string' && UUID.test(valor)) return valor;
  }
  return null;
}
