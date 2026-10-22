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
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
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
          meta: { titulo: 'Nuevo proyecto', roles: ['director'], encabezado: false },
        },
        {
          path: 'proyectos/:id',
          name: 'detalle-proyecto',
          component: () => import('@/views/Proyectos/DetalleProyectoView.vue'),
          props: true,
          meta: { titulo: 'Detalle del proyecto', roles: ['director', 'tecnico'], encabezado: false },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: { name: 'dashboard' } },
  ],
});

// Ocultar el menú no basta: también se bloquea el acceso directo por URL
router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!auth.tieneAcceso(to.meta.roles)) return { name: 'dashboard' };
});
