import type { EstadoProyecto } from '@/api/proyectos';

interface PresentacionEstado {
  label: string;
  icono: string;
  /** Clases Tailwind del Tag: fondo suave, texto oscuro y contorno del mismo tono. */
  clases: string;
}

export const ESTADOS_PROYECTO: Record<EstadoProyecto, PresentacionEstado> = {
  PLANIFICACION: {
    label: 'Planificación',
    icono: 'pi pi-compass',
    clases: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20',
  },
  EN_EJECUCION: {
    label: 'En ejecución',
    icono: 'pi pi-play',
    clases: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
  },
  PAUSADO: {
    label: 'Pausado',
    icono: 'pi pi-pause',
    clases: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  },
  CERRADO: {
    label: 'Cerrado',
    icono: 'pi pi-lock',
    clases: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20',
  },
};

export const OPCIONES_ESTADO = (Object.keys(ESTADOS_PROYECTO) as EstadoProyecto[]).map((value) => ({
  value,
  ...ESTADOS_PROYECTO[value],
}));
