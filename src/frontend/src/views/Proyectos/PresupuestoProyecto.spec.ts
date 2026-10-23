import { flushPromises, mount } from '@vue/test-utils';
import { AxiosError } from 'axios';
import PrimeVue from 'primevue/config';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Proyecto } from '@/api/proyectos';
import PresupuestoProyecto from './PresupuestoProyecto.vue';

const ID = '33333333-3333-4333-8333-333333333333';

const { registrarPresupuesto, toastAdd } = vi.hoisted(() => ({
  registrarPresupuesto: vi.fn(),
  toastAdd: vi.fn(),
}));

vi.mock('@/api/proyectos', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/api/proyectos')>();
  return { ...real, registrarPresupuesto };
});
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));

const proyecto = (cambios: Partial<Proyecto> = {}): Proyecto => ({
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
  estado: 'EN_EJECUCION',
  ...cambios,
});

function montar(editable = true, p = proyecto()) {
  return mount(PresupuestoProyecto, {
    props: { proyecto: p, editable },
    global: { plugins: [PrimeVue], stubs: { Select: true } },
  });
}

type Wrapper = ReturnType<typeof montar>;

async function escribirMonto(w: Wrapper, monto: number | null) {
  w.findComponent(InputNumber).vm.$emit('update:modelValue', monto);
  await flushPromises();
}

async function guardar(w: Wrapper) {
  await w.get('[data-test="form-presupuesto"]').trigger('submit');
  await flushPromises();
}

describe('PresupuestoProyecto', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra el presupuesto actual con su moneda', () => {
    const wrapper = montar(false, proyecto({ presupuestoTotal: '850000.50', moneda: 'BOB' }));

    expect(wrapper.get('[data-test="monto-actual"]').text()).toMatch(/850\.000,50/);
    expect(wrapper.get('[data-test="monto-actual"]').text()).toMatch(/Bs/);
    expect(wrapper.find('[data-test="form-presupuesto"]').exists()).toBe(false);
  });

  it('CP-02: registra 850 000,50 BOB enviando el monto exacto como texto', async () => {
    const actualizado = proyecto({ presupuestoTotal: '850000.50' });
    registrarPresupuesto.mockResolvedValue(actualizado);
    const wrapper = montar();

    await escribirMonto(wrapper, 850000.5);
    await guardar(wrapper);

    expect(registrarPresupuesto).toHaveBeenCalledWith(ID, { monto: '850000.50', moneda: 'BOB' });
    expect(wrapper.emitted('actualizado')).toEqual([[actualizado]]);
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
  });

  it('CP-02: un monto negativo se rechaza con mensaje descriptivo y no llama a la API', async () => {
    const wrapper = montar();

    await escribirMonto(wrapper, -100);
    await guardar(wrapper);

    expect(registrarPresupuesto).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="error-monto"]').text()).toBe('El monto del presupuesto no puede ser negativo.');
  });

  it('exige el monto', async () => {
    const wrapper = montar();

    await escribirMonto(wrapper, null);
    await guardar(wrapper);

    expect(registrarPresupuesto).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="error-monto"]').text()).toBe('El monto del presupuesto es obligatorio.');
  });

  it('rechaza montos que exceden NUMERIC(14,2)', async () => {
    const wrapper = montar();

    await escribirMonto(wrapper, 1_000_000_000_000);
    await guardar(wrapper);

    expect(registrarPresupuesto).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="error-monto"]').text()).toContain('12 dígitos enteros y 2 decimales');
  });

  it('permite cambiar la moneda a EUR', async () => {
    registrarPresupuesto.mockResolvedValue(proyecto({ moneda: 'EUR' }));
    const wrapper = montar();

    wrapper.findComponent(Select).vm.$emit('update:modelValue', 'EUR');
    await flushPromises();
    await guardar(wrapper);

    expect(registrarPresupuesto).toHaveBeenCalledWith(ID, { monto: '100000.00', moneda: 'EUR' });
  });

  it('muestra junto al campo el 400 que devuelve la API', async () => {
    registrarPresupuesto.mockRejectedValue(
      new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as never,
        data: { status: 400, title: 'Bad Request', detail: ['El monto del presupuesto no puede ser negativo.'] },
      }),
    );
    const wrapper = montar();

    await escribirMonto(wrapper, 5);
    await guardar(wrapper);

    expect(wrapper.get('[data-test="error-monto"]').text()).toBe('El monto del presupuesto no puede ser negativo.');
  });

  it('deshabilita Guardar mientras no haya cambios', async () => {
    const wrapper = montar();
    const boton = () => wrapper.get('[data-test="btn-guardar-presupuesto"]');

    expect(boton().attributes('disabled')).toBeDefined();
    await escribirMonto(wrapper, 120000);
    expect(boton().attributes('disabled')).toBeUndefined();
  });
});
