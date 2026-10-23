import { flushPromises, mount } from '@vue/test-utils';
import { AxiosError } from 'axios';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import SelectButton from 'primevue/selectbutton';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TecnicoProyecto } from '@/api/equipo';
import type { EstadoProyecto, Proyecto } from '@/api/proyectos';
import { useAuthStore, type Rol } from '@/stores/auth';
import DetalleProyectoView from './DetalleProyectoView.vue';

const ID = '33333333-3333-4333-8333-333333333333';

const tecnicoDemo: TecnicoProyecto = {
  id: '22222222-2222-4222-8222-222222222222',
  nombre: 'Técnico Demo',
  email: 'tecnico@serfamilia.test',
  fechaAsignacion: '2026-01-15T10:00:00.000Z',
};

const {
  obtenerProyecto,
  actualizarEstado,
  obtenerEquipo,
  asignarTecnico,
  retirarTecnico,
  buscarTecnicosDisponibles,
  toastAdd,
  confirmRequire,
} = vi.hoisted(() => ({
  obtenerProyecto: vi.fn(),
  actualizarEstado: vi.fn(),
  obtenerEquipo: vi.fn(),
  asignarTecnico: vi.fn(),
  retirarTecnico: vi.fn(),
  buscarTecnicosDisponibles: vi.fn().mockResolvedValue([]),
  toastAdd: vi.fn(),
  confirmRequire: vi.fn(),
}));

vi.mock('@/api/proyectos', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/api/proyectos')>();
  return {
    MONEDAS: real.MONEDAS,
    motivoMontoInvalido: real.motivoMontoInvalido,
    registrarPresupuesto: vi.fn(),
    obtenerProyecto,
    actualizarEstado,
    getFinanciadores: vi.fn().mockResolvedValue([{ id: 'f-1', nombre: 'Financiador Demo' }]),
  };
});
vi.mock('@/api/equipo', () => ({
  obtenerEquipo,
  asignarTecnico,
  retirarTecnico,
  buscarTecnicosDisponibles,
}));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: confirmRequire }) }));

const proyecto = (estado: EstadoProyecto): Proyecto => ({
  id: ID,
  codigo: 'PRY-DEMO-001',
  nombre: 'Proyecto de demostración',
  descripcion: null,
  objetivoGeneral: null,
  financiadorId: 'f-1',
  presupuestoTotal: '100000.00',
  moneda: 'BOB',
  fechaInicio: '2026-01-01',
  fechaFin: '2026-12-31',
  estado,
});

function error422() {
  return new AxiosError('Unprocessable Entity', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 422,
    statusText: 'Unprocessable Entity',
    headers: {},
    config: {} as never,
    data: { status: 422, title: 'Unprocessable Entity', detail: 'Un proyecto cerrado no puede cambiar de estado (RN-09).' },
  });
}

async function montar(rol: Rol = 'director') {
  const pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().setRole(rol);
  const wrapper = mount(DetalleProyectoView, {
    props: { id: ID },
    global: {
      plugins: [pinia, PrimeVue],
      stubs: { RouterLink: true, AutoComplete: true, DataTable: false, Select: true },
    },
  });
  await flushPromises();
  return wrapper;
}

const tag = (w: Awaited<ReturnType<typeof montar>>) => w.get('[data-test="tag-estado"]').text();
const selector = (w: Awaited<ReturnType<typeof montar>>) => w.findComponent(SelectButton);

