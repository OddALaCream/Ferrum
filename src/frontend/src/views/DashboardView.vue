<script setup lang="ts">
import Button from 'primevue/button';
import { computed, onMounted, ref } from 'vue';
import { obtenerResumen, type EstadoProyecto, type ResumenCartera } from '@/api/proyectos';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { formatoMonto } from '@/utils/formato';
import { ESTADOS_PROYECTO } from './Proyectos/estadoProyecto';

const app = useAppStore();
const auth = useAuthStore();

const resumen = ref<ResumenCartera | null>(null);
const fallo = ref(false);

const esTecnico = computed(() => auth.role === 'tecnico');
const BARRAS: Record<EstadoProyecto, string> = {
  PLANIFICACION: 'bg-sky-500',
  EN_EJECUCION: 'bg-green-500',
  PAUSADO: 'bg-amber-500',
  CERRADO: 'bg-slate-400',
};
const estados = computed(() =>
  (Object.keys(ESTADOS_PROYECTO) as EstadoProyecto[]).map((e) => ({
    clave: e,
    ...ESTADOS_PROYECTO[e],
    cantidad: resumen.value?.porEstado[e] ?? 0,
    barra: BARRAS[e],
  })),
);
const total = computed(() => resumen.value?.totalProyectos ?? 0);

onMounted(async () => {
  app.comprobarApi();
  try {
    resumen.value = await obtenerResumen();
  } catch {
    fallo.value = true;
  }
});
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

    <p
      v-if="fallo"
      class="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-900/5"
      data-test="fallo-indicadores"
    >
      No se pudieron cargar los indicadores. Recarga la página para intentarlo de nuevo.
    </p>

    <template v-else-if="resumen">
      <section
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Indicadores de la cartera"
      >
        <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
            {{ esTecnico ? 'Mis proyectos' : 'Proyectos' }}
          </p>
          <p
            class="mt-2 text-3xl font-semibold text-slate-800"
            data-test="kpi-total"
          >
            {{ resumen.totalProyectos }}
          </p>
        </div>
        <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
            En ejecución
          </p>
          <p
            class="mt-2 text-3xl font-semibold text-green-700"
            data-test="kpi-ejecucion"
          >
            {{ resumen.porEstado.EN_EJECUCION }}
          </p>
        </div>
        <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
            Presupuesto total
          </p>
          <p
            class="mt-2 text-2xl font-semibold tabular-nums text-slate-800"
            data-test="kpi-presupuesto"
          >
            {{ formatoMonto(resumen.presupuestoBob, 'BOB') }}
          </p>
        </div>
        <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
            Técnicos activos
          </p>
          <p
            class="mt-2 text-3xl font-semibold text-slate-800"
            data-test="kpi-tecnicos"
          >
            {{ resumen.tecnicosActivos }}
          </p>
        </div>
      </section>

      <section class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
        <h3 class="text-sm font-semibold text-slate-700">
          Proyectos por estado
        </h3>
        <p
          v-if="total === 0"
          class="mt-3 text-sm text-slate-500"
          data-test="sin-proyectos"
        >
          {{ esTecnico ? 'Todavía no te asignaron a ningún proyecto.' : 'Todavía no hay proyectos registrados.' }}
        </p>
        <ul
          v-else
          class="mt-4 space-y-3"
        >
          <li
            v-for="e in estados"
            :key="e.clave"
          >
            <div class="mb-1 flex items-center justify-between text-sm">
              <span class="flex items-center gap-2 text-slate-600"><i :class="[e.icono, 'text-xs text-slate-400']" />{{ e.label }}</span>
              <span class="font-medium tabular-nums text-slate-800">{{ e.cantidad }}</span>
            </div>
            <div
              class="h-2 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              :aria-label="`${e.label}: ${e.cantidad} de ${total}`"
              :aria-valuenow="e.cantidad"
              aria-valuemin="0"
              :aria-valuemax="total"
            >
              <div
                :class="['h-full rounded-full', e.barra]"
                :style="{ width: `${(e.cantidad / total) * 100}%` }"
              />
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>