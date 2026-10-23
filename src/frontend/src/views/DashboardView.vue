<script setup lang="ts">
import Button from 'primevue/button';
import { onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';

/** Temporal: ID de PRY-DEMO-001 en database/02_seed_dev.sql (hasta existir listado). */
const PROYECTO_DEMO_SEED_ID = '33333333-3333-4333-8333-333333333333';

const app = useAppStore();
const auth = useAuthStore();
onMounted(() => app.comprobarApi());
</script>

<template>
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
        <!-- Temporal hasta que exista el listado de proyectos -->
        <RouterLink
          v-if="auth.tieneAcceso(['director', 'tecnico'])"
          v-slot="{ navigate }"
          :to="{ name: 'detalle-proyecto', params: { id: PROYECTO_DEMO_SEED_ID } }"
          custom
        >
          <Button
            label="Ver proyecto demo"
            icon="pi pi-eye"
            size="small"
            severity="secondary"
            outlined
            data-test="ver-proyecto-demo"
            @click="navigate"
          />
        </RouterLink>
        <RouterLink
          v-if="auth.tieneAcceso(['director'])"
          v-slot="{ navigate }"
          :to="{ name: 'crear-proyecto' }"
          custom
        >
          <Button
            label="Nuevo proyecto"
            icon="pi pi-plus"
            size="small"
            @click="navigate"
          />
        </RouterLink>
      </div>
    </div>
    <p class="mt-4 flex items-center gap-2 text-sm text-slate-500">
      <span
        class="h-2 w-2 rounded-full"
        :class="app.apiStatus === 'conectada' ? 'bg-green-500' : 'bg-slate-300'"
      />
      API: <strong
        class="font-medium text-slate-700"
        data-test="api-status"
      >{{ app.apiStatus }}</strong>
    </p>
  </section>
</template>
