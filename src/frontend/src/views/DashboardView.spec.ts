import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardView from './DashboardView.vue';

const { obtenerResumen } = vi.hoisted(() => ({ obtenerResumen: vi.fn() }));
vi.mock('@/api/proyectos', () => ({ obtenerResumen }));

const RESUMEN = {
  totalProyectos: 8,
  porEstado: { PLANIFICACION: 2, EN_EJECUCION: 4, PAUSADO: 1, CERRADO: 1 },
  presupuestoBob: '1850000.50',
  tecnicosActivos: 5,
};

function montar() {
  return mount(DashboardView, { global: { plugins: [createPinia()], stubs: { RouterLink: true } } });
}
const esperar = () => new Promise((r) => setTimeout(r));

describe('DashboardView', () => {
  beforeEach(() => {
    obtenerResumen.mockReset();
  });

  it('no muestra ningún indicador técnico del estado de la API', async () => {
    obtenerResumen.mockResolvedValue(RESUMEN);
    const wrapper = montar();
    await esperar();
    expect(wrapper.find('[data-test="api-status"]').exists()).toBe(false);
    expect(wrapper.text()).not.toMatch(/API|conectada/);
  });

  it('muestra los indicadores de la cartera', async () => {
    obtenerResumen.mockResolvedValue(RESUMEN);
    const wrapper = montar();
    await esperar();
    expect(wrapper.get('[data-test="kpi-total"]').text()).toBe('8');
    expect(wrapper.get('[data-test="kpi-ejecucion"]').text()).toBe('4');
    expect(wrapper.get('[data-test="kpi-tecnicos"]').text()).toBe('5');
    expect(wrapper.get('[data-test="kpi-presupuesto"]').text()).toContain('1.850.000,50');
  });

  it('sin proyectos lo dice en vez de mostrar barras vacías', async () => {
    obtenerResumen.mockResolvedValue({ ...RESUMEN, totalProyectos: 0, porEstado: { PLANIFICACION: 0, EN_EJECUCION: 0, PAUSADO: 0, CERRADO: 0 } });
    const wrapper = montar();
    await esperar();
    expect(wrapper.find('[data-test="sin-proyectos"]').exists()).toBe(true);
  });

  it('si no se pueden cargar los indicadores avisa, sin romper la página', async () => {
    obtenerResumen.mockRejectedValue(new Error('sin red'));
    const wrapper = montar();
    await esperar();
    expect(wrapper.find('[data-test="fallo-indicadores"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="ver-proyecto-demo"]').exists()).toBe(false);
  });
});