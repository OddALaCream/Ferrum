import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { describe, expect, it, vi } from 'vitest';
import type { Evidencia } from '@/api/avances';
import ListaEvidencias from './ListaEvidencias.vue';

vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));

const ev = (id: string, version: number, reemplazaA: string | null, vigente: boolean, cambios: Partial<Evidencia> = {}): Evidencia => ({
  id, version, reemplazaA, vigente, nombreOriginal: `${id}.pdf`, mime: 'application/pdf', tamanoBytes: 100,
  sha256: 'a'.repeat(64), subidoPorId: 'u', createdAt: '2026-11-20T12:00:00Z', anulacion: null, ...cambios,
});

const montar = (evidencias: Evidencia[], props: Record<string, unknown> = {}) =>
  mount(ListaEvidencias, { props: { proyectoId: 'p', avanceId: 'a', evidencias, ...props }, global: { plugins: [PrimeVue] } });

describe('ListaEvidencias (SGP-136)', () => {
  it('muestra solo la versión vigente de cada evidencia, con su historial a pedido (de la más nueva a la más antigua)', async () => {
    const wrapper = montar([
      ev('acta-v1', 1, null, false, { anulacion: { at: '2026-11-21T12:00:00Z', por: { id: 'x', nombre: 'Andrea' }, motivo: 'Ilegible' } }),
      ev('acta-v2', 2, 'acta-v1', false),
      ev('acta-v3', 3, 'acta-v2', true),
      ev('foto', 1, null, true),
    ]);
    const visibles = wrapper.findAll('[data-test="abrir-evidencia"]').map((b) => b.text());
    expect(visibles).toEqual(['acta-v3.pdf', 'foto.pdf']);
    expect(wrapper.findAll('[data-test="ver-historial"]')).toHaveLength(1);
    expect(wrapper.get('[data-test="ver-historial"]').text()).toContain('(2)');

    await wrapper.get('[data-test="ver-historial"]').trigger('click');
    const historial = wrapper.get('[data-test="historial"]');
    expect(historial.findAll('[data-test="abrir-evidencia"]').map((b) => b.text())).toEqual(['acta-v2.pdf', 'acta-v1.pdf']);
    expect(historial.find('[data-test="evidencia-anulada"]').exists()).toBe(true);
  });

  it('en el historial no se anula ni se versiona: solo se consulta', async () => {
    const wrapper = montar([ev('v1', 1, null, false), ev('v2', 2, 'v1', true)], { puedeAnular: true, puedeVersionar: true });
    expect(wrapper.findAll('[data-test="anular-evidencia"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-test="nueva-version"]')).toHaveLength(1);
    await wrapper.get('[data-test="ver-historial"]').trigger('click');
    const historial = wrapper.get('[data-test="historial"]');
    expect(historial.find('[data-test="anular-evidencia"]').exists()).toBe(false);
    expect(historial.find('[data-test="nueva-version"]').exists()).toBe(false);
  });

  it('avisa qué evidencia se quiere corregir y con qué archivo', async () => {
    const wrapper = montar([ev('v1', 1, null, true)], { puedeVersionar: true });
    const archivo = new File(['x'], 'nueva.pdf', { type: 'application/pdf' });
    const input = wrapper.get('[data-test="input-version"]');
    Object.defineProperty(input.element, 'files', { value: [archivo], configurable: true });
    await input.trigger('change');
    expect(wrapper.emitted('nueva-version')?.[0]).toEqual(['v1', archivo]);
  });
});