import { flushPromises, mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Evidencia } from '@/api/avances';
import EvidenciaFila from './EvidenciaFila.vue';

const api = vi.hoisted(() => ({ anularEvidencia: vi.fn(), urlEvidencia: vi.fn() }));
const { toastAdd } = vi.hoisted(() => ({ toastAdd: vi.fn() }));
vi.mock('@/api/avances', async (original) => ({ ...(await original<typeof import('@/api/avances')>()), ...api }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));

const EVIDENCIA: Evidencia = {
  id: 'e-1', version: 1, nombreOriginal: 'acta.pdf', mime: 'application/pdf', tamanoBytes: 2048,
  sha256: 'a'.repeat(64), subidoPorId: 'u', createdAt: '2026-11-20T12:00:00Z', anulacion: null, reemplazaA: null, vigente: true,
};

const montar = (props: Partial<InstanceType<typeof EvidenciaFila>['$props']> = {}) =>
  mount(EvidenciaFila, { props: { proyectoId: 'p-1', avanceId: 'av-1', evidencia: EVIDENCIA, ...props }, global: { plugins: [PrimeVue] } });

describe('EvidenciaFila (SGP-135)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  });

  it('sin permiso no ofrece anular ni quitar', () => {
    const wrapper = montar();
    expect(wrapper.find('[data-test="anular-evidencia"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="quitar-evidencia"]').exists()).toBe(false);
  });

  it('CP-19: sin un motivo que explique, no llega al servidor', async () => {
    const wrapper = montar({ puedeAnular: true });
    await wrapper.get('[data-test="anular-evidencia"]').trigger('click');
    await wrapper.get('[data-test="motivo"]').setValue(' mal ');
    await wrapper.get('form').trigger('submit');
    expect(wrapper.get('[data-test="falta-motivo"]').text()).toContain('al menos 5');
    expect(api.anularEvidencia).not.toHaveBeenCalled();
  });

  it('CP-19: con motivo, la anula y avisa con la evidencia anulada', async () => {
    const anulada = { ...EVIDENCIA, anulacion: { at: '2026-11-22T12:00:00Z', por: { id: 'a', nombre: 'Andrea' }, motivo: 'Documento ilegible' } };
    api.anularEvidencia.mockResolvedValue(anulada);
    const wrapper = montar({ puedeAnular: true });
    await wrapper.get('[data-test="anular-evidencia"]').trigger('click');
    await wrapper.get('[data-test="motivo"]').setValue('  Documento ilegible ');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(api.anularEvidencia).toHaveBeenCalledWith('p-1', 'av-1', 'e-1', 'Documento ilegible');
    expect(wrapper.emitted('anulada')?.[0]).toEqual([anulada]);
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('una anulada se puede seguir abriendo: el archivo original se conserva', async () => {
    api.urlEvidencia.mockResolvedValue('/api/almacen/archivo?k=x');
    const abrir = vi.spyOn(window, 'open').mockReturnValue({ location: { href: '' } } as unknown as Window);
    const wrapper = montar({ evidencia: { ...EVIDENCIA, anulacion: { at: '2026-11-22T12:00:00Z', por: { id: 'a', nombre: 'Andrea' }, motivo: 'Ilegible' } } });
    await wrapper.get('[data-test="abrir-evidencia"]').trigger('click');
    await flushPromises();
    expect(abrir).toHaveBeenCalled();
    expect(api.urlEvidencia).toHaveBeenCalledWith('p-1', 'av-1', 'e-1');
  });
});