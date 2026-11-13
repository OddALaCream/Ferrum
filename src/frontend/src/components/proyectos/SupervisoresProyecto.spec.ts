import { flushPromises, mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SupervisoresProyecto from './SupervisoresProyecto.vue';

const api = vi.hoisted(() => ({
  obtenerSupervisores: vi.fn(),
  buscarSupervisoresDisponibles: vi.fn(),
  asignarSupervisor: vi.fn(),
  retirarSupervisor: vi.fn(),
}));
const { toastAdd, confirmRequire } = vi.hoisted(() => ({ toastAdd: vi.fn(), confirmRequire: vi.fn() }));
vi.mock('@/api/supervisores', () => api);
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: confirmRequire }) }));

const RODRIGO = { id: 's-1', nombre: 'Rodrigo Mamani', email: 'supervisor@serfamilia.test', fechaAsignacion: '2026-09-01T12:00:00Z' };

async function montar(editable: boolean) {
  const wrapper = mount(SupervisoresProyecto, { props: { proyectoId: 'p-1', editable }, global: { plugins: [PrimeVue] } });
  await flushPromises();
  return wrapper;
}

describe('SupervisoresProyecto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // El selector de PrimeVue consulta matchMedia, que el entorno de pruebas no trae
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as typeof window.matchMedia;
    api.obtenerSupervisores.mockResolvedValue([RODRIGO]);
    api.buscarSupervisoresDisponibles.mockResolvedValue([{ id: 's-2', nombre: 'Gabriela Choque Apaza', email: 'gabriela.choque@serfamilia.test' }]);
  });

  it('lista a quienes supervisan el proyecto, con su correo', async () => {
    const wrapper = await montar(false);
    const s = wrapper.get('[data-test="supervisor"]');
    expect(s.text()).toContain('Rodrigo Mamani');
    expect(s.text()).toContain('supervisor@serfamilia.test');
  });

  it('quien no es Administrador solo lo ve: sin selector, sin asignar y sin quitar', async () => {
    const wrapper = await montar(false);
    expect(wrapper.find('[data-test="asignar-supervisor"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="btn-quitar-supervisor"]').exists()).toBe(false);
    expect(api.buscarSupervisoresDisponibles).not.toHaveBeenCalled();
  });

  it('un proyecto sin supervisor lo dice', async () => {
    api.obtenerSupervisores.mockResolvedValue([]);
    expect((await montar(false)).get('[data-test="sin-supervisores"]').text()).toContain('todavía no tiene supervisor');
  });

  it('el Administrador ve el selector con los supervisores que todavía no están en el proyecto', async () => {
    const wrapper = await montar(true);
    expect(wrapper.find('[data-test="asignar-supervisor"]').exists()).toBe(true);
    expect(api.buscarSupervisoresDisponibles).toHaveBeenCalledWith('p-1');
    expect((wrapper.get('[data-test="btn-asignar-supervisor"]').element as HTMLButtonElement).disabled).toBe(true);
  });

  it('al quitar a un supervisor pide confirmación y recién entonces lo retira', async () => {
    api.retirarSupervisor.mockResolvedValue(undefined);
    const wrapper = await montar(true);

    await wrapper.get('[data-test="btn-quitar-supervisor"]').trigger('click');
    expect(api.retirarSupervisor).not.toHaveBeenCalled();
    expect(confirmRequire).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Rodrigo Mamani') }));

    await confirmRequire.mock.calls[0][0].accept();
    expect(api.retirarSupervisor).toHaveBeenCalledWith('p-1', 's-1');
    expect(api.obtenerSupervisores).toHaveBeenCalledTimes(2);
  });

  it('si falla la carga avisa con un mensaje', async () => {
    api.obtenerSupervisores.mockRejectedValue(new Error('sin red'));
    await montar(false);
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error', summary: 'No se pudo cargar la supervisión' }));
  });
});