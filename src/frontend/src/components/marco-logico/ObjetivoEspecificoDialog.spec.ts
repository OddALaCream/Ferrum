import { flushPromises, mount } from '@vue/test-utils';
import { AxiosError } from 'axios';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ObjetivoEspecificoDialog from './ObjetivoEspecificoDialog.vue';

const { crearObjetivo, toastAdd } = vi.hoisted(() => ({
  crearObjetivo: vi.fn(),
  toastAdd: vi.fn(),
}));
vi.mock('@/api/objetivos', () => ({ crearObjetivo }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));

async function montar() {
  const wrapper = mount(ObjetivoEspecificoDialog, {
    props: { visible: false, proyectoId: 'p-1', sugerencia: 'OE.1' },
    global: {
      plugins: [PrimeVue, ToastService],
      stubs: {
        Dialog: { template: '<div><slot /></div>' },
        // Textarea de PrimeVue usa ResizeObserver, ausente en jsdom.
        Textarea: {
          props: ['modelValue', 'invalid', 'disabled', 'id'],
          emits: ['update:modelValue'],
          template:
            '<textarea :id="id" data-test="oe-descripcion" :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
      },
    },
  });
  await wrapper.setProps({ visible: true });
  await wrapper.vm.$nextTick();
  return wrapper;
}

describe('ObjetivoEspecificoDialog (SGP-162)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('abre el modal y llama a crearObjetivo al guardar', async () => {
    crearObjetivo.mockResolvedValue({
      id: 'oe-1',
      proyectoId: 'p-1',
      codigo: 'OE.1',
      descripcion: 'Desarrollar habilidades parentales',
      createdAt: '',
      updatedAt: '',
    });

    const wrapper = await montar();
    expect(wrapper.find('[data-test="form-objetivo"]').exists()).toBe(true);
    expect((wrapper.get('[data-test="oe-codigo"]').element as HTMLInputElement).value).toBe('OE.1');

    await wrapper.get('[data-test="oe-descripcion"]').setValue('Desarrollar habilidades parentales');
    await wrapper.get('[data-test="form-objetivo"]').trigger('submit');
    await flushPromises();

    expect(crearObjetivo).toHaveBeenCalledWith('p-1', {
      codigo: 'OE.1',
      descripcion: 'Desarrollar habilidades parentales',
    });
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    expect(wrapper.emitted('guardado')).toHaveLength(1);
    expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false]);
  });

  it('no envía si faltan campos', async () => {
    const wrapper = await montar();
    await wrapper.get('[data-test="oe-codigo"]').setValue('');
    await wrapper.get('[data-test="form-objetivo"]').trigger('submit');

    expect(crearObjetivo).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="error-oe-codigo"]').text()).toContain('código');
  });

  it('muestra toast rojo con Problem Details si el backend responde 409', async () => {
    crearObjetivo.mockRejectedValue(
      new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: {} as never,
        data: {
          status: 409,
          title: 'Conflict',
          detail: 'Ya existe un objetivo específico con ese código en el proyecto.',
        },
      }),
    );

    const wrapper = await montar();
    await wrapper.get('[data-test="oe-descripcion"]').setValue('Duplicado');
    await wrapper.get('[data-test="form-objetivo"]').trigger('submit');
    await flushPromises();

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: 'Código duplicado',
        detail: 'Ya existe un objetivo específico con ese código en el proyecto.',
      }),
    );
    expect(wrapper.emitted('guardado')).toBeUndefined();
  });
});
