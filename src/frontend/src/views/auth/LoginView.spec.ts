import { flushPromises, mount } from '@vue/test-utils';
import { AxiosError, AxiosHeaders } from 'axios';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth';
import LoginView from './LoginView.vue';

const { iniciarSesion, replace, query } = vi.hoisted(() => ({
  iniciarSesion: vi.fn(),
  replace: vi.fn(),
  query: { value: {} as Record<string, string> },
}));
vi.mock('@/api/auth', () => ({ iniciarSesion, renovarSesion: vi.fn(), cerrarSesion: vi.fn() }));
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
    data: { type: 'about:blank', title: '', status, detail, instance: '/api/auth/login' },
  });
}

async function montar() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(LoginView, { global: { plugins: [pinia, PrimeVue] } });
  return wrapper;
}

async function enviar(wrapper: Awaited<ReturnType<typeof montar>>, email: string, password: string) {
  await wrapper.get('#email').setValue(email);
  await wrapper.get('#password').setValue(password);
  await wrapper.get('[data-test="form-login"]').trigger('submit');
  await flushPromises();
}

describe('LoginView (SGP-41)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    query.value = {};
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
  });

  it('valida los campos antes de llamar a la API', async () => {
    const wrapper = await montar();
    await enviar(wrapper, 'no-es-correo', '');

    expect(iniciarSesion).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="error-email"]').text()).toContain('nombre@dominio.org');
    expect(wrapper.get('[data-test="error-password"]').text()).toContain('Ingresa tu contraseña');
  });

  it('con credenciales válidas inicia sesión y entra al dashboard', async () => {
    iniciarSesion.mockResolvedValue({
      accessToken: 'a',
      expiraEn: 900,
      usuario: { id: 'u', email: 'admin@serfamilia.test', nombre: 'Andrea', rol: 'ADMINISTRADOR', debeCambiarPassword: false },
    });
    const wrapper = await montar();
    await enviar(wrapper, 'admin@serfamilia.test', 'Serfamilia2026');

    expect(iniciarSesion).toHaveBeenCalledWith('admin@serfamilia.test', 'Serfamilia2026');
    expect(useAuthStore().role).toBe('administrador');
    expect(replace).toHaveBeenCalledWith('/dashboard');
  });

  it('vuelve a la página que se pidió antes del login', async () => {
    query.value = { redirect: '/proyectos/nuevo' };
    iniciarSesion.mockResolvedValue({
      accessToken: 'a',
      expiraEn: 900,
      usuario: { id: 'u', email: 'a@b.co', nombre: 'A', rol: 'ADMINISTRADOR', debeCambiarPassword: false },
    });
    const wrapper = await montar();
    await enviar(wrapper, 'a@b.co', 'x');
    expect(replace).toHaveBeenCalledWith('/proyectos/nuevo');
  });

  it('con un 401 muestra un mensaje que no revela si el correo existe y limpia la contraseña', async () => {
    iniciarSesion.mockRejectedValue(errorHttp(401, 'Correo o contraseña incorrectos.'));
    const wrapper = await montar();
    await enviar(wrapper, 'admin@serfamilia.test', 'mala');

    expect(wrapper.get('[data-test="error-login"]').text()).toContain('Correo o contraseña incorrectos');
    expect((wrapper.get('#password').element as HTMLInputElement).value).toBe('');
    expect(replace).not.toHaveBeenCalled();
  });

  it('CP-17: con la cuenta bloqueada muestra el aviso del servidor', async () => {
    const detalle = 'Cuenta bloqueada por 5 intentos fallidos. Vuelve a intentarlo en 15 minutos.';
    iniciarSesion.mockRejectedValue(errorHttp(423, detalle));
    const wrapper = await montar();
    await enviar(wrapper, 'tecnico@serfamilia.test', 'mala');

    expect(wrapper.get('[data-test="error-login"]').text()).toBe(detalle);
  });

  it('avisa cuando la sesión venció', async () => {
    query.value = { expirada: '1' };
    const wrapper = await montar();
    expect(wrapper.get('[data-test="aviso"]').text()).toContain('Tu sesión venció');
  });
});