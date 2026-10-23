import { flushPromises, mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import DataTable from 'primevue/datatable';
import DatePicker from 'primevue/datepicker';
import Select from 'primevue/select';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegistroAuditoria } from '@/api/auditoria';
import BitacoraView from './BitacoraView.vue';

const PROYECTO = '33333333-3333-4333-8333-333333333333';
const USUARIO = '22222222-2222-4222-8222-222222222221';

const { consultarBitacora, obtenerOpcionesBitacora, toastAdd } = vi.hoisted(() => ({
  consultarBitacora: vi.fn(),
  obtenerOpcionesBitacora: vi.fn(),
  toastAdd: vi.fn(),
}));

vi.mock('@/api/auditoria', () => ({ consultarBitacora, obtenerOpcionesBitacora }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));

const registro: RegistroAuditoria = {
  id: '4',
  fecha: '2026-10-23T04:17:17.161Z',
  usuarioId: USUARIO,
  usuarioEmail: 'director@serfamilia.test',
  usuarioNombre: 'Director Demo',
  accion: 'ACTUALIZAR',
  entidad: 'proyectos',
  entidadId: PROYECTO,
  proyectoId: PROYECTO,
  proyectoCodigo: 'PRY-DEMO-001',
  valorAnterior: { presupuesto_total: '0.00' },
  valorNuevo: { presupuesto_total: '850000.50' },
  ip: '10.0.0.5',
  userAgent: 'Mozilla/5.0',
};

async function montar() {
  const wrapper = mount(BitacoraView, {
    global: { plugins: [PrimeVue], stubs: { Select: true, DatePicker: true } },
  });
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof montar>>;

const filtro = (w: Wrapper, nombre: string) =>
  w.findAllComponents(Select).find((s) => s.attributes('data-test') === `filtro-${nombre}`)!;

const ultimaConsulta = () => consultarBitacora.mock.calls.at(-1)![0];

describe('BitacoraView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consultarBitacora.mockResolvedValue({ items: [registro], total: 1, pagina: 1, limite: 20 });
    obtenerOpcionesBitacora.mockResolvedValue({
      usuarios: [{ id: USUARIO, nombre: 'Director Demo', email: 'director@serfamilia.test' }],
      entidades: ['proyectos'],
      proyectos: [{ id: PROYECTO, codigo: 'PRY-DEMO-001', nombre: 'Proyecto de demostración' }],
    });
  });

  it('carga la primera página sin filtros y muestra quién, qué, cuándo y desde dónde', async () => {
    const wrapper = await montar();

    expect(consultarBitacora).toHaveBeenCalledWith(expect.objectContaining({ pagina: 1, limite: 20, entidad: undefined }));
    const tabla = wrapper.get('[data-test="tabla-bitacora"]').text();
    expect(tabla).toContain('Director Demo');
    expect(tabla).toContain('Modificación');
    expect(tabla).toContain('Proyecto');
    expect(tabla).toContain('PRY-DEMO-001');
    expect(tabla).toContain('10.0.0.5');
    expect(tabla).toMatch(/23\/10\/2026/);
  });

  it('ofrece las opciones de filtro que devuelve la API', async () => {
    const wrapper = await montar();

    expect(filtro(wrapper, 'usuario').attributes('options')).toBeDefined();
    expect(obtenerOpcionesBitacora).toHaveBeenCalledOnce();
  });

  it('filtra por usuario, entidad y proyecto', async () => {
    const wrapper = await montar();

    filtro(wrapper, 'usuario').vm.$emit('update:modelValue', USUARIO);
    filtro(wrapper, 'entidad').vm.$emit('update:modelValue', 'proyectos');
    filtro(wrapper, 'proyecto').vm.$emit('update:modelValue', PROYECTO);
    await flushPromises();

    expect(ultimaConsulta()).toMatchObject({ usuarioId: USUARIO, entidad: 'proyectos', proyectoId: PROYECTO, pagina: 1 });
  });

  it('filtra por rango de fechas y espera a que se elija la segunda fecha', async () => {
    const wrapper = await montar();
    const fechas = wrapper.findComponent(DatePicker);
    const llamadas = consultarBitacora.mock.calls.length;

    fechas.vm.$emit('update:modelValue', [new Date(2026, 9, 1), null]);
    await flushPromises();
    expect(consultarBitacora.mock.calls.length).toBe(llamadas);

    fechas.vm.$emit('update:modelValue', [new Date(2026, 9, 1), new Date(2026, 9, 23)]);
    await flushPromises();
    expect(ultimaConsulta()).toMatchObject({ desde: '2026-10-01', hasta: '2026-10-23' });
  });

  it('al cambiar de página pide esa página con el tamaño elegido', async () => {
    const wrapper = await montar();

    wrapper.findComponent(DataTable).vm.$emit('page', { page: 2, rows: 50, first: 100 });
    await flushPromises();

    expect(ultimaConsulta()).toMatchObject({ pagina: 3, limite: 50 });
  });

  it('al expandir un registro muestra el valor anterior y el nuevo de cada campo', async () => {
    const wrapper = await montar();

    await wrapper.get('[data-pc-section="rowtogglebutton"]').trigger('click');
    await flushPromises();

    const fila = wrapper.get('[data-test="campo-presupuesto_total"]').text();
    expect(fila).toContain('0.00');
    expect(fila).toContain('850000.50');
    expect(wrapper.get('[data-test="detalle-registro"]').text()).toContain('Mozilla/5.0');
  });

  it('no ofrece ninguna acción para editar o borrar registros', async () => {
    const wrapper = await montar();
    const textos = wrapper.findAll('button').map((b) => b.text().toLowerCase());
    expect(textos.some((t) => /editar|eliminar|borrar/.test(t))).toBe(false);
  });

  it('avisa si la API falla', async () => {
    consultarBitacora.mockRejectedValue(new Error('caída'));
    await montar();
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });
});
