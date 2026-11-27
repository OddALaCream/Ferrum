import { flushPromises, mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Avance } from '@/api/avances';
import BandejaRevisionView from './BandejaRevisionView.vue';

const api = vi.hoisted(() => ({ listarBandeja: vi.fn(), urlEvidencia: vi.fn() }));
vi.mock('@/api/avances', async (original) => ({ ...(await original<typeof import('@/api/avances')>()), ...api }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));

const avance = (id: string, proyectoId: string, cambios: Partial<Avance> = {}): Avance => ({
  id,
  proyecto: { id: proyectoId, codigo: `PRY-${proyectoId}`, nombre: `Proyecto ${proyectoId}` },
  objetivo: { tipo: 'IOV', id: 'i', codigo: 'I.O.V. 1.2', nombre: 'Beneficiarios con huerto', unidad: 'beneficiarios' },
  autor: { id: 'u', nombre: 'Lucía Condori' },
  valorReportado: 40,
  fechaCorte: '2026-11-20',
  descripcion: null,
  estado: 'ENVIADO',
  enviadoAt: '2026-11-21T12:00:00Z',
  observacion: null,
  revisadoPor: null,
  revisadoAt: null,
  createdAt: '2026-11-20T12:00:00Z',
  updatedAt: '2026-11-21T12:00:00Z',
  evidencias: [{ id: 'e', version: 1, nombreOriginal: 'acta.pdf', mime: 'application/pdf', tamanoBytes: 1024, sha256: 'a', subidoPorId: 'u', createdAt: '2026-11-21T12:00:00Z' }],
  ...cambios,
});

async function montar() {
  const wrapper = mount(BandejaRevisionView, {
    global: {
      plugins: [PrimeVue],
      stubs: { RouterLink: { template: '<a><slot /></a>' }, AccionesRevision: { props: ['avanceId'], emits: ['revisado'], template: `<button data-test="acciones" @click="$emit('revisado', { id: avanceId })" />` } },
    },
  });
  await flushPromises();
  return wrapper;
}

describe('BandejaRevisionView (SGP-96)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista los avances enviados con su proyecto, valor, evidencia y acciones', async () => {
    api.listarBandeja.mockResolvedValue([avance('a1', '1'), avance('a2', '2'), avance('a3', '1')]);
    const wrapper = await montar();
    const items = wrapper.findAll('[data-test="avance-bandeja"]');
    expect(items).toHaveLength(3);
    expect(wrapper.get('[data-test="resumen-bandeja"]').text()).toContain('3 avances esperan tu revisión en 2 proyectos');
    expect(items[0].get('[data-test="proyecto"]').text()).toContain('PRY-1');
    expect(items[0].get('[data-test="valor"]').text()).toBe('40 beneficiarios');
    expect(items[0].get('[data-test="evidencia"]').text()).toBe('acta.pdf');
    expect(items[0].find('[data-test="acciones"]').exists()).toBe(true);
  });

  it('el avance revisado sale de la bandeja', async () => {
    api.listarBandeja.mockResolvedValue([avance('a1', '1'), avance('a2', '1')]);
    const wrapper = await montar();
    await wrapper.findAll('[data-test="acciones"]')[0].trigger('click');
    const quedan = wrapper.findAll('[data-test="avance-bandeja"]');
    expect(quedan).toHaveLength(1);
    expect(wrapper.get('[data-test="resumen-bandeja"]').text()).toContain('1 avance espera');
  });

  it('sin pendientes lo dice', async () => {
    api.listarBandeja.mockResolvedValue([]);
    const wrapper = await montar();
    expect(wrapper.get('[data-test="bandeja-vacia"]').text()).toContain('No hay avances por revisar');
  });
});