import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import { afterEach, describe, expect, it } from 'vitest';
import { router } from '@/router';
import type { Rol } from '@/stores/auth';
import { sesionDePrueba } from '@/test/helpers/sesion';
import MainLayout from './MainLayout.vue';

const TODOS = ['dashboard', 'proyectos', 'cronograma', 'desembolsos', 'reportes', 'usuarios', 'bitacora'];

let wrapper: VueWrapper | undefined;

async function montarComo(role: Rol) {
  const pinia = createPinia();
  setActivePinia(pinia);
  sesionDePrueba(role);
  await router.push('/dashboard');
  wrapper = mount(MainLayout, {
    global: {
      plugins: [pinia, router, PrimeVue, ToastService],
      directives: { tooltip: {} },
      stubs: { Menu: true },
    },
  });
  return TODOS.filter((m) => wrapper!.find(`[data-test="menu-${m}"]`).exists());
}

describe('MainLayout', () => {
  // El router singleton ejecuta los guards con la pinia de la primera app instalada
  afterEach(() => wrapper?.unmount());

  it('muestra todos los módulos al administrador', async () => {
    expect(await montarComo('administrador')).toEqual(TODOS);
  });

  it('al técnico solo le muestra lo que necesita para cumplir: Dashboard, Proyectos y Cronograma', async () => {
    expect(await montarComo('tecnico')).toEqual(['dashboard', 'proyectos', 'cronograma']);
  });

  it('al supervisor le muestra Dashboard, Proyectos, Cronograma y Reportes; sin Finanzas, Usuarios ni Bitácora', async () => {
    expect(await montarComo('supervisor')).toEqual(['dashboard', 'proyectos', 'cronograma', 'reportes']);
  });

  it('Finanzas es solo del Administrador: el Supervisor no entra ni por URL', async () => {
    await montarComo('supervisor');
    await router.push('/desembolsos');
    expect(router.currentRoute.value.name).toBe('dashboard');
  });

  it('Reportes es del Administrador y el Supervisor: el Técnico no entra ni por URL', async () => {
    await montarComo('tecnico');
    await router.push('/reportes');
    expect(router.currentRoute.value.name).toBe('dashboard');
  });

  it('la Bitácora solo la ve el Administrador y se bloquea por URL para los demás', async () => {
    expect(await montarComo('supervisor')).not.toContain('bitacora');
    await router.push('/bitacora');
    expect(router.currentRoute.value.name).toBe('dashboard');
  });

  it('bloquea por URL un módulo sin permiso', async () => {
    await montarComo('tecnico');
    await router.push('/desembolsos');
    expect(router.currentRoute.value.name).toBe('dashboard');
  });
});