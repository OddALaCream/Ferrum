import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MiTrabajo } from '@/api/seguimiento';
import type { Rol } from '@/stores/auth';
import { sesionDePrueba } from '@/test/helpers/sesion';
import DashboardView from './DashboardView.vue';

const { obtenerResumen, listarProyectos, obtenerRetrasadas, obtenerMiTrabajo } = vi.hoisted(() => ({
  obtenerResumen: vi.fn(),
  listarProyectos: vi.fn(),
  obtenerRetrasadas: vi.fn(),
  obtenerMiTrabajo: vi.fn(),
}));
vi.mock('@/api/proyectos', () => ({ obtenerResumen, listarProyectos }));
vi.mock('@/api/seguimiento', () => ({ obtenerRetrasadas, obtenerMiTrabajo }));

const RESUMEN = {
  totalProyectos: 8,
  porEstado: { PLANIFICACION: 2, EN_EJECUCION: 4, PAUSADO: 1, CERRADO: 1 },
  presupuestoBob: '1850000.50',
  tecnicosActivos: 5,
  actividades: { total: 38, completadas: 9, enCurso: 14, pendientes: 12, retrasadas: 3 },
  avancePromedio: '42.40',
};
const RETRASADA = {
  id: 'a-1', codigo: 'A.1.3', nombre: 'Visitas domiciliarias de seguimiento', resultadoCodigo: 'R.1', proyectoId: 'p-1',
  proyectoCodigo: 'PRY-DEMO-001', proyectoNombre: 'Escuela de padres', responsable: 'Marco Huanca', fechaFin: '2026-11-08', diasAtraso: 5, cumplimientoPct: 45,
};
const TRABAJO: MiTrabajo = {
  resumen: { actividadesActivas: 3, actividadesRetrasadas: 1, tareasPendientes: 2, tareasVencidas: 1, sesionesSinMarcar: 2 },
  actividades: [
    {
      id: 'a-1', codigo: 'A.1.2', nombre: 'Talleres de crianza positiva', tipoCronograma: 'DISCRETO', estado: 'EN_CURSO', retrasada: true,
      fechaInicio: '2026-08-20', fechaFin: '2026-11-10', cumplimientoPct: 75, resultadoCodigo: 'R.1', proyectoId: 'p-1', proyectoCodigo: 'PRY-DEMO-001',
      proyectoNombre: 'Escuela de padres', proximaSesion: '2026-11-17', sesionesSinMarcar: 2,
    },
  ],
  tareas: [
    { id: 't-1', nombre: 'Imprimir el material del taller', estado: 'EN_CURSO', fechaLimite: '2026-11-10', vencida: true, actividadId: 'a-1', actividadCodigo: 'A.1.2', proyectoId: 'p-1', proyectoCodigo: 'PRY-DEMO-001' },
  ],
};

