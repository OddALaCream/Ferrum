import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Usuario } from '@/api/usuarios';
import { sesionDePrueba } from '@/test/helpers/sesion';
import UsuariosView from './UsuariosView.vue';

const { listarUsuarios, editarUsuario, eliminarUsuario, toastAdd, confirmRequire } = vi.hoisted(() => ({
  listarUsuarios: vi.fn(),
  editarUsuario: vi.fn(),
  eliminarUsuario: vi.fn(),
  toastAdd: vi.fn(),
  confirmRequire: vi.fn(),
}));

vi.mock('@/api/usuarios', async (original) => ({
  ...(await original<typeof import('@/api/usuarios')>()),
  listarUsuarios,
  editarUsuario,
  eliminarUsuario,
  crearUsuario: vi.fn(),
  restablecerPassword: vi.fn(),
}));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: confirmRequire }) }));

const usuario = (cambios: Partial<Usuario> = {}): Usuario => ({
  id: 'u-1',
  nombre: 'Lucía Condori',
  email: 'tecnico@serfamilia.test',
  rol: 'TECNICO',
  activo: true,
  bloqueado: false,
  debeCambiarPassword: false,
  ultimoLoginAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  ...cambios,
});

async function montar() {
  const pinia = createPinia();
  setActivePinia(pinia);
  sesionDePrueba('administrador');
  const wrapper = mount(UsuariosView, {
    global: { plugins: [pinia, PrimeVue], directives: { tooltip: {} }, stubs: { UsuarioDialog: true, PasswordDialog: true } },
  });
  await flushPromises();
  return wrapper;
}

describe('UsuariosView (SGP-55)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // DataTable consulta matchMedia para su diseño responsive; jsdom no lo trae
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
  });

  it('lista los usuarios con su rol y estado', async () => {
    listarUsuarios.mockResolvedValue([usuario(), usuario({ id: 'u-2', nombre: 'Rodrigo', rol: 'SUPERVISOR', bloqueado: true })]);
    const wrapper = await montar();

    const texto = wrapper.get('[data-test="tabla-usuarios"]').text();
    expect(texto).toContain('Lucía Condori');
    expect(texto).toContain('Técnico de campo');
    expect(texto).toContain('Supervisor operativo');
    expect(texto).toContain('Bloqueado');
  });

  it('desactivar llama a la API con activo: false', async () => {
    listarUsuarios.mockResolvedValue([usuario()]);
    editarUsuario.mockResolvedValue(usuario({ activo: false }));
    const wrapper = await montar();

    await wrapper.get('[data-test="alternar"]').trigger('click');
    await flushPromises();

    expect(editarUsuario).toHaveBeenCalledWith('u-1', { activo: false });
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ summary: 'Cuenta desactivada' }));
  });

  it('eliminar pide confirmación y luego llama a la API', async () => {
    listarUsuarios.mockResolvedValue([usuario()]);
    eliminarUsuario.mockResolvedValue(undefined);
    const wrapper = await montar();

    await wrapper.get('[data-test="eliminar"]').trigger('click');
    expect(eliminarUsuario).not.toHaveBeenCalled();
    await confirmRequire.mock.calls[0][0].accept();

    expect(eliminarUsuario).toHaveBeenCalledWith('u-1');
  });

  it('no deja desactivar ni eliminar la propia cuenta', async () => {
    listarUsuarios.mockResolvedValue([usuario({ id: 'u-prueba', rol: 'ADMINISTRADOR' })]);
    const wrapper = await montar();

    expect(wrapper.get('[data-test="eliminar"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-test="alternar"]').attributes('disabled')).toBeDefined();
  });
});