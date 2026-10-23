import { flushPromises, mount } from '@vue/test-utils';
import { AxiosError, AxiosHeaders } from 'axios';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RestablecerPasswordView from './RestablecerPasswordView.vue';

const { restablecerPassword, replace, query } = vi.hoisted(() => ({
  restablecerPassword: vi.fn(),
  replace: vi.fn(),
  query: { value: {} as Record<string, string> },
}));
vi.mock('@/api/auth', () => ({ restablecerPassword }));
vi.mock('vue-router', () => ({
  useRouter: () => ({ replace }),
  useRoute: () => ({ query: query.value }),
}));

function errorHttp(status: number, detail = '') {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('error', String(status), config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { type: 'about:blank', title: '', status, detail, instance: '/api/auth/restablecer-password' },
  });
}

function montar() {
  return mount(RestablecerPasswordView, {
    global: { plugins: [createPinia(), PrimeVue], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  });
}

async function enviar(wrapper: ReturnType<typeof montar>, password: string, confirmacion: string) {
  await wrapper.get('#password').setValue(password);
  await wrapper.get('#confirmacion').setValue(confirmacion);
  await wrapper.get('[data-test="form-restablecer"]').trigger('submit');
  await flushPromises();
}

describe('RestablecerPasswordView (SGP-110 / CP-33)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.value = { token: 'token-del-enlace' };
  });

  it('sin token en el enlace ofrece pedir uno nuevo', () => {
    query.value = {};
    const wrapper = montar();
    expect(wrapper.get('[data-test="enlace-invalido"]').text()).toContain('Este enlace ya no sirve');
    expect(wrapper.find('[data-test="form-restablecer"]').exists()).toBe(false);
  });

  it('valida el mínimo de 8 caracteres y que ambas contraseñas coincidan', async () => {
    const wrapper = montar();
    await enviar(wrapper, 'corta', 'otra');

    expect(restablecerPassword).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="error-password"]').text()).toContain('al menos 8');
    expect(wrapper.get('[data-test="error-confirmacion"]').text()).toContain('no coinciden');
  });

  it('guarda la contraseña con el token del enlace y vuelve al login con el aviso', async () => {
    restablecerPassword.mockResolvedValue(undefined);
    const wrapper = montar();
    await enviar(wrapper, 'Nueva-clave-1', 'Nueva-clave-1');

    expect(restablecerPassword).toHaveBeenCalledWith('token-del-enlace', 'Nueva-clave-1');
    expect(replace).toHaveBeenCalledWith({ name: 'login', query: { restablecida: '1' } });
  });

  it('CP-33: un enlace usado o vencido (400) muestra "Este enlace ya no sirve"', async () => {
    restablecerPassword.mockRejectedValue(errorHttp(400, 'El enlace no es válido o ya venció.'));
    const wrapper = montar();
    await enviar(wrapper, 'Nueva-clave-1', 'Nueva-clave-1');

    expect(wrapper.find('[data-test="enlace-invalido"]').exists()).toBe(true);
    expect(replace).not.toHaveBeenCalled();
  });

  it('un error de validación del servidor no invalida el enlace', async () => {
    restablecerPassword.mockRejectedValue(errorHttp(400, 'La contraseña debe tener al menos 8 caracteres.'));
    const wrapper = montar();
    await enviar(wrapper, 'Nueva-clave-1', 'Nueva-clave-1');

    expect(wrapper.find('[data-test="enlace-invalido"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="form-restablecer"]').exists()).toBe(true);
  });
});