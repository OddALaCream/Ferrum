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
  anularEvidencia: vi.fn(),
  subirVersion: vi.fn(),
}));
const { toastAdd, confirmRequire } = vi.hoisted(() => ({ toastAdd: vi.fn(), confirmRequire: vi.fn() }));
vi.mock('@/api/avances', async (original) => ({ ...(await original<typeof import('@/api/avances')>()), ...api }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: confirmRequire }) }));

const IOV = { tipo: 'IOV' as const, id: 'iov-12', codigo: 'I.O.V. 1.2', nombre: 'Beneficiarios con huerto', unidad: 'beneficiarios' };
const EVIDENCIA = { id: 'e-1', version: 1, nombreOriginal: 'acta.pdf', mime: 'application/pdf', tamanoBytes: 3 * 1024 * 1024, sha256: 'a'.repeat(64), subidoPorId: 'u', createdAt: '2026-11-20T12:00:00Z', anulacion: null, reemplazaA: null, vigente: true };

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

    it('OBSERVADO: lo enviado sigue bloqueado, pero puede adjuntar otra evidencia', async () => {
      api.listarAvances.mockResolvedValue([avance({ estado: 'OBSERVADO', observacion: 'Foto borrosa', evidencias: [EVIDENCIA] })]);
      const wrapper = await montar();
      expect(wrapper.find('[data-test="quitar-evidencia"]').exists()).toBe(false);
      expect(wrapper.find('[data-test="evidencias-bloqueadas"]').exists()).toBe(true);
      expect(wrapper.get('[data-test="adjuntar"]').text()).toContain('Adjuntar otra evidencia');
    });
  });

  describe('Anulación de evidencias (SGP-135)', () => {
    const ANULADA = { ...EVIDENCIA, anulacion: { at: '2026-11-22T12:00:00Z', por: { id: 'a', nombre: 'Andrea Quispe' }, motivo: 'Foto de otra comunidad' } };

    it('el Administrador puede anular las evidencias de un avance enviado', async () => {
      api.listarAvances.mockResolvedValue([avance({ estado: 'ENVIADO', evidencias: [EVIDENCIA] })]);
      const wrapper = await montar(false, true);
      expect(wrapper.find('[data-test="anular-evidencia"]').exists()).toBe(true);
    });

    it('el Supervisor y la técnica no ven el botón de anular', async () => {
      api.listarAvances.mockResolvedValue([avance({ estado: 'ENVIADO', evidencias: [EVIDENCIA] })]);
      expect((await montar(false, false)).find('[data-test="anular-evidencia"]').exists()).toBe(false);
      expect((await montar(true, false)).find('[data-test="anular-evidencia"]').exists()).toBe(false);
    });

    it('una anulada se ve tachada, con quién, cuándo y por qué, y sin botón de anular', async () => {
      api.listarAvances.mockResolvedValue([avance({ estado: 'ENVIADO', evidencias: [ANULADA] })]);
      const wrapper = await montar(false, true);
      expect(wrapper.find('[data-test="evidencia-anulada"]').exists()).toBe(true);
      expect(wrapper.get('[data-test="motivo-anulacion"]').text()).toContain('Andrea Quispe');
      expect(wrapper.get('[data-test="motivo-anulacion"]').text()).toContain('Foto de otra comunidad');
      expect(wrapper.find('[data-test="anular-evidencia"]').exists()).toBe(false);
    });

    it('si todas sus evidencias están anuladas, la técnica no puede reenviarlo hasta adjuntar una válida', async () => {
      api.listarAvances.mockResolvedValue([avance({ estado: 'OBSERVADO', observacion: 'Sube otra', evidencias: [ANULADA] })]);
      const wrapper = await montar();
      expect(wrapper.get('[data-test="enviar-avance"]').attributes('disabled')).toBeDefined();
      expect(wrapper.get('[data-test="falta-evidencia"]').text()).toContain('anuladas');
    });

    it('al anular, la evidencia se actualiza en la lista', async () => {
      api.listarAvances.mockResolvedValue([avance({ estado: 'ENVIADO', evidencias: [EVIDENCIA] })]);
      api.anularEvidencia.mockResolvedValue(ANULADA);
      const wrapper = await montar(false, true);
      await wrapper.get('[data-test="anular-evidencia"]').trigger('click');
      await wrapper.get('[data-test="motivo"]').setValue('Foto de otra comunidad');
      await wrapper.get('[data-test="evidencia"] form').trigger('submit');
      await flushPromises();
      expect(api.anularEvidencia).toHaveBeenCalledWith('p-1', 'av-1', 'e-1', 'Foto de otra comunidad');
      expect(wrapper.find('[data-test="evidencia-anulada"]').exists()).toBe(true);
    });
  });

  describe('Versiones de evidencias (SGP-136)', () => {
    it('con el avance observado, la autora puede subir una nueva versión; en borrador o enviado, no', async () => {
      api.listarAvances.mockResolvedValue([avance({ estado: 'OBSERVADO', observacion: 'No se lee', evidencias: [EVIDENCIA] })]);
      const wrapper = await montar();
      expect(wrapper.find('[data-test="nueva-version"]').exists()).toBe(true);
      expect(wrapper.find('[data-test="ayuda-version"]').exists()).toBe(true);

      for (const estado of ['BORRADOR', 'ENVIADO'] as const) {
        api.listarAvances.mockResolvedValue([avance({ estado, evidencias: [EVIDENCIA] })]);
        expect((await montar()).find('[data-test="nueva-version"]').exists()).toBe(false);
      }
      api.listarAvances.mockResolvedValue([avance({ estado: 'OBSERVADO', evidencias: [EVIDENCIA] })]);
      expect((await montar(false, true)).find('[data-test="nueva-version"]').exists()).toBe(false);
    });

    it('al subirla, queda como vigente y la anterior pasa al historial', async () => {
      api.listarAvances.mockResolvedValue([avance({ estado: 'OBSERVADO', observacion: 'No se lee', evidencias: [EVIDENCIA] })]);
      api.subirVersion.mockResolvedValue({ ...EVIDENCIA, id: 'e-2', version: 2, reemplazaA: 'e-1', nombreOriginal: 'acta-legible.pdf' });
      const wrapper = await montar();
      const input = wrapper.get('[data-test="input-version"]');
      Object.defineProperty(input.element, 'files', { value: [archivo('acta-legible.pdf', 'application/pdf', 1024)], configurable: true });
      await input.trigger('change');
      await flushPromises();

      expect(api.subirVersion).toHaveBeenCalledWith('p-1', 'av-1', 'e-1', expect.any(File));
      const filas = wrapper.findAll('[data-test="evidencia"]');
      expect(filas).toHaveLength(1);
      expect(filas[0].text()).toContain('acta-legible.pdf');
      expect(filas[0].get('[data-test="version"]').text()).toBe('v2');
      await wrapper.get('[data-test="ver-historial"]').trigger('click');
      expect(wrapper.get('[data-test="historial"]').text()).toContain('acta.pdf');
      expect(wrapper.find('[data-test="historial"] [data-test="reemplazada"]').exists()).toBe(true);
    });

    it('un archivo no admitido no se sube como versión', async () => {
      api.listarAvances.mockResolvedValue([avance({ estado: 'OBSERVADO', evidencias: [EVIDENCIA] })]);
      const wrapper = await montar();
      const input = wrapper.get('[data-test="input-version"]');
      Object.defineProperty(input.element, 'files', { value: [archivo('virus.exe', 'application/x-msdownload', 100)], configurable: true });
      await input.trigger('change');
      await flushPromises();
      expect(api.subirVersion).not.toHaveBeenCalled();
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warn' }));
    });
  });
});