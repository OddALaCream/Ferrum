import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export type Rol = 'tecnico' | 'administrativo' | 'director';

export const ROLES: { value: Rol; label: string }[] = [
  { value: 'director', label: 'Director' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'administrativo', label: 'Administrativo' },
];

// Simulación de sesión hasta que el módulo auth del backend emita el JWT con el rol
export const useAuthStore = defineStore('auth', () => {
  const nombre = ref('Usuario Demo');
  const role = ref<Rol>('director');

  const rolLabel = computed(() => ROLES.find((r) => r.value === role.value)?.label ?? role.value);

  function setRole(nuevo: Rol) {
    role.value = nuevo;
  }

  /** Sin lista de roles, el recurso es visible para cualquier usuario autenticado. */
  function tieneAcceso(roles?: readonly Rol[]) {
    return !roles || roles.includes(role.value);
  }

  return { nombre, role, rolLabel, setRole, tieneAcceso };
});