describe('DetalleProyectoView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    obtenerEquipo.mockResolvedValue([tecnicoDemo]);
  });

  it('muestra el estado actual en el Tag y permite al Director cambiarlo', async () => {
    obtenerProyecto.mockResolvedValue(proyecto('EN_EJECUCION'));
    actualizarEstado.mockResolvedValue(proyecto('PAUSADO'));
    const wrapper = await montar();
    expect(tag(wrapper)).toBe('En ejecución');
    expect(selector(wrapper).props('disabled')).toBe(false);

    selector(wrapper).vm.$emit('update:modelValue', 'PAUSADO');
    await flushPromises();

    expect(actualizarEstado).toHaveBeenCalledWith(ID, 'PAUSADO');
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    expect(tag(wrapper)).toBe('Pausado');
  });

  it('CP-03: ante un 422 muestra el Toast "Transición de proyecto no permitida" y resincroniza el estado', async () => {
    obtenerProyecto.mockResolvedValueOnce(proyecto('EN_EJECUCION')).mockResolvedValueOnce(proyecto('CERRADO'));
    actualizarEstado.mockRejectedValue(error422());
    const wrapper = await montar();

    selector(wrapper).vm.$emit('update:modelValue', 'PAUSADO');
    await flushPromises();

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Transición de proyecto no permitida' }),
    );
    expect(tag(wrapper)).toBe('Cerrado');
    expect(selector(wrapper).props('disabled')).toBe(true);
  });

  it('con el proyecto CERRADO el selector queda deshabilitado y se muestra el modo solo lectura', async () => {
    obtenerProyecto.mockResolvedValue(proyecto('CERRADO'));
    const wrapper = await montar();

    expect(selector(wrapper).props('disabled')).toBe(true);
    expect(wrapper.find('[data-test="aviso-solo-lectura"]').exists()).toBe(true);
  });

  it('pide confirmación antes de cerrar y solo actualiza al aceptar', async () => {
    obtenerProyecto.mockResolvedValue(proyecto('EN_EJECUCION'));
    actualizarEstado.mockResolvedValue(proyecto('CERRADO'));
    const wrapper = await montar();

    selector(wrapper).vm.$emit('update:modelValue', 'CERRADO');
    expect(confirmRequire).toHaveBeenCalledOnce();
    expect(actualizarEstado).not.toHaveBeenCalled();

    confirmRequire.mock.calls[0][0].accept();
    await flushPromises();
    expect(actualizarEstado).toHaveBeenCalledWith(ID, 'CERRADO');
  });

  it('al cancelar el cierre, el selector vuelve al estado real', async () => {
    obtenerProyecto.mockResolvedValue(proyecto('EN_EJECUCION'));
    const wrapper = await montar();

    selector(wrapper).vm.$emit('update:modelValue', 'CERRADO');
    await flushPromises();
    expect(selector(wrapper).props('modelValue')).toBe('CERRADO');

    confirmRequire.mock.calls[0][0].reject();
    await flushPromises();
    expect(selector(wrapper).props('modelValue')).toBe('EN_EJECUCION');
    expect(actualizarEstado).not.toHaveBeenCalled();
  });

  it('CP-03: si el 422 no cambia el estado, el selector vuelve al estado real', async () => {
    obtenerProyecto.mockResolvedValue(proyecto('EN_EJECUCION'));
    actualizarEstado.mockRejectedValue(error422());
    const wrapper = await montar();

    selector(wrapper).vm.$emit('update:modelValue', 'PAUSADO');
    await flushPromises();

    expect(selector(wrapper).props('modelValue')).toBe('EN_EJECUCION');
    expect(tag(wrapper)).toBe('En ejecución');
  });

  it('el Técnico ve el estado pero no puede cambiarlo', async () => {
    obtenerProyecto.mockResolvedValue(proyecto('EN_EJECUCION'));
    const wrapper = await montar('tecnico');

    expect(selector(wrapper).props('disabled')).toBe(true);
    expect(wrapper.find('[data-test="aviso-solo-lectura"]').exists()).toBe(false);
  });

  describe('Presupuesto (SGP-7)', () => {
    it('el Director ve el presupuesto actual y el formulario para registrarlo', async () => {
      obtenerProyecto.mockResolvedValue(proyecto('EN_EJECUCION'));
      const wrapper = await montar();

      expect(wrapper.get('[data-test="monto-actual"]').text()).toMatch(/100\.000,00/);
      expect(wrapper.find('[data-test="form-presupuesto"]').exists()).toBe(true);
    });

    it.each<[string, EstadoProyecto, Rol]>([
      ['proyecto cerrado', 'CERRADO', 'director'],
      ['rol Técnico', 'EN_EJECUCION', 'tecnico'],
    ])('con %s el presupuesto es de solo lectura', async (_caso, estado, rol) => {
      obtenerProyecto.mockResolvedValue(proyecto(estado));
      const wrapper = await montar(rol);

      expect(wrapper.find('[data-test="seccion-presupuesto"]').exists()).toBe(true);
      expect(wrapper.find('[data-test="form-presupuesto"]').exists()).toBe(false);
    });
  });

  describe('Equipo Técnico (SGP-70)', () => {
    it('renderiza la tabla con los técnicos del equipo', async () => {
      obtenerProyecto.mockResolvedValue(proyecto('EN_EJECUCION'));
      const wrapper = await montar();

      expect(obtenerEquipo).toHaveBeenCalledWith(ID);
      expect(wrapper.find('[data-test="seccion-equipo"]').exists()).toBe(true);
      expect(wrapper.find('[data-test="tabla-equipo"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Técnico Demo');
      expect(wrapper.text()).toContain('tecnico@serfamilia.test');
    });

    it('al retirar, abre ConfirmDialog y solo llama a la API si se acepta', async () => {
      obtenerProyecto.mockResolvedValue(proyecto('EN_EJECUCION'));
      retirarTecnico.mockResolvedValue(undefined);
      obtenerEquipo.mockResolvedValueOnce([tecnicoDemo]).mockResolvedValueOnce([]);
      const wrapper = await montar();

      await wrapper.get('[data-test="btn-retirar"]').trigger('click');
      expect(confirmRequire).toHaveBeenCalledWith(
        expect.objectContaining({ header: 'Retirar del equipo' }),
      );
      expect(retirarTecnico).not.toHaveBeenCalled();

      confirmRequire.mock.calls.at(-1)![0].accept();
      await flushPromises();

      expect(retirarTecnico).toHaveBeenCalledWith(ID, tecnicoDemo.id);
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success', summary: 'Técnico retirado' }));
      expect(obtenerEquipo).toHaveBeenCalledTimes(2);
    });

    it('en modo solo lectura oculta el buscador, Asignar y los botones de retirar', async () => {
      obtenerProyecto.mockResolvedValue(proyecto('CERRADO'));
      const wrapper = await montar();

      expect(wrapper.find('[data-test="asignar-equipo"]').exists()).toBe(false);
      expect(wrapper.find('[data-test="btn-asignar"]').exists()).toBe(false);
      expect(wrapper.find('[data-test="btn-retirar"]').exists()).toBe(false);
      expect(wrapper.find('[data-test="tabla-equipo"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Técnico Demo');
    });

    it('el Técnico tampoco puede gestionar el equipo (solo lectura por rol)', async () => {
      obtenerProyecto.mockResolvedValue(proyecto('EN_EJECUCION'));
      const wrapper = await montar('tecnico');

      expect(wrapper.find('[data-test="asignar-equipo"]').exists()).toBe(false);
      expect(wrapper.find('[data-test="btn-retirar"]').exists()).toBe(false);
    });
  });
});
