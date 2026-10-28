import { flushPromises, mount } from '@vue/test-utils';
import { AxiosError, AxiosHeaders } from 'axios';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actividad, ArbolMarcoLogico } from '@/api/marcoLogico';
import type { Rol } from '@/stores/auth';
import { sesionDePrueba } from '@/test/helpers/sesion';
import MarcoLogicoProyectoView from './MarcoLogicoProyectoView.vue';

const api = vi.hoisted(() => ({
  obtenerMarcoLogico: vi.fn(),
  marcarSesion: vi.fn(),
  cambiarEstadoActividad: vi.fn(),
  crearTarea: vi.fn(),
  cambiarEstadoTarea: vi.fn(),
  obtenerEquipo: vi.fn(),
}));
vi.mock('@/api/marcoLogico', async (original) => ({ ...(await original<typeof import('@/api/marcoLogico')>()), ...api }));
vi.mock('@/api/equipo', async (original) => ({ ...(await original<typeof import('@/api/equipo')>()), obtenerEquipo: api.obtenerEquipo }));

/** Id del usuario que crea `sesionDePrueba`. */
const YO = 'u-prueba';

function actividad(c: Partial<Actividad>): Actividad {
  return {
    id: 'a-x', resultadoId: 'r-1', iovId: null, codigo: 'A.1.1', nombre: 'Actividad', descripcion: null, responsableId: null,
    fechaInicio: '2026-09-01', fechaFin: '2027-01-29', estado: 'PENDIENTE', estadoEfectivo: 'PENDIENTE', tipoCronograma: 'CONTINUO',
    metaCuantitativa: null, unidadMeta: null, fuentesVerificacion: null, cumplimientoPct: 0, sesiones: [], tareas: [], ...c,
  };
}

function arbol(estado = 'EN_EJECUCION'): ArbolMarcoLogico {
  return {
    proyecto: { id: 'p-1', codigo: 'PRY-AGRO-2026', nombre: 'Producción agroecológica', estado, fechaInicio: '2026-09-01', fechaFin: '2027-03-31' },
    resultados: [
      {
        id: 'r-1', proyectoId: 'p-1', codigo: 'R.1', descripcion: 'Implementados sistemas de producción agroecológica', peso: 0, cumplimientoPct: 0,
        indicadores: [
          {
            id: 'i-1', resultadoId: 'r-1', codigo: 'I.O.V. 1.1', descripcion: 'El 80 % de los cultivos se han caracterizado', unidad: '%',
            lineaBase: 0, meta: 80, peso: 100, fuenteVerificacion: 'Informes de caracterización agronómica', valorActual: 0, cumplimientoPct: 0,
          },
        ],
        actividades: [
          actividad({
            id: 'a-1', codigo: 'A.1.1', nombre: 'Identificación de cultivos', responsableId: YO, fechaFin: '2026-10-15', estado: 'EN_CURSO',
            estadoEfectivo: 'RETRASADA', cumplimientoPct: 85, metaCuantitativa: 10, unidadMeta: 'cultivos',
            tareas: [{ id: 't-1', actividadId: 'a-1', nombre: 'Reunirse con los jefes de manzana', responsableId: null, estado: 'PENDIENTE', fechaLimite: null, cerradoAt: null }],
          }),
          actividad({
            id: 'a-2', codigo: 'A.1.3', nombre: 'Talleres de intercambio', tipoCronograma: 'DISCRETO', responsableId: 'otro-tecnico', estado: 'EN_CURSO',
            estadoEfectivo: 'EN_CURSO', cumplimientoPct: 50,
            sesiones: [
              { id: 's-1', actividadId: 'a-2', fecha: '2026-10-06', realizada: true, realizadaAt: '2026-10-06T21:00:00Z' },
              { id: 's-2', actividadId: 'a-2', fecha: '2026-10-20', realizada: false, realizadaAt: null },
            ],
          }),
          actividad({
            id: 'a-3', codigo: 'A.1.4', nombre: 'Capacitaciones', tipoCronograma: 'DISCRETO', responsableId: YO, estado: 'EN_CURSO',
            estadoEfectivo: 'EN_CURSO', cumplimientoPct: 50,
            sesiones: [{ id: 's-3', actividadId: 'a-3', fecha: '2026-11-10', realizada: false, realizadaAt: null }],
          }),
        ],
      },
    ],
  };
}

function errorHttp(status: number) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('error', String(status), config, null, { status, statusText: '', headers: {}, config, data: { type: '', title: '', status, detail: '', instance: '' } });
}

async function montar(rol: Rol = 'administrador') {
  const pinia = createPinia();
  setActivePinia(pinia);
  sesionDePrueba(rol);
  const wrapper = mount(MarcoLogicoProyectoView, {
    props: { id: 'p-1' },
    global: {
      plugins: [pinia, PrimeVue, ToastService],
      stubs: { RouterLink: { template: '<a><slot /></a>' }, Dialog: { template: '<div />' } },
    },
  });
  await flushPromises();
  return wrapper;
}

