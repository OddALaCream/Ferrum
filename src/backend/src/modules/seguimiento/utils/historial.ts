import type { AvanceVista } from '../avances.types';

/**
 * SGP-116: línea de tiempo de un avance. Se arma con la bitácora (cada cambio de estado con quién y cuándo,
 * incluida la observación aunque después lo aprueben) y con las evidencias (adjuntadas, versiones y anulaciones).
 */
export type TipoEvento =
  | 'REGISTRADO'
  | 'CORREGIDO'
  | 'ENVIADO'
  | 'REENVIADO'
  | 'OBSERVADO'
  | 'APROBADO'
  | 'ANULADO'
  | 'EVIDENCIA_ADJUNTADA'
  | 'EVIDENCIA_VERSION'
  | 'EVIDENCIA_ANULADA';

export interface EventoHistorial {
  tipo: TipoEvento;
  fecha: string;
  usuario: { id: string; nombre: string } | null;
  /** Observación, motivo de anulación, cambios corregidos o nombre de la evidencia. */
  detalle: string | null;
  evidenciaId: string | null;
}

/** Una fila de `audit_log` de un avance. */
export interface RegistroBitacora {
  accion: string;
  fecha: Date | string;
  usuarioId: string | null;
  anterior: Record<string, unknown> | null;
  nuevo: Record<string, unknown> | null;
}

/** Orden dentro del mismo instante: primero se registra, luego se adjunta, luego se envía. */
const PRIORIDAD: Record<TipoEvento, number> = {
  REGISTRADO: 0,
  CORREGIDO: 1,
  EVIDENCIA_ADJUNTADA: 2,
  EVIDENCIA_VERSION: 2,
  ENVIADO: 3,
  REENVIADO: 3,
  EVIDENCIA_ANULADA: 4,
  OBSERVADO: 5,
  APROBADO: 5,
  ANULADO: 5,
};

const iso = (f: Date | string) => new Date(f).toISOString();

function cambiosCorregidos(anterior: Record<string, unknown> | null, nuevo: Record<string, unknown>, unidad: string | null): string | null {
  const partes: string[] = [];
  if ('valor_reportado' in nuevo) {
    const antes = anterior?.valor_reportado;
    const u = unidad ? ` ${unidad}` : '';
    partes.push(antes == null ? `valor: ${Number(nuevo.valor_reportado)}${u}` : `valor: ${Number(antes)} → ${Number(nuevo.valor_reportado)}${u}`);
  }
  if ('fecha_corte' in nuevo) partes.push('fecha de corte cambiada');
  if ('descripcion' in nuevo) partes.push('descripción actualizada');
  return partes.length ? partes.join(' · ') : null;
}

export function eventosDeAvance(
  avance: AvanceVista,
  registros: readonly RegistroBitacora[],
  nombres: ReadonlyMap<string, string>,
): EventoHistorial[] {
  const quien = (id: string | null | undefined) => (id ? { id, nombre: nombres.get(id) ?? '' } : null);
  const eventos: EventoHistorial[] = [];
  const agregar = (tipo: TipoEvento, fecha: Date | string, usuarioId: string | null | undefined, detalle: string | null = null, evidenciaId: string | null = null) =>
    eventos.push({ tipo, fecha: iso(fecha), usuario: quien(usuarioId), detalle, evidenciaId });

  const ordenados = [...registros].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  let fueObservado = false;
  for (const r of ordenados) {
    if (r.accion === 'CREAR') {
      const valor = r.nuevo?.valor_reportado;
      agregar('REGISTRADO', r.fecha, r.usuarioId, valor == null ? null : `${Number(valor)}${avance.objetivo.unidad ? ` ${avance.objetivo.unidad}` : ''}`);
      continue;
    }
    if (r.accion !== 'ACTUALIZAR' || !r.nuevo) continue;
    const estado = r.nuevo.estado as string | undefined;
    if (estado && estado !== r.anterior?.estado) {
      if (estado === 'ENVIADO') agregar(fueObservado ? 'REENVIADO' : 'ENVIADO', r.fecha, r.usuarioId);
      else if (estado === 'OBSERVADO') {
        fueObservado = true;
        agregar('OBSERVADO', r.fecha, r.usuarioId, (r.nuevo.observacion as string | undefined) ?? null);
      } else if (estado === 'APROBADO' || estado === 'ANULADO') agregar(estado, r.fecha, r.usuarioId);
      continue;
    }
    const corregido = cambiosCorregidos(r.anterior, r.nuevo, avance.objetivo.unidad);
    if (corregido) agregar('CORREGIDO', r.fecha, r.usuarioId, corregido);
  }

  // Si la bitácora no tiene algo (p. ej. datos cargados por SQL), se completa con lo que guarda el avance.
  const hay = (tipo: TipoEvento) => eventos.some((e) => e.tipo === tipo);
  if (!hay('REGISTRADO')) agregar('REGISTRADO', avance.createdAt, avance.autor.id);
  if (avance.estado !== 'BORRADOR' && avance.enviadoAt && !hay('ENVIADO') && !hay('REENVIADO')) agregar('ENVIADO', avance.enviadoAt, avance.autor.id);
  if ((avance.estado === 'APROBADO' || avance.estado === 'OBSERVADO') && avance.revisadoAt && !hay(avance.estado)) {
    agregar(avance.estado, avance.revisadoAt, avance.revisadoPor?.id, avance.estado === 'OBSERVADO' ? avance.observacion : null);
  }

  for (const e of avance.evidencias) {
    agregar(e.reemplazaA ? 'EVIDENCIA_VERSION' : 'EVIDENCIA_ADJUNTADA', e.createdAt, e.subidoPorId, e.reemplazaA ? `${e.nombreOriginal} (v${e.version})` : e.nombreOriginal, e.id);
    if (e.anulacion) agregar('EVIDENCIA_ANULADA', e.anulacion.at, e.anulacion.por.id, `${e.nombreOriginal}: ${e.anulacion.motivo}`, e.id);
  }

  return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha) || PRIORIDAD[a.tipo] - PRIORIDAD[b.tipo]);
}