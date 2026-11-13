<script setup lang="ts">
import Button from 'primevue/button';
import { computed } from 'vue';
import DashboardAdministrador from '@/components/dashboard/DashboardAdministrador.vue';
import DashboardSupervisor from '@/components/dashboard/DashboardSupervisor.vue';
import DashboardTecnico from '@/components/dashboard/DashboardTecnico.vue';
import { useAuthStore } from '@/stores/auth';

/**
 * Cada rol tiene su propio panel:
 * - Administrador: toda la cartera, con el presupuesto.
 * - Supervisor: sus proyectos y lo que se está atrasando.
 * - Técnico: lo que le toca hacer.
 */
const auth = useAuthStore();
const esTecnico = computed(() => auth.role === 'tecnico');
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-base font-semibold text-slate-800">
            Bienvenido, {{ auth.nombre }}
          </h2>
          <p class="mt-1 text-sm text-slate-500">
            Has iniciado sesión con el perfil {{ auth.rolLabel }}.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <RouterLink
            v-slot="{ navigate }"
            :to="{ name: 'proyectos' }"
            custom
          >
            <Button
              :label="esTecnico ? 'Mis proyectos' : 'Ver proyectos'"
              icon="pi pi-briefcase"
              size="small"
              severity="secondary"
              outlined
              data-test="ver-proyectos"
              @click="navigate"
            />
          </RouterLink>
          <RouterLink
            v-if="auth.tieneAcceso(['administrador'])"
            v-slot="{ navigate }"
            :to="{ name: 'crear-proyecto' }"
            custom
          >
            <Button
              label="Nuevo proyecto"
              icon="pi pi-plus"
              size="small"
              data-test="nuevo-proyecto"
              @click="navigate"
            />
          </RouterLink>
        </div>
      </div>
    </section>

    <DashboardAdministrador v-if="auth.role === 'administrador'" />
    <DashboardSupervisor v-else-if="auth.role === 'supervisor'" />
    <DashboardTecnico v-else-if="esTecnico" />
  </div>
</template>