async function montar(rol: Rol) {
  const pinia = createPinia();
  setActivePinia(pinia);
  sesionDePrueba(rol);
  const wrapper = mount(DashboardView, { global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot :navigate="() => {}" /></a>' } } } });
  await flushPromises();
  return wrapper;
}

describe('DashboardView: un panel para cada rol', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    obtenerResumen.mockResolvedValue(RESUMEN);
    obtenerRetrasadas.mockResolvedValue([RETRASADA]);
    obtenerMiTrabajo.mockResolvedValue(TRABAJO);
    listarProyectos.mockResolvedValue({
      items: [{ id: 'p-1', codigo: 'PRY-DEMO-001', nombre: 'Escuela de padres', estado: 'EN_EJECUCION', cumplimientoPct: '70.00', equipoActivo: 2 }],
      total: 1, page: 1, limit: 6,
    });
  });

  it('no muestra ningún indicador técnico del estado de la API', async () => {
    const wrapper = await montar('administrador');
    expect(wrapper.text()).not.toMatch(/API|conectada/);
  });

  describe('Administrador (toda la cartera)', () => {
    it('muestra los indicadores de la cartera y el presupuesto', async () => {
      const wrapper = await montar('administrador');
      expect(wrapper.get('[data-test="kpi-total"]').text()).toContain('8');
      expect(wrapper.get('[data-test="kpi-ejecucion"]').text()).toContain('4');
      expect(wrapper.get('[data-test="kpi-tecnicos"]').text()).toContain('5');
      expect(wrapper.get('[data-test="kpi-presupuesto"]').text()).toContain('1.850.000,50');
      expect(wrapper.get('[data-test="kpi-retrasadas"]').text()).toContain('3');
    });

    it('lista las actividades retrasadas con su responsable', async () => {
      const filas = (await montar('administrador')).findAll('[data-test="fila-retrasada"]');
      expect(filas).toHaveLength(1);
      expect(filas[0].text()).toContain('A.1.3');
      expect(filas[0].text()).toContain('Marco Huanca');
      expect(filas[0].text()).toContain('5 días');
    });

    it('ofrece crear proyectos', async () => {
      expect((await montar('administrador')).find('[data-test="nuevo-proyecto"]').exists()).toBe(true);
    });

    it('sin retrasos lo dice, y si falla la carga avisa sin romper la página', async () => {
      obtenerRetrasadas.mockResolvedValue([]);
      expect((await montar('administrador')).find('[data-test="sin-retrasadas"]').exists()).toBe(true);

      obtenerResumen.mockRejectedValue(new Error('sin red'));
      expect((await montar('administrador')).find('[data-test="fallo-indicadores"]').exists()).toBe(true);
    });
  });

  describe('Supervisor (solo sus proyectos)', () => {
    it('muestra "Mis proyectos", su avance promedio y lo atrasado', async () => {
      const wrapper = await montar('supervisor');
      expect(wrapper.text()).toContain('Mis proyectos');
      expect(wrapper.get('[data-test="kpi-avance"]').text()).toContain('42 %');
      expect(wrapper.get('[data-test="kpi-retrasadas"]').text()).toContain('3');
      expect(wrapper.find('[data-test="fila-retrasada"]').exists()).toBe(true);
    });

    it('lista el avance de sus proyectos', async () => {
      const wrapper = await montar('supervisor');
      expect(wrapper.get('[data-test="proyecto-supervisado"]').text()).toContain('PRY-DEMO-001');
      expect(wrapper.get('[data-test="proyecto-supervisado"]').text()).toContain('70%');
    });

    it('no ve el presupuesto (es del nivel de Administración) ni el botón de crear proyectos', async () => {
      const wrapper = await montar('supervisor');
      expect(wrapper.find('[data-test="kpi-presupuesto"]').exists()).toBe(false);
      expect(wrapper.find('[data-test="nuevo-proyecto"]').exists()).toBe(false);
    });

    it('si todavía no supervisa nada, lo explica', async () => {
      obtenerResumen.mockResolvedValue({ ...RESUMEN, totalProyectos: 0, porEstado: { PLANIFICACION: 0, EN_EJECUCION: 0, PAUSADO: 0, CERRADO: 0 } });
      expect((await montar('supervisor')).get('[data-test="sin-proyectos"]').text()).toContain('no supervisas ningún proyecto');
    });
  });

  describe('Técnico (lo que le toca hacer)', () => {
    it('muestra sus actividades por cumplir, retrasadas, tareas y sesiones sin marcar', async () => {
      const wrapper = await montar('tecnico');
      expect(wrapper.get('[data-test="kpi-actividades"]').text()).toContain('3');
      expect(wrapper.get('[data-test="kpi-retrasadas"]').text()).toContain('1');
      expect(wrapper.get('[data-test="kpi-tareas"]').text()).toContain('2');
      expect(wrapper.get('[data-test="kpi-tareas"]').text()).toContain('1 vencidas');
      expect(wrapper.get('[data-test="kpi-sesiones"]').text()).toContain('2');
    });

    it('lista sus actividades con su proyecto, la próxima sesión y el aviso de retraso', async () => {
      const a = (await montar('tecnico')).get('[data-test="mi-actividad"]');
      expect(a.text()).toContain('Talleres de crianza positiva');
      expect(a.text()).toContain('PRY-DEMO-001');
      expect(a.text()).toContain('próxima sesión');
      expect(a.text()).toContain('2 sesiones sin marcar');
      expect(a.get('[data-test="etiqueta-retrasada"]').text()).toBe('Retrasada');
    });

    it('lista sus tareas y marca las vencidas', async () => {
      const t = (await montar('tecnico')).get('[data-test="mi-tarea"]');
      expect(t.text()).toContain('Imprimir el material del taller');
      expect(t.text()).toContain('Venció el');
    });

    it('no ve ni indicadores de la cartera ni presupuesto; el botón dice "Mis proyectos"', async () => {
      const wrapper = await montar('tecnico');
      expect(wrapper.find('[data-test="kpi-presupuesto"]').exists()).toBe(false);
      expect(wrapper.get('[data-test="ver-proyectos"]').text()).toContain('Mis proyectos');
      expect(obtenerResumen).not.toHaveBeenCalled();
    });

    it('sin nada pendiente lo celebra, y si falla la carga avisa', async () => {
      obtenerMiTrabajo.mockResolvedValue({ resumen: { actividadesActivas: 0, actividadesRetrasadas: 0, tareasPendientes: 0, tareasVencidas: 0, sesionesSinMarcar: 0 }, actividades: [], tareas: [] });
      expect((await montar('tecnico')).find('[data-test="sin-trabajo"]').exists()).toBe(true);

      obtenerMiTrabajo.mockRejectedValue(new Error('sin red'));
      expect((await montar('tecnico')).find('[data-test="fallo-indicadores"]').exists()).toBe(true);
    });
  });
});