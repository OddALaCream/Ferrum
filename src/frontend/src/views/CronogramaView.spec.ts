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
const actividad = { id: 'a-1', codigo: 'A.1.3', nombre: 'Cinco talleres', fechaInicio: '2026-11-02', fechaFin: '2026-12-01', estado: 'PENDIENTE', estadoEfectivo: 'PENDIENTE', cumplimientoPct: 0, responsableId: null };
async function montar() {
  const pinia = createPinia();
  setActivePinia(pinia);
  sesionDePrueba('administrador');
  const w = mount(CronogramaView, {
    global: {
      plugins: [pinia, PrimeVue],
      stubs: {
        Select: true,
        RouterLink: { template: '<a><slot /></a>' },
        ActividadItem: { emits: ['avances', 'historial'], template: `<div><button data-test="abrir-avances" @click="$emit('avances')" /><button data-test="abrir-historial" @click="$emit('historial')" /></div>` },
        AvancesDialog: { props: ['objetivo', 'visible'], template: '<div data-test="dialogo-avances">{{ objetivo?.codigo }} {{ visible }}</div>' },
        HistorialDialog: { props: ['objetivo', 'visible'], template: '<div data-test="dialogo-historial">{{ objetivo?.codigo }} {{ visible }}</div>' },
      },
    },
  });
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

  it('la franja es el período de la actividad y el relleno, su avance', async () => {
    api.obtenerMarcoLogico.mockResolvedValue({ proyecto, resultados: [{ codigo: 'R.1', actividades: [{ ...actividad, cumplimientoPct: 85 }] }] });
    const w = await montar();
    // proyecto de 61 días; la actividad empieza el día 2 y dura 30
    const franja = w.get('[data-test="franja"]').attributes('style');
    expect(franja).toContain(`left: ${(1 / 61) * 100}%`);
    expect(franja).toContain(`width: ${(30 / 61) * 100}%`);
    expect(w.get('[data-test="relleno"]').attributes('style')).toContain('width: 85%');
    expect(w.get('[data-test="avance-cronograma"]').text()).toBe('85 % de avance');
    expect(w.get('[data-test="leyenda"]').text()).toContain('Período de la actividad');
    expect(w.get('[data-test="eje-meses"]').text()).toContain('dic');
  });

  it('una actividad retrasada lo dice junto a su avance', async () => {
    api.obtenerMarcoLogico.mockResolvedValue({ proyecto, resultados: [{ codigo: 'R.1', actividades: [{ ...actividad, cumplimientoPct: 85, estadoEfectivo: 'RETRASADA' }] }] });
    const w = await montar();
    expect(w.get('[data-test="avance-cronograma"]').text()).toBe('85 % de avance · retrasada');
    expect(w.get('[data-test="relleno"]').classes()).toContain('bg-red-500');
  });

  it('los botones Avances e Historial de cada actividad abren sus diálogos', async () => {
    const w = await montar();
    await w.get('[data-test="abrir-avances"]').trigger('click');
    expect(w.get('[data-test="dialogo-avances"]').text()).toBe('A.1.3 true');
    await w.get('[data-test="abrir-historial"]').trigger('click');
    expect(w.get('[data-test="dialogo-historial"]').text()).toBe('A.1.3 true');
  });
});