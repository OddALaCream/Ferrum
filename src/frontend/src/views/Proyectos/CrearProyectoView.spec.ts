import { flushPromises, mount } from '@vue/test-utils';
import { AxiosError } from 'axios';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CrearProyectoView from './CrearProyectoView.vue';

const { crearProyecto, toastAdd } = vi.hoisted(() => ({ crearProyecto: vi.fn(), toastAdd: vi.fn() }));
vi.mock('@/api/proyectos', () => ({ crearProyecto, getFinanciadores: vi.fn().mockResolvedValue([]) }));
const BID = '11111111-1111-4111-8111-111111111112';

vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));

type Vm = {
  form: { codigo: string; nombre: string; financiadorId: string | null; fechaInicio: Date | null; fechaFin: Date | null };
};

async function montarConDatos(datos: Partial<Vm['form']> = {}) {
  const wrapper = mount(CrearProyectoView, {
    global: { plugins: [PrimeVue, ToastService], stubs: { Select: true, DatePicker: true } },
  });
  Object.assign((wrapper.vm as unknown as Vm).form, {
    codigo: 'PRY-2026-001',
    nombre: 'Fortalecimiento familiar',
    financiadorId: BID,
    fechaInicio: new Date(2026, 0, 10),
    fechaFin: new Date(2026, 11, 31),
    ...datos,
  });
  await wrapper.vm.$nextTick();
  return wrapper;
}

describe('CrearProyectoView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('envía el DTO con las fechas en formato YYYY-MM-DD', async () => {
    crearProyecto.mockResolvedValue({ codigo: 'PRY-2026-001', nombre: 'Fortalecimiento familiar' });
    const wrapper = await montarConDatos();
    await wrapper.get('[data-test="form-proyecto"]').trigger('submit');
    await flushPromises();

    expect(crearProyecto).toHaveBeenCalledWith({
      codigo: 'PRY-2026-001',
      nombre: 'Fortalecimiento familiar',
      financiadorId: BID,
      fechaInicio: '2026-01-10',
      fechaFin: '2026-12-31',
    });
  });

  it('no envía si la fecha de fin es anterior a la de inicio', async () => {
    const wrapper = await montarConDatos({ fechaFin: new Date(2025, 11, 31) });
    await wrapper.get('[data-test="form-proyecto"]').trigger('submit');

    expect(crearProyecto).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="error-fecha-fin"]').text()).toContain('no puede ser anterior');
  });

  it('CP-01: muestra un toast de error y marca el código si la API responde 409', async () => {
    crearProyecto.mockRejectedValue(
      new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: {} as never,
        data: { status: 409, title: 'Conflict', detail: 'Ya existe un proyecto con el código PRY-DEMO-001.' },
      }),
    );
    const wrapper = await montarConDatos({ codigo: 'PRY-DEMO-001' });
    await wrapper.get('[data-test="form-proyecto"]').trigger('submit');
    await flushPromises();

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Código duplicado' }),
    );
    expect(wrapper.get('[data-test="error-codigo"]').text()).toContain('PRY-DEMO-001');
  });
});
