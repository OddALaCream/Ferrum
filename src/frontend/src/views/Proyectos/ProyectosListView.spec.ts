import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProyectoResumen } from '@/api/proyectos';
import type { Rol } from '@/stores/auth';
import { sesionDePrueba } from '@/test/helpers/sesion';
import ProyectosListView from './ProyectosListView.vue';

const { listarProyectos, push } = vi.hoisted(() => ({ listarProyectos: vi.fn(), push: vi.fn() }));
vi.mock('@/api/proyectos', async (original) => ({ ...(await original<typeof import('@/api/proyectos')>()), listarProyectos }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push }), useRoute: () => ({ query: {} }) }));

const proyecto = (cambios: Partial<ProyectoResumen> = {}): ProyectoResumen => ({
  id: 'p-1',
  codigo: 'PRY-AGRO-2026',
  nombre: 'Producción agroecológica en Coroico y Yanacachi',
  estado: 'EN_EJECUCION',
  presupuestoTotal: '1850000.00',
  moneda: 'BOB',
  fechaInicio: '2026-09-01',
  fechaFin: '2027-03-31',
  cumplimientoPct: '35.50',
  equipoActivo: 3,
  ...cambios,
});

async function montar(rol: Rol = 'administrador') {
  const pinia = createPinia();
  setActivePinia(pinia);
  sesionDePrueba(rol);
  const wrapper = mount(ProyectosListView, {
    global: {
      plugins: [pinia, PrimeVue, ToastService],
      directives: { tooltip: {} },
      stubs: { RouterLink: { template: '<a><slot :navigate="() => {}" /></a>' } },
    },
  });
  await flushPromises();
  return wrapper;
}

describe('ProyectosListView (RF-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as typeof window.matchMedia;
  });

  it('lista los proyectos con estado, presupuesto y equipo', async () => {
    listarProyectos.mockResolvedValue({ items: [proyecto()], total: 1, page: 1, limit: 10 });
    const wrapper = await montar();

    const texto = wrapper.get('[data-test="tabla-proyectos"]').text();
    expect(texto).toContain('PRY-AGRO-2026');
    expect(texto).toContain('Producción agroecológica');
    expect(texto).toContain('En ejecución');
    expect(texto).toContain('1.850.000,00');
    expect(texto).toContain('36%');
  });

  it('la búsqueda pide la lista otra vez con el texto escrito', async () => {
    listarProyectos.mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 });
    const wrapper = await montar();

    await wrapper.get('[data-test="buscar"]').setValue('agro');
    await new Promise((r) => setTimeout(r, 400));
    await flushPromises();

    expect(listarProyectos).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'agro', page: 1 }));
  });

  it('al hacer clic en el botón del marco lógico va a esa pantalla, sin abrir el detalle', async () => {
    listarProyectos.mockResolvedValue({ items: [proyecto()], total: 1, page: 1, limit: 10 });
    const wrapper = await montar();

    await wrapper.get('[data-test="abrir-marco"]').trigger('click');

    expect(push).toHaveBeenCalledWith({ name: 'marco-logico-proyecto', params: { id: 'p-1' } });
    expect(push).not.toHaveBeenCalledWith({ name: 'detalle-proyecto', params: { id: 'p-1' } });
  });

  it('el Administrador ve "Nuevo proyecto" y el Técnico no', async () => {
    listarProyectos.mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 });
    expect((await montar('administrador')).find('[data-test="nuevo-proyecto"]').exists()).toBe(true);
    expect((await montar('tecnico')).find('[data-test="nuevo-proyecto"]').exists()).toBe(false);
  });

  it('sin proyectos explica qué pasa según el rol', async () => {
    listarProyectos.mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 });
    expect((await montar('administrador')).get('[data-test="vacio"]').text()).toContain('Todavía no hay proyectos');
    expect((await montar('tecnico')).get('[data-test="vacio"]').text()).toContain('no te asignaron a ningún proyecto');
  });
});