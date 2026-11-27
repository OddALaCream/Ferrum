import { flushPromises, mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccionesRevision from './AccionesRevision.vue';

const api = vi.hoisted(() => ({ aprobarAvance: vi.fn(), observarAvance: vi.fn() }));
const { toastAdd, confirmRequire } = vi.hoisted(() => ({ toastAdd: vi.fn(), confirmRequire: vi.fn() }));
vi.mock('@/api/avances', async (original) => ({ ...(await original<typeof import('@/api/avances')>()), ...api }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: confirmRequire }) }));

const montar = () => mount(AccionesRevision, { props: { proyectoId: 'p-1', avanceId: 'av-1' }, global: { plugins: [PrimeVue] } });

describe('AccionesRevision (SGP-94 / SGP-96)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  });

  it('aprobar pide confirmación y avisa con el avance aprobado', async () => {
    api.aprobarAvance.mockResolvedValue({ id: 'av-1', estado: 'APROBADO' });
    const wrapper = montar();
    await wrapper.get('[data-test="aprobar"]').trigger('click');
    expect(api.aprobarAvance).not.toHaveBeenCalled();

    await confirmRequire.mock.calls[0][0].accept();
    await flushPromises();
    expect(api.aprobarAvance).toHaveBeenCalledWith('p-1', 'av-1');
    expect(wrapper.emitted('revisado')?.[0]).toEqual([{ id: 'av-1', estado: 'APROBADO' }]);
  });

  it('CP-27: observar sin escribir nada no llega al servidor', async () => {
    const wrapper = montar();
    await wrapper.get('[data-test="observar"]').trigger('click');
    await wrapper.get('[data-test="texto-observacion"]').setValue('   ');
    await wrapper.get('form').trigger('submit');
    expect(wrapper.get('[data-test="falta-observacion"]').text()).toContain('qué corregir');
    expect(api.observarAvance).not.toHaveBeenCalled();
  });

  it('CP-27: con la observación escrita, el avance vuelve al técnico', async () => {
    api.observarAvance.mockResolvedValue({ id: 'av-1', estado: 'OBSERVADO' });
    const wrapper = montar();
    await wrapper.get('[data-test="observar"]').trigger('click');
    await wrapper.get('[data-test="texto-observacion"]').setValue('  Falta la firma.  ');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(api.observarAvance).toHaveBeenCalledWith('p-1', 'av-1', 'Falta la firma.');
    expect(wrapper.emitted('revisado')?.[0]).toEqual([{ id: 'av-1', estado: 'OBSERVADO' }]);
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('si el servidor rechaza, lo avisa y no emite nada', async () => {
    api.aprobarAvance.mockRejectedValue(new Error('x'));
    const wrapper = montar();
    await wrapper.get('[data-test="aprobar"]').trigger('click');
    await confirmRequire.mock.calls[0][0].accept();
    await flushPromises();
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    expect(wrapper.emitted('revisado')).toBeUndefined();
  });
});