import { flushPromises, mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TareaDialog from './TareaDialog.vue';

const api = vi.hoisted(() => ({ crearTarea: vi.fn(), editarTarea: vi.fn() }));
vi.mock('@/api/marcoLogico', () => api);
const equipo = [{ id: 'tecnico-1', nombre: 'Lucía', email: 'l@test.org', fechaAsignacion: '2026-11-01' }];
async function montar(tarea = null as null | { id: string; actividadId: string; nombre: string; responsableId: string | null; fechaLimite: string | null; estado: 'PENDIENTE'; cerradoAt: null }) {
  const w = mount(TareaDialog, {
    props: { visible: false, proyectoId: 'p-1', actividadId: 'a-1', fechaFinActividad: '2026-11-30', equipo, tarea },
    global: { plugins: [PrimeVue], stubs: { Dialog: { template: '<div><slot /></div>' }, Select: { props: ['modelValue', 'options', 'inputId'], emits: ['update:modelValue'], template: '<select :id="inputId" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option value="">Sin asignar</option><option v-for="o in options" :key="o.id || o.value" :value="o.id || o.value">{{ o.nombre || o.label }}</option></select>' } } },
  });
  await w.setProps({ visible: true });
  return w;
}
describe('Tareas (CP-24)', () => {
  beforeEach(() => vi.resetAllMocks());
  it('envía descripción, responsable del equipo y fecha límite', async () => {
    const w = await montar();
    await w.get('#tarea-descripcion').setValue('Preparar materiales');
    await w.get('#tarea-fecha').setValue('2026-11-20');
    await w.get('#tarea-responsable').setValue('tecnico-1');
    await w.get('form').trigger('submit');
    await flushPromises();
    expect(api.crearTarea).toHaveBeenCalledWith('p-1', 'a-1', { nombre: 'Preparar materiales', responsableId: 'tecnico-1', fechaLimite: '2026-11-20' });
    expect(w.emitted('guardado')).toHaveLength(1);
  });
  it('edita la tarea y permite quitar su fecha y responsable', async () => {
    const w = await montar({ id: 't-1', actividadId: 'a-1', nombre: 'Encuesta', responsableId: 'tecnico-1', fechaLimite: '2026-11-20', estado: 'PENDIENTE', cerradoAt: null });
    await w.get('#tarea-fecha').setValue('');
    await w.get('#tarea-responsable').setValue('');
    await w.get('form').trigger('submit');
    await flushPromises();
    expect(api.editarTarea).toHaveBeenCalledWith('p-1', 't-1', { nombre: 'Encuesta', responsableId: null, fechaLimite: null, estado: 'PENDIENTE' });
  });
  it('rechaza una fecha posterior al fin de la actividad al crear', async () => {
    const w = await montar();
    await w.get('#tarea-descripcion').setValue('Fuera de plazo');
    await w.get('#tarea-fecha').setValue('2026-12-01');
    await w.get('form').trigger('submit');
    expect(api.crearTarea).not.toHaveBeenCalled();
    expect(w.get('[data-test="error-tarea"]').text()).toContain('no puede superar');
    expect(w.get('#tarea-fecha').attributes('max')).toBe('2026-11-30');
  });
  it('rechaza una fecha posterior al fin de la actividad al editar', async () => {
    const w = await montar({ id: 't-1', actividadId: 'a-1', nombre: 'Encuesta', responsableId: null, fechaLimite: '2026-11-20', estado: 'PENDIENTE', cerradoAt: null });
    await w.get('#tarea-fecha').setValue('2026-12-01');
    await w.get('form').trigger('submit');
    expect(api.editarTarea).not.toHaveBeenCalled();
    expect(w.get('[data-test="error-tarea"]').text()).toContain('no puede superar');
  });
  it('permite una fecha igual al fin de la actividad', async () => {
    const w = await montar();
    await w.get('#tarea-descripcion').setValue('Entrega final');
    await w.get('#tarea-fecha').setValue('2026-11-30');
    await w.get('form').trigger('submit');
    await flushPromises();
    expect(api.crearTarea).toHaveBeenCalledWith('p-1', 'a-1', { nombre: 'Entrega final', fechaLimite: '2026-11-30' });
  });
  it('conserva el formulario y muestra el error al fallar el servidor', async () => {
    api.crearTarea.mockRejectedValue(new Error('Sin conexión'));
    const w = await montar();
    await w.get('#tarea-descripcion').setValue('Encuesta');
    await w.get('form').trigger('submit');
    await flushPromises();
    expect(w.emitted('guardado')).toBeUndefined();
    expect((w.get('#tarea-descripcion').element as HTMLInputElement).value).toBe('Encuesta');
    expect(w.find('[data-test="error-tarea"]').exists()).toBe(true);
  });
});
