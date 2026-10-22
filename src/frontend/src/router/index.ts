import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from '@/layouts/MainLayout.vue';
import { useAuthStore, type Rol } from '@/stores/auth';
import { MODULOS } from './modulos';

declare module 'vue-router' {
  interface RouteMeta {
    titulo?: string;
    descripcion?: string;
    roles?: readonly Rol[];
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: MainLayout,
      redirect: { name: 'dashboard' },
      children: MODULOS.map((m) => ({
        path: m.path,
        name: m.name,
        component: m.component,
        meta: { titulo: m.titulo, descripcion: m.descripcion, roles: m.roles },
      })),
    },
    { path: '/:pathMatch(.*)*', redirect: { name: 'dashboard' } },
  ],
});

// Ocultar el menú no basta: también se bloquea el acceso directo por URL
router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!auth.tieneAcceso(to.meta.roles)) return { name: 'dashboard' };
});
