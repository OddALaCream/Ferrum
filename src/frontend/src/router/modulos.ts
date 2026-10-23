import type { RouteComponent } from 'vue-router';
import type { Rol } from '@/stores/auth';

export interface Modulo {
  name: string;
  path: string;
  titulo: string;
  descripcion: string;
  icono: string;
  /** Roles con acceso; si se omite, el módulo es visible para todos. */
  roles?: readonly Rol[];
  component: () => Promise<RouteComponent>;
}

export const MODULOS: readonly Modulo[] = [
  {
    name: 'dashboard',
    path: 'dashboard',
    titulo: 'Dashboard',
    descripcion: 'Resumen general del avance de los proyectos.',
    icono: 'pi pi-chart-bar',
    component: () => import('@/views/DashboardView.vue'),
  },
  {
    name: 'marco-logico',
    path: 'marco-logico',
    titulo: 'Marco Lógico',
    descripcion: 'Objetivos, resultados, indicadores y supuestos del proyecto.',
    icono: 'pi pi-sitemap',
    roles: ['administrador'],
    component: () => import('@/views/MarcoLogicoView.vue'),
  },
  {
    name: 'cronograma',
    path: 'cronograma',
    titulo: 'Cronograma y Actividades',
    descripcion: 'Planificación y seguimiento de las actividades programadas.',
    icono: 'pi pi-calendar',
    roles: ['tecnico', 'administrador'],
    component: () => import('@/views/CronogramaView.vue'),
  },
  {
    name: 'desembolsos',
    path: 'desembolsos',
    titulo: 'Finanzas y Desembolsos',
    descripcion: 'Control presupuestario y registro de desembolsos.',
    icono: 'pi pi-dollar',
    roles: ['supervisor', 'administrador'],
    component: () => import('@/views/DesembolsosView.vue'),
  },
  {
    name: 'reportes',
    path: 'reportes',
    titulo: 'Reportes',
    descripcion: 'Generación y descarga de informes del proyecto.',
    icono: 'pi pi-file-pdf',
    component: () => import('@/views/ReportesView.vue'),
  },
  {
    name: 'bitacora',
    path: 'bitacora',
    titulo: 'Bitácora',
    descripcion: 'Registro inalterable de quién modificó qué y cuándo (RF-34).',
    icono: 'pi pi-history',
    roles: ['administrador'],
    component: () => import('@/views/Bitacora/BitacoraView.vue'),
  },
];