describe('MarcoLogicoProyectoView (SGP-9, 10, 81, 111, 113)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.obtenerMarcoLogico.mockResolvedValue(arbol());
    api.obtenerEquipo.mockResolvedValue([{ id: YO, nombre: 'Lucía Condori', email: 'l@x.org', fechaAsignacion: '2026-09-01' }]);
  });

  it('muestra el resultado con sus indicadores y actividades', async () => {
    const wrapper = await montar();

    expect(wrapper.get('[data-test="titulo"]').text()).toBe('Producción agroecológica');
    expect(wrapper.get('[data-test="resultado-R.1"]').text()).toContain('Implementados sistemas de producción');
    const iov = wrapper.get('[data-test="iov-I.O.V. 1.1"]').text();
    expect(iov).toContain('El 80 % de los cultivos');
    expect(iov).toContain('80');
    expect(iov).toContain('Informes de caracterización agronómica');
    expect(wrapper.find('[data-test="actividad-A.1.1"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="actividad-A.1.3"]').exists()).toBe(true);
  });

  it('una actividad vencida se ve RETRASADA y se cuenta en el resumen (RN-11)', async () => {
    const wrapper = await montar();

    expect(wrapper.get('[data-test="actividad-A.1.1"] [data-test="estado-actividad"]').text()).toBe('Retrasada');
    expect(wrapper.get('[data-test="total-retrasadas"]').text()).toBe('1');
    expect(wrapper.get('[data-test="actividad-A.1.1"]').text()).toContain('Lucía Condori');
  });

  it('el Administrador puede crear resultados, indicadores y actividades', async () => {
    const wrapper = await montar('administrador');
    expect(wrapper.find('[data-test="nuevo-resultado"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="agregar-indicador"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="agregar-actividad"]').exists()).toBe(true);
  });

  it('el Supervisor solo consulta: no ve botones para crear ni marcar', async () => {
    const wrapper = await montar('supervisor');

    expect(wrapper.find('[data-test="nuevo-resultado"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="agregar-actividad"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="completar"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="nueva-tarea"]').exists()).toBe(false);
    for (const s of wrapper.findAll('[data-test="sesion"]')) expect(s.attributes('disabled')).toBeDefined();
  });

  it('el Técnico responsable marca una sesión y la lista se actualiza', async () => {
    api.marcarSesion.mockResolvedValue({});
    const wrapper = await montar('tecnico');

    await wrapper.get('[data-test="actividad-A.1.4"] [data-test="sesion"]').trigger('click');
    await flushPromises();

    expect(api.marcarSesion).toHaveBeenCalledWith('p-1', 'a-3', 's-3', true);
    expect(api.obtenerMarcoLogico).toHaveBeenCalledTimes(2);
  });

  it('el Técnico no puede marcar las sesiones de una actividad de otro técnico', async () => {
    const wrapper = await montar('tecnico');

    const ajenas = wrapper.findAll('[data-test="actividad-A.1.3"] [data-test="sesion"]');
    expect(ajenas).toHaveLength(2);
    for (const s of ajenas) expect(s.attributes('disabled')).toBeDefined();
  });

  it('el Técnico responsable actualiza el avance de una actividad continua', async () => {
    api.cambiarEstadoActividad.mockResolvedValue({});
    const wrapper = await montar('tecnico');

    await wrapper.get('[data-test="actividad-A.1.1"] [data-test="completar"]').trigger('click');
    await flushPromises();

    expect(api.cambiarEstadoActividad).toHaveBeenCalledWith('p-1', 'a-1', 'COMPLETADA', undefined);
  });

  it('el Técnico responsable completa una tarea', async () => {
    api.cambiarEstadoTarea.mockResolvedValue({});
    const wrapper = await montar('tecnico');

    await wrapper.get('[data-test="tarea-toggle"]').trigger('click');
    await flushPromises();

    expect(api.cambiarEstadoTarea).toHaveBeenCalledWith('p-1', 't-1', 'COMPLETADA');
  });

  it('un proyecto cerrado queda en solo lectura (RN-09)', async () => {
    api.obtenerMarcoLogico.mockResolvedValue(arbol('CERRADO'));
    const wrapper = await montar('administrador');

    expect(wrapper.text()).toContain('solo lectura');
    expect(wrapper.find('[data-test="nuevo-resultado"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="completar"]').exists()).toBe(false);
  });

  it('un proyecto sin resultados lo explica', async () => {
    api.obtenerMarcoLogico.mockResolvedValue({ ...arbol(), resultados: [] });
    const wrapper = await montar('administrador');

    expect(wrapper.get('[data-test="vacio"]').text()).toContain('todavía no tiene marco lógico');
  });

  it('un técnico no asignado ve que no tiene acceso (403)', async () => {
    api.obtenerMarcoLogico.mockRejectedValue(errorHttp(403));
    const wrapper = await montar('tecnico');

    expect(wrapper.get('[data-test="error"]').text()).toContain('No estás asignado a este proyecto');
  });
});