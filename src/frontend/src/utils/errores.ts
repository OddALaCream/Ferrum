import { isAxiosError } from 'axios';
import type { ProblemDetails } from '@/api/proyectos';

/** Texto que explica un error de la API (RFC 7807); si no hay detalle, el mensaje por defecto. */
export function mensajeDeError(e: unknown, porDefecto = 'Inténtalo de nuevo en unos minutos.'): string {
  if (!isAxiosError<ProblemDetails>(e)) return porDefecto;
  if (!e.response) return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  const detalle = e.response.data?.detail;
  return (Array.isArray(detalle) ? detalle.join(' ') : detalle) || porDefecto;
}