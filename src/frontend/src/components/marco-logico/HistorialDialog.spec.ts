import { flushPromises, mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Historial } from '@/api/historial';
import HistorialDialog from './HistorialDialog.vue';

const api = vi.hoisted(() => ({ obtenerHistorial: vi.fn() }));
vi.mock('@/api/historial', () => api);
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));

const ANDREA = { id: 'a', nombre: 'Andrea Quispe' };
const LUCIA = { id: 'l', nombre: 'Lucía Condori' };
const evidencia = { id: 'e1', version: 1, reemplazaA: null, vigente: true, nombreOriginal: 'acta.pdf', mime: 'application/pdf', tamanoBytes: 100, sha256: 'a', subidoPorId: 'l', createdAt: '2026-11-20T10:00:00Z', anulacion: null };
const avance = (id: string, estado: 'APROBADO' | 'OBSERVADO' | 'ENVIADO', fechaCorte: string, eventos: Historial['avances'][number]['eventos']) => ({
  id, estado, fechaCorte, eventos,
  proyecto: { id: 'p', codigo: 'PRY', nombre: 'P' },
  objetivo: { tipo: 'IOV' as const, id: 'i', codigo: 'I.O.V. 1.2', nombre: 'Beneficiarios', unidad: 'beneficiarios' },
  autor: LUCIA, valorReportado: 20, descripcion: null, enviadoAt: '2026-11-21T10:00:00Z',
  observacion: null, revisadoPor: estado === 'ENVIADO' ? null : ANDREA, revisadoAt: null,
  createdAt: '2026-11-20T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z', evidencias: [{ ...evidencia, id: `e-${id}` }],
});
const ev = (tipo: string, detalle: string | null = null, usuario = LUCIA) => ({ tipo, fecha: '2026-11-21T14:00:00Z', usuario, detalle, evidenciaId: null }) as Historial['avances'][number]['eventos'][number];

const HISTORIAL: Historial = {
  objetivo: { tipo: 'IOV', id: 'i', codigo: 'I.O.V. 1.2', nombre: 'Beneficiarios con huerto', unidad: 'beneficiarios', meta: 130, cumplimientoPct: 15.38 },
  avances: [
    avance('a1', 'APROBADO', '2026-03-01', [ev('REGISTRADO'), ev('ENVIADO'), ev('OBSERVADO', 'Falta la firma.', ANDREA), ev('REENVIADO'), ev('APROBADO', null, ANDREA)]),
    avance('a2', 'OBSERVADO', '2026-06-01', [ev('REGISTRADO'), ev('ENVIADO'), ev('OBSERVADO', 'El acta no se lee.', ANDREA)]),
    avance('a3', 'ENVIADO', '2026-09-01', [ev('REGISTRADO'), ev('ENVIADO')]),
  ],
};

async function montar(objetivo = { tipo: 'IOV' as const, id: 'i', codigo: 'I.O.V. 1.2' }) {
  const wrapper = mount(HistorialDialog, {
    props: { proyectoId: 'p-1', objetivo, visible: false },
    global: { plugins: [PrimeVue], stubs: { Dialog: { template: '<div><slot /></div>' } } },
  });
  await wrapper.setProps({ visible: true });
  await flushPromises();
  return wrapper;
}

describe('HistorialDialog (SGP-116)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('CP-28: lista los avances en orden, con su estado, revisor y evidencia', async () => {
    api.obtenerHistorial.mockResolvedValue(HISTORIAL);
    const wrapper = await montar();
    expect(api.obtenerHistorial).toHaveBeenCalledWith('p-1', { iovId: 'i' });

    const avances = wrapper.findAll('[data-test="avance-historial"]');
    expect(avances).toHaveLength(3);
    expect(avances.map((a) => a.get('[data-test="estado-historial"]').text())).toEqual(['Aprobado', 'Observado', 'En revisión']);
    expect(avances[0].text()).toContain('revisó Andrea Quispe');
    expect(avances[2].text()).not.toContain('revisó');
    expect(avances[0].get('[data-test="abrir-evidencia"]').text()).toBe('acta.pdf');
    expect(wrapper.get('[data-test="cumplimiento-historial"]').text()).toContain('15%');
  });

  it('la línea de tiempo muestra la observación aunque después lo aprobaran', async () => {
    api.obtenerHistorial.mockResolvedValue(HISTORIAL);
    const wrapper = await montar();
    const primero = wrapper.findAll('[data-test="avance-historial"]')[0];
    const eventos = primero.findAll('[data-test="evento"]').map((e) => e.text());
    expect(eventos).toHaveLength(5);
    expect(eventos[2]).toContain('Observado');
    expect(eventos[2]).toContain('Falta la firma.');
    expect(eventos[3]).toContain('Reenviado a revisión');
    expect(eventos[4]).toContain('Aprobado · Andrea Quispe');
  });

  it('para una actividad pide su historial y sin avances lo dice', async () => {
    api.obtenerHistorial.mockResolvedValue({ objetivo: { ...HISTORIAL.objetivo, tipo: 'ACTIVIDAD', codigo: 'A.1.1' }, avances: [] });
    const wrapper = await montar({ tipo: 'ACTIVIDAD' as never, id: 'act', codigo: 'A.1.1' });
    expect(api.obtenerHistorial).toHaveBeenCalledWith('p-1', { actividadId: 'act' });
    expect(wrapper.get('[data-test="sin-historial"]').text()).toContain('Todavía no hay avances');
    expect(wrapper.find('[data-test="cumplimiento-historial"]').exists()).toBe(false);
  });

  it('si falla la carga, lo avisa', async () => {
    api.obtenerHistorial.mockRejectedValue(new Error('x'));
    const wrapper = await montar();
    expect(wrapper.text()).toContain('No se pudo cargar el historial');
  });
});