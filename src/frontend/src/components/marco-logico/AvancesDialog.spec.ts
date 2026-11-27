import { flushPromises, mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Avance } from '@/api/avances';
import AvancesDialog from './AvancesDialog.vue';

const api = vi.hoisted(() => ({
  listarAvances: vi.fn(),
  crearAvance: vi.fn(),
  subirEvidencia: vi.fn(),
  enviarAvance: vi.fn(),
  eliminarEvidencia: vi.fn(),
  eliminarAvance: vi.fn(),
  urlEvidencia: vi.fn(),
}));
const { toastAdd, confirmRequire } = vi.hoisted(() => ({ toastAdd: vi.fn(), confirmRequire: vi.fn() }));
vi.mock('@/api/avances', async (original) => ({ ...(await original<typeof import('@/api/avances')>()), ...api }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: confirmRequire }) }));

const IOV = { tipo: 'IOV' as const, id: 'iov-12', codigo: 'I.O.V. 1.2', nombre: 'Beneficiarios con huerto', unidad: 'beneficiarios' };
const EVIDENCIA = { id: 'e-1', version: 1, nombreOriginal: 'acta.pdf', mime: 'application/pdf', tamanoBytes: 3 * 1024 * 1024, sha256: 'a'.repeat(64), subidoPorId: 'u', createdAt: '2026-11-20T12:00:00Z' };

function avance(cambios: Partial<Avance> = {}): Avance {
  return {
    id: 'av-1', proyecto: { id: 'p-1', codigo: 'PRY-1', nombre: 'Proyecto' }, objetivo: { tipo: 'IOV', id: IOV.id, codigo: IOV.codigo, nombre: IOV.nombre, unidad: 'beneficiarios' },
    autor: { id: 'u', nombre: 'Lucía Condori' }, valorReportado: 40, fechaCorte: '2026-11-20', descripcion: null,
    estado: 'BORRADOR', enviadoAt: null, observacion: null, revisadoPor: null, revisadoAt: null, createdAt: '2026-11-20T12:00:00Z', updatedAt: '2026-11-20T12:00:00Z', evidencias: [],
    ...cambios,
  };
}

async function montar(puedeRegistrar = true, puedeRevisar = false) {
  const wrapper = mount(AvancesDialog, {
    props: { proyectoId: 'p-1', objetivo: IOV, puedeRegistrar, puedeRevisar, inicioProyecto: '2026-01-01', visible: false },
    global: { plugins: [PrimeVue], stubs: { Dialog: { template: '<div><slot /></div>' } } },
  });
  await wrapper.setProps({ visible: true });
  await flushPromises();
  return wrapper;
}

const archivo = (nombre: string, tipo: string, bytes: number) => {
  const f = new File(['x'], nombre, { type: tipo });
  Object.defineProperty(f, 'size', { value: bytes });
  return f;
};
async function elegirArchivos(wrapper: Awaited<ReturnType<typeof montar>>, archivos: File[]) {
  const input = wrapper.get('[data-test="input-archivo"]');
  Object.defineProperty(input.element, 'files', { value: archivos, configurable: true });
  await input.trigger('change');
  await flushPromises();
}

describe('AvancesDialog (SGP-82)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // El área de texto con ajuste automático y el campo numérico usan APIs que el entorno de pruebas no trae
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
    window.matchMedia ??= vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as typeof window.matchMedia;
    api.listarAvances.mockResolvedValue([]);
  });

  it('carga los avances del indicador al abrirse', async () => {
    await montar();
    expect(api.listarAvances).toHaveBeenCalledWith('p-1', { iovId: 'iov-12' });
  });

  it('CP-11: registra 40 beneficiarios con su fecha de corte y queda como borrador', async () => {
    api.crearAvance.mockResolvedValue(avance());
    const wrapper = await montar();

    wrapper.findComponent({ name: 'InputNumber' }).vm.$emit('update:modelValue', 40);
    await wrapper.get('[data-test="fecha-corte"]').setValue('2026-11-20');
    await wrapper.get('[data-test="form-avance"]').trigger('submit');
    await flushPromises();

    expect(api.crearAvance).toHaveBeenCalledWith('p-1', { iovId: 'iov-12', valorReportado: 40, fechaCorte: '2026-11-20' });
    expect(wrapper.get('[data-test="avance-estado"]').text()).toBe('Borrador');
    expect(wrapper.get('[data-test="avance-valor"]').text()).toBe('40 beneficiarios');
  });

  it('sin valor no envía nada y lo explica', async () => {
    const wrapper = await montar();
    await wrapper.get('[data-test="form-avance"]').trigger('submit');
    expect(api.crearAvance).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Indica cuánto se alcanzó');
  });

  it('CP-12: sin evidencia el botón de enviar está deshabilitado y se avisa', async () => {
    api.listarAvances.mockResolvedValue([avance()]);
    const wrapper = await montar();
    expect((wrapper.get('[data-test="enviar-avance"]').element as HTMLButtonElement).disabled).toBe(true);
    expect(wrapper.get('[data-test="falta-evidencia"]').text()).toContain('Adjunta al menos una evidencia');
  });

  it('CP-12: con un PDF de 3 MB se sube y ya se puede enviar a revisión', async () => {
    api.listarAvances.mockResolvedValue([avance()]);
    api.subirEvidencia.mockResolvedValue(EVIDENCIA);
    api.enviarAvance.mockResolvedValue(avance({ estado: 'ENVIADO', evidencias: [EVIDENCIA] }));
    const wrapper = await montar();

    await elegirArchivos(wrapper, [archivo('acta.pdf', 'application/pdf', 3 * 1024 * 1024)]);
    expect(api.subirEvidencia).toHaveBeenCalled();
    expect(wrapper.get('[data-test="evidencia"]').text()).toContain('acta.pdf');
    expect(wrapper.get('[data-test="evidencia"]').text()).toContain('3,0 MB');

    await wrapper.get('[data-test="enviar-avance"]').trigger('click');
    await flushPromises();
    expect(api.enviarAvance).toHaveBeenCalledWith('p-1', 'av-1');
    expect(wrapper.get('[data-test="avance-estado"]').text()).toBe('En revisión');
    expect(wrapper.find('[data-test="adjuntar"]').exists()).toBe(false);
  });

  it('rechaza antes de subir un archivo de más de 25 MB o de un tipo no admitido', async () => {
    api.listarAvances.mockResolvedValue([avance()]);
    const wrapper = await montar();

    await elegirArchivos(wrapper, [archivo('video.mp4', 'video/mp4', 1000), archivo('enorme.pdf', 'application/pdf', 26 * 1024 * 1024)]);

    expect(api.subirEvidencia).not.toHaveBeenCalled();
    const avisos = toastAdd.mock.calls.map((c) => c[0].detail as string);
    expect(avisos.some((d) => d.includes('video.mp4') && d.includes('PDF, JPG, PNG y WEBP'))).toBe(true);
    expect(avisos.some((d) => d.includes('enorme.pdf') && d.includes('25 MB'))).toBe(true);
  });

  it('muestra el mensaje del servidor si rechaza el archivo', async () => {
    api.listarAvances.mockResolvedValue([avance()]);
    api.subirEvidencia.mockRejectedValue(new Error('x'));
    const wrapper = await montar();
    await elegirArchivos(wrapper, [archivo('acta.pdf', 'application/pdf', 1000)]);
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error', summary: 'No se pudo subir "acta.pdf"' }));
  });

  it('un avance observado muestra la observación y se puede reenviar', async () => {
    api.listarAvances.mockResolvedValue([avance({ estado: 'OBSERVADO', observacion: 'Falta la lista de asistencia', evidencias: [EVIDENCIA] })]);
    const wrapper = await montar();
    expect(wrapper.text()).toContain('Falta la lista de asistencia');
    expect(wrapper.get('[data-test="enviar-avance"]').text()).toContain('Reenviar a revisión');
    expect(wrapper.find('[data-test="eliminar-avance"]').exists()).toBe(false);
  });

  it('quien no es responsable solo consulta: sin formulario ni acciones, con el autor de cada avance', async () => {
    api.listarAvances.mockResolvedValue([avance({ estado: 'ENVIADO', evidencias: [EVIDENCIA] })]);
    const wrapper = await montar(false);
    expect(wrapper.find('[data-test="form-avance"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="adjuntar"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="enviar-avance"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Lucía Condori');
    expect(wrapper.text()).toContain('Avances enviados');
  });

  it('eliminar un borrador pide confirmación antes', async () => {
    api.listarAvances.mockResolvedValue([avance()]);
    api.eliminarAvance.mockResolvedValue(undefined);
    const wrapper = await montar();
    await wrapper.get('[data-test="eliminar-avance"]').trigger('click');
    expect(api.eliminarAvance).not.toHaveBeenCalled();
    await confirmRequire.mock.calls[0][0].accept();
    await flushPromises();
    expect(api.eliminarAvance).toHaveBeenCalledWith('p-1', 'av-1');
    expect(wrapper.find('[data-test="avance"]').exists()).toBe(false);
  });

  describe('Revisión del Administrador (SGP-96)', () => {
    it('el Administrador ve Aprobar y Observar solo en los avances enviados', async () => {
      api.listarAvances.mockResolvedValue([
        avance({ id: 'av-env', estado: 'ENVIADO', evidencias: [EVIDENCIA] }),
        avance({ id: 'av-apr', estado: 'APROBADO', evidencias: [EVIDENCIA], revisadoPor: { id: 'a', nombre: 'Ana Admin' }, revisadoAt: '2026-11-21T12:00:00Z' }),
      ]);
      const wrapper = await montar(false, true);
      const [enviado, aprobado] = wrapper.findAll('[data-test="avance"]');
      expect(enviado.find('[data-test="aprobar"]').exists()).toBe(true);
      expect(enviado.find('[data-test="observar"]').exists()).toBe(true);
      expect(aprobado.find('[data-test="acciones-revision"]').exists()).toBe(false);
      expect(aprobado.get('[data-test="avance-revision"]').text()).toContain('Aprobado por Ana Admin');
    });

    it('el Supervisor solo mira: no tiene acciones de revisión', async () => {
      api.listarAvances.mockResolvedValue([avance({ estado: 'ENVIADO', evidencias: [EVIDENCIA] })]);
      const wrapper = await montar(false, false);
      expect(wrapper.find('[data-test="acciones-revision"]').exists()).toBe(false);
    });
  });

  describe('Evidencias enviadas, bloqueadas (SGP-134)', () => {
    it('en borrador se pueden quitar; no hay aviso de bloqueo', async () => {
      api.listarAvances.mockResolvedValue([avance({ evidencias: [EVIDENCIA] })]);
      const wrapper = await montar();
      expect(wrapper.find('[data-test="quitar-evidencia"]').exists()).toBe(true);
      expect(wrapper.find('[data-test="evidencias-bloqueadas"]').exists()).toBe(false);
    });

    it.each(['ENVIADO', 'APROBADO'] as const)('%s: sin botón para quitar, sin adjuntar y con aviso de bloqueo', async (estado) => {
      api.listarAvances.mockResolvedValue([avance({ estado, evidencias: [EVIDENCIA] })]);
      const wrapper = await montar();
      expect(wrapper.find('[data-test="quitar-evidencia"]').exists()).toBe(false);
      expect(wrapper.find('[data-test="adjuntar"]').exists()).toBe(false);
      expect(wrapper.get('[data-test="evidencias-bloqueadas"]').text()).toContain('no se pueden quitar ni modificar');
    });

    it('OBSERVADO: lo enviado sigue bloqueado, pero puede adjuntar una evidencia corregida', async () => {
      api.listarAvances.mockResolvedValue([avance({ estado: 'OBSERVADO', observacion: 'Foto borrosa', evidencias: [EVIDENCIA] })]);
      const wrapper = await montar();
      expect(wrapper.find('[data-test="quitar-evidencia"]').exists()).toBe(false);
      expect(wrapper.find('[data-test="evidencias-bloqueadas"]').exists()).toBe(true);
      expect(wrapper.get('[data-test="adjuntar"]').text()).toContain('Adjuntar evidencia corregida');
    });
  });
});