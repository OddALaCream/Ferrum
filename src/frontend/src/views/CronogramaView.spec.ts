import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatoFecha } from '@/utils/formato';
import { sesionDePrueba } from '@/test/helpers/sesion';
import CronogramaView from './CronogramaView.vue';

const api = vi.hoisted(() => ({ listarProyectos: vi.fn(), obtenerMarcoLogico: vi.fn(), obtenerEquipo: vi.fn() }));
vi.mock('@/api/proyectos', () => ({ listarProyectos: api.listarProyectos }));
vi.mock('@/api/equipo', () => ({ obtenerEquipo: api.obtenerEquipo }));
vi.mock('@/api/marcoLogico', () => ({ obtenerMarcoLogico: api.obtenerMarcoLogico }));
const proyecto = { id: 'p-1', codigo: 'P.1', nombre: 'Proyecto', estado: 'EN_EJECUCION', fechaInicio: '2026-11-01', fechaFin: '2026-12-31' };
const actividad = { id: 'a-1', codigo: 'A.1.3', nombre: 'Cinco talleres', fechaInicio: '2026-11-02', fechaFin: '2026-12-01', estado: 'PENDIENTE', estadoEfectivo: 'PENDIENTE' };
async function montar() {
  const pinia = createPinia();
  setActivePinia(pinia);
  sesionDePrueba('administrador');
  const w = mount(CronogramaView, { global: { plugins: [pinia, PrimeVue], stubs: { Select: true, ActividadItem: true, RouterLink: { template: '<a><slot /></a>' } } } });
  await flushPromises();
  return w;
}
describe('Cronograma (CP-09)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.listarProyectos.mockResolvedValue({ items: [proyecto], total: 1 });
    api.obtenerEquipo.mockResolvedValue([]);
    api.obtenerMarcoLogico.mockResolvedValue({ proyecto, resultados: [{ codigo: 'R.1', actividades: [actividad] }] });
  });
  it('muestra las actividades guardadas con resultado y fechas', async () => {
    const w = await montar();
    expect(api.obtenerMarcoLogico).toHaveBeenCalledWith('p-1');
    expect(w.get('[data-test="cronograma-actividad"]').text()).toContain('R.1 · A.1.3 · Cinco talleres');
    expect(w.get('[data-test="cronograma-actividad"]').text()).toContain(formatoFecha('2026-11-02'));
  });
  it('carga todas las páginas de proyectos', async () => {
    api.listarProyectos.mockResolvedValueOnce({ items: [proyecto], total: 2 }).mockResolvedValueOnce({ items: [{ ...proyecto, id: 'p-2' }], total: 2 });
    await montar();
    expect(api.listarProyectos).toHaveBeenNthCalledWith(2, { page: 2, limit: 50 });
  });
  it('explica un cronograma vacío y los errores de acceso', async () => {
    api.obtenerMarcoLogico.mockResolvedValueOnce({ proyecto, resultados: [] });
    const w = await montar();
    expect(w.text()).toContain('Todavía no hay actividades programadas');
    api.obtenerMarcoLogico.mockRejectedValueOnce(new Error('Acceso denegado'));
    const error = await montar();
    expect(error.find('[data-test="cronograma-actividad"]').exists()).toBe(false);
    expect(error.text()).toContain('No se pudo cargar el cronograma');
  });
});
