import type { RolApi } from '@/api/auth';
import { useAuthStore, type Rol } from '@/stores/auth';

/** Deja al store de auth con una sesión iniciada con el rol indicado (solo pruebas). */
export function sesionDePrueba(rol: Rol, nombre = 'Usuario Demo') {
  useAuthStore().aplicarSesion({
    accessToken: 'token-de-prueba',
    expiraEn: 900,
    usuario: {
      id: 'u-prueba',
      email: `${rol}@serfamilia.test`,
      nombre,
      rol: rol.toUpperCase() as RolApi,
      debeCambiarPassword: false,
    },
  });
}