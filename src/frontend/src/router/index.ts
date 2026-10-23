import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from '@/layouts/MainLayout.vue';
import { useAuthStore, type Rol } from '@/stores/auth';
import { MODULOS } from './modulos';

declare module 'vue-router' {
  interface RouteMeta {
    titulo?: string;
    descripcion?: string;
    roles?: readonly Rol[];
    /** `false` cuando la vista dibuja su propio título dentro del contenido. */
    encabezado?: boolean;
    /** Accesible sin sesión (solo el login). */
    publica?: boolean;
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { titulo: 'Iniciar sesión', publica: true },
    },
    {
      path: '/',
      component: MainLayout,
      redirect: { name: 'dashboard' },
      children: [
        ...MODULOS.map((m) => ({
          path: m.path,
          name: m.name,
          component: m.component,
          meta: { titulo: m.titulo, descripcion: m.descripcion, roles: m.roles },
        })),
        {
          path: 'proyectos/nuevo',
          name: 'crear-proyecto',
          component: () => import('@/views/Proyectos/CrearProyectoView.vue'),
          meta: { titulo: 'Nuevo proyecto', roles: ['administrador'], encabezado: false },
        },
        {
          path: 'proyectos/:id',
          name: 'detalle-proyecto',
          component: () => import('@/views/Proyectos/DetalleProyectoView.vue'),
          props: true,
          meta: { titulo: 'Detalle del proyecto', roles: ['administrador', 'tecnico'], encabezado: false },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: { name: 'dashboard' } },
  ],
});

const INICIO = ['/', '/dashboard'];

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  // Tras recargar la página, la sesión se recupera con la cookie de refresh antes de decidir
  await auth.restaurarSesion();

  if (to.meta.publica) {
    if (auth.autenticado && to.name === 'login') return { name: 'dashboard' };
    return;
  }
  if (!auth.autenticado) {
    return { name: 'login', query: INICIO.includes(to.path) ? {} : { redirect: to.fullPath } };
  }
  // Ocultar el menú no basta: también se bloquea el acceso directo por URL
  if (!auth.tieneAcceso(to.meta.roles)) return { name: 'dashboard' };
});