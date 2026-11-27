import { http } from './http';

export type EstadoAvance = 'BORRADOR' | 'ENVIADO' | 'APROBADO' | 'OBSERVADO' | 'ANULADO';

export interface Evidencia {
  id: string;
  /** SGP-136: número de versión y la evidencia que corrige (null en la primera). */
  version: number;
  reemplazaA: string | null;
  /** false si ya hay una versión más nueva: queda en el historial. */
  vigente: boolean;
  nombreOriginal: string;
  mime: string;
  tamanoBytes: number;
  sha256: string;
  subidoPorId: string;
  createdAt: string;
  /** SGP-135: si el Administrador la anuló, cuándo, quién y por qué. El archivo se sigue pudiendo abrir. */
  anulacion: { at: string; por: { id: string; nombre: string }; motivo: string } | null;
}

export interface Avance {
  id: string;
  /** Proyecto al que pertenece (la bandeja de revisión junta varios proyectos). */
  proyecto: { id: string; codigo: string; nombre: string };
  /** A qué aporta: un indicador (I.O.V.) o una actividad. */
  objetivo: { tipo: 'IOV' | 'ACTIVIDAD'; id: string; codigo: string; nombre: string; unidad: string | null };
  autor: { id: string; nombre: string };
  valorReportado: number | null;
  fechaCorte: string;
  descripcion: string | null;
  estado: EstadoAvance;
  enviadoAt: string | null;
  observacion: string | null;
  /** Quién lo aprobó u observó, y cuándo. */
  revisadoPor: { id: string; nombre: string } | null;
  revisadoAt: string | null;
  createdAt: string;
  updatedAt: string;
  evidencias: Evidencia[];
}

export interface NuevoAvance {
  iovId?: string;
  actividadId?: string;
  valorReportado?: number;
  fechaCorte: string;
  descripcion?: string;
}

/** Tipos y tamaño que acepta el servidor (RN-04). Se revisan también aquí para avisar antes de subir. */
export const TAMANO_MAXIMO = 25 * 1024 * 1024;
export const EXTENSIONES_ADMITIDAS = '.pdf,.jpg,.jpeg,.png,.webp';
const MIMES_ADMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/** Motivo por el que un archivo no se puede adjuntar, o null si se puede. */
export function motivoArchivoInvalido(archivo: File): string | null {
  if (archivo.size === 0) return `"${archivo.name}" está vacío.`;
  if (archivo.size > TAMANO_MAXIMO) {
    return `"${archivo.name}" pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB y el máximo es 25 MB.`;
  }
  const extension = archivo.name.toLowerCase().split('.').pop() ?? '';
  if (!MIMES_ADMITIDOS.includes(archivo.type) && !['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    return `"${archivo.name}" no es de un tipo admitido. Solo se aceptan PDF, JPG, PNG y WEBP.`;
  }
  return null;
}

const base = (proyectoId: string) => `/proyectos/${proyectoId}/avances`;

/** El Técnico recibe sus avances (también borradores); Administrador y Supervisor, los enviados en adelante. */
export async function listarAvances(proyectoId: string, filtro: { iovId?: string; actividadId?: string } = {}): Promise<Avance[]> {
  const { data } = await http.get<Avance[]>(base(proyectoId), { params: filtro });
  return data;
}

export async function crearAvance(proyectoId: string, dto: NuevoAvance): Promise<Avance> {
  const { data } = await http.post<Avance>(base(proyectoId), dto);
  return data;
}

export async function editarAvance(
  proyectoId: string,
  avanceId: string,
  dto: Partial<Pick<NuevoAvance, 'valorReportado' | 'fechaCorte' | 'descripcion'>>,
): Promise<Avance> {
  const { data } = await http.patch<Avance>(`${base(proyectoId)}/${avanceId}`, dto);
  return data;
}

export async function eliminarAvance(proyectoId: string, avanceId: string): Promise<void> {
  await http.delete(`${base(proyectoId)}/${avanceId}`);
}

export async function subirEvidencia(proyectoId: string, avanceId: string, archivo: File): Promise<Evidencia> {
  const datos = new FormData();
  datos.append('archivo', archivo);
  // Un archivo de 25 MB puede tardar más que el límite normal de 15 s
  const { data } = await http.post<Evidencia>(`${base(proyectoId)}/${avanceId}/evidencias`, datos, { timeout: 120_000 });
  return data;
}

export async function eliminarEvidencia(proyectoId: string, avanceId: string, evidenciaId: string): Promise<void> {
  await http.delete(`${base(proyectoId)}/${avanceId}/evidencias/${evidenciaId}`);
}

/** Enlace temporal (5 minutos) para abrir o descargar la evidencia. */
export async function urlEvidencia(proyectoId: string, avanceId: string, evidenciaId: string): Promise<string> {
  const { data } = await http.get<{ url: string }>(`${base(proyectoId)}/${avanceId}/evidencias/${evidenciaId}/descarga`);
  return data.url;
}

/** Envía el avance a revisión. Sin al menos una evidencia, el servidor lo rechaza. */
export async function enviarAvance(proyectoId: string, avanceId: string): Promise<Avance> {
  const { data } = await http.post<Avance>(`${base(proyectoId)}/${avanceId}/enviar`);
  return data;
}

/** SGP-94: el Administrador aprueba un avance enviado; desde ahí cuenta para el cumplimiento. */
export async function aprobarAvance(proyectoId: string, avanceId: string): Promise<Avance> {
  const { data } = await http.patch<Avance>(`${base(proyectoId)}/${avanceId}/aprobar`);
  return data;
}

/** SGP-94: el Administrador observa un avance enviado; vuelve al técnico con la observación. */
export async function observarAvance(proyectoId: string, avanceId: string, observacion: string): Promise<Avance> {
  const { data } = await http.patch<Avance>(`${base(proyectoId)}/${avanceId}/observar`, { observacion });
  return data;
}

/** SGP-135 / CP-19: el Administrador anula una evidencia con motivo; el archivo original se conserva. */
export async function anularEvidencia(proyectoId: string, avanceId: string, evidenciaId: string, motivo: string): Promise<Evidencia> {
  const { data } = await http.patch<Evidencia>(`${base(proyectoId)}/${avanceId}/evidencias/${evidenciaId}/anular`, { motivo });
  return data;
}

/** Evidencias que todavía sirven de prueba: ni anuladas ni reemplazadas por una versión más nueva. */
export function evidenciasValidas(avance: Pick<Avance, 'evidencias'>): Evidencia[] {
  return avance.evidencias.filter((e) => !e.anulacion && e.vigente);
}

/** SGP-136: corrige una evidencia ya enviada (avance observado) con una nueva versión. */
export async function subirVersion(proyectoId: string, avanceId: string, evidenciaId: string, archivo: File): Promise<Evidencia> {
  const datos = new FormData();
  datos.append('archivo', archivo);
  const { data } = await http.post<Evidencia>(`${base(proyectoId)}/${avanceId}/evidencias/${evidenciaId}/versiones`, datos, { timeout: 120_000 });
  return data;
}

/** SGP-96: avances enviados de todos los proyectos abiertos, del más antiguo al más reciente. */
export async function listarBandeja(): Promise<Avance[]> {
  const { data } = await http.get<Avance[]>('/avances/revision');
  return data;
}

export function formatoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}