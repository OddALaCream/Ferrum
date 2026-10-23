import { flushPromises, mount } from '@vue/test-utils';
import { AxiosError, AxiosHeaders } from 'axios';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OlvideContrasenaView from './OlvideContrasenaView.vue';

const { solicitarRestablecimiento } = vi.hoisted(() => ({ solicitarRestablecimiento: vi.fn() }));
vi.mock('@/api/auth', () => ({ solicitarRestablecimiento }));

function errorHttp(status: number) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('error', String(status), config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { type: 'about:blank', title: '', status, detail: '', instance: '/api/auth/olvide-mi-contrasena' },
  });
}

function montar() {
  return mount(OlvideContrasenaView, {
    global: { plugins: [createPinia(), PrimeVue], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  });
}

async function enviar(wrapper: ReturnType<typeof montar>, email: string) {
  await wrapper.get('#email').setValue(email);
  await wrapper.get('[data-test="form-olvide"]').trigger('submit');
  await flushPromises();
}

describe('OlvideContrasenaView (SGP-110)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('valida el correo antes de llamar a la API', async () => {
    const wrapper = montar();
    await enviar(wrapper, 'no-es-correo');

    expect(solicitarRestablecimiento).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="error-email"]').text()).toContain('nombre@dominio.org');
  });

  it('pide el enlace y muestra la confirmación sin revelar si el correo existe', async () => {
    solicitarRestablecimiento.mockResolvedValue(undefined);
    const wrapper = montar();
    await enviar(wrapper, ' tecnico@serfamilia.test ');

    expect(solicitarRestablecimiento).toHaveBeenCalledWith('tecnico@serfamilia.test');
    const texto = wrapper.get('[data-test="confirmacion"]').text();
    expect(texto).toContain('Revisa tu correo');
    expect(texto).toContain('Si tecnico@serfamilia.test está registrado');
  });

  it('con demasiadas solicitudes (429) avisa que espere un minuto', async () => {
    solicitarRestablecimiento.mockRejectedValue(errorHttp(429));
    const wrapper = montar();
    await enviar(wrapper, 'tecnico@serfamilia.test');

    expect(wrapper.get('[data-test="error-servidor"]').text()).toContain('Espera un minuto');
  });

  it('sin conexión muestra un mensaje claro y no confirma el envío', async () => {
    solicitarRestablecimiento.mockRejectedValue(new Error('Network Error'));
    const wrapper = montar();
    await enviar(wrapper, 'tecnico@serfamilia.test');

    expect(wrapper.get('[data-test="error-servidor"]').text()).toContain('No hay conexión');
    expect(wrapper.find('[data-test="confirmacion"]').exists()).toBe(false);
  });
});