import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as apiAuth from '@/api/auth';
import type { RespuestaSesion, RolApi } from '@/api/auth';

/**
 * Roles del sistema:
 * - administrador: usuarios, proyectos, marco lógico y paneles (MIS/DSS).
 * - supervisor: operativo-supervisor; presupuesto, desembolsos y reportes (ERP).
 * - tecnico: técnico de campo; actividades y avances (TPS).
 */
export type Rol = 'administrador' | 'supervisor' | 'tecnico';

export const ROLES: { value: Rol; label: string }[] = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'supervisor', label: 'Supervisor operativo' },
  { value: 'tecnico', label: 'Técnico de campo' },
];

const DESDE_API: Record<RolApi, Rol> = {
  ADMINISTRADOR: 'administrador',
  SUPERVISOR: 'supervisor',
  TECNICO: 'tecnico',
};

export interface UsuarioSesion {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  debeCambiarPassword: boolean;
}

export const useAuthStore = defineStore('auth', () => {
  const usuario = ref<UsuarioSesion | null>(null);
  /** Solo en memoria: nunca en localStorage (un script inyectado no podría leerlo de ahí). */
  const accessToken = ref<string | null>(null);

  let restauracion: Promise<void> | null = null;
  let renovacion: Promise<string | null> | null = null;

  const autenticado = computed(() => usuario.value !== null && accessToken.value !== null);
  const nombre = computed(() => usuario.value?.nombre ?? '');
  const role = computed<Rol | null>(() => usuario.value?.rol ?? null);
  const rolLabel = computed(() => ROLES.find((r) => r.value === role.value)?.label ?? '');

  function aplicarSesion(r: RespuestaSesion) {
    accessToken.value = r.accessToken;
    usuario.value = { ...r.usuario, rol: DESDE_API[r.usuario.rol] };
  }

  function limpiar() {
    accessToken.value = null;
    usuario.value = null;
  }

  async function iniciarSesion(email: string, password: string) {
    aplicarSesion(await apiAuth.iniciarSesion(email.trim(), password));
  }

  /** Renueva el access token. Varias peticiones con 401 a la vez comparten una sola renovación. */
  function renovar(): Promise<string | null> {
    renovacion ??= apiAuth
      .renovarSesion()
      .then((r) => {
        aplicarSesion(r);
        return r.accessToken;
      })
      .catch(() => {
        limpiar();
        return null;
      })
      .finally(() => {
        renovacion = null;
      });
    return renovacion;
  }

  /** Al recargar la página la sesión se recupera con la cookie de refresh (una sola vez). */
  function restaurarSesion(): Promise<void> {
    if (autenticado.value) return Promise.resolve();
    restauracion ??= renovar().then(() => undefined);
    return restauracion;
  }

  /** SGP-45: revoca la sesión en el servidor y la borra del navegador. */
  async function cerrarSesion() {
    try {
      await apiAuth.cerrarSesion();
    } finally {
      limpiar();
      restauracion = Promise.resolve();
    }
  }

  /** Sin lista de roles, el recurso es visible para cualquier usuario autenticado. */
  function tieneAcceso(roles?: readonly Rol[]) {
    if (!roles) return true;
    return role.value !== null && roles.includes(role.value);
  }

  return {
    usuario,
    accessToken,
    autenticado,
    nombre,
    role,
    rolLabel,
    aplicarSesion,
    limpiar,
    iniciarSesion,
    renovar,
    restaurarSesion,
    cerrarSesion,
    tieneAcceso,
  };
});