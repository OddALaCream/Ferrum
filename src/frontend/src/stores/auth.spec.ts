import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './auth';

const { iniciarSesion, renovarSesion, cerrarSesion } = vi.hoisted(() => ({
  iniciarSesion: vi.fn(),
  renovarSesion: vi.fn(),
  cerrarSesion: vi.fn(),
}));
vi.mock('@/api/auth', () => ({ iniciarSesion, renovarSesion, cerrarSesion }));

const respuesta = (rol: 'ADMINISTRADOR' | 'SUPERVISOR' | 'TECNICO' = 'TECNICO') => ({
  accessToken: 'access-1',
  expiraEn: 900,
  usuario: { id: 'u-1', email: 'tecnico@serfamilia.test', nombre: 'Lucía Condori', rol, debeCambiarPassword: false },
});

describe('store de auth', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('iniciarSesion guarda el token en memoria y traduce el rol', async () => {
    iniciarSesion.mockResolvedValue(respuesta('SUPERVISOR'));
    const auth = useAuthStore();

    await auth.iniciarSesion('  tecnico@serfamilia.test ', 'clave');

    expect(iniciarSesion).toHaveBeenCalledWith('tecnico@serfamilia.test', 'clave');
    expect(auth.autenticado).toBe(true);
    expect(auth.accessToken).toBe('access-1');
    expect(auth.role).toBe('supervisor');
    expect(auth.rolLabel).toBe('Supervisor operativo');
  });

  it('tieneAcceso respeta la lista de roles', async () => {
    iniciarSesion.mockResolvedValue(respuesta('TECNICO'));
    const auth = useAuthStore();
    await auth.iniciarSesion('a@b.co', 'x');

    expect(auth.tieneAcceso()).toBe(true);
    expect(auth.tieneAcceso(['tecnico', 'administrador'])).toBe(true);
    expect(auth.tieneAcceso(['administrador'])).toBe(false);
  });

  it('restaurarSesion recupera la sesión con la cookie y solo lo intenta una vez', async () => {
    renovarSesion.mockResolvedValue(respuesta());
    const auth = useAuthStore();

    await Promise.all([auth.restaurarSesion(), auth.restaurarSesion()]);

    expect(renovarSesion).toHaveBeenCalledTimes(1);
    expect(auth.autenticado).toBe(true);
  });

  it('si la cookie ya no sirve, queda sin sesión', async () => {
    renovarSesion.mockRejectedValue(new Error('401'));
    const auth = useAuthStore();

    await auth.restaurarSesion();

    expect(auth.autenticado).toBe(false);
    expect(auth.tieneAcceso(['tecnico'])).toBe(false);
  });

  it('cerrarSesion borra la sesión aunque el servidor falle', async () => {
    iniciarSesion.mockResolvedValue(respuesta());
    cerrarSesion.mockRejectedValue(new Error('sin red'));
    const auth = useAuthStore();
    await auth.iniciarSesion('a@b.co', 'x');

    await expect(auth.cerrarSesion()).rejects.toThrow();

    expect(auth.autenticado).toBe(false);
    expect(auth.accessToken).toBeNull();
  });
});