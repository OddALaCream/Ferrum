<script setup lang="ts">
import { onMounted, ref } from 'vue';
import BarraAvance from '@/components/marco-logico/BarraAvance.vue';
import { obtenerMiTrabajo, type MiTrabajo } from '@/api/seguimiento';
import { formatoFecha, formatoFechaCorta } from '@/utils/formato';
import TarjetaIndicador from './TarjetaIndicador.vue';

/** Panel del Técnico: lo que le toca hacer. Sus actividades y tareas, lo retrasado primero. */
const trabajo = ref<MiTrabajo | null>(null);
const fallo = ref(false);

onMounted(async () => {
  try {
    trabajo.value = await obtenerMiTrabajo();
  } catch {
    fallo.value = true;
  }
});
</script>

<template>
  <p
    v-if="fallo"
    class="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-900/5"
    data-test="fallo-indicadores"
  >
    No se pudo cargar tu trabajo. Recarga la página para intentarlo de nuevo.
  </p>

  <section
    v-else-if="trabajo && trabajo.actividades.length === 0 && trabajo.tareas.length === 0"
    class="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-900/5"
    data-test="sin-trabajo"
  >
    <i class="pi pi-check-circle text-3xl text-green-500" />
    <h3 class="mt-3 text-base font-semibold text-slate-800">
      No tienes nada pendiente
    </h3>
    <p class="mt-1 text-sm text-slate-500">
      Cuando el Administrador te asigne actividades, aparecerán aquí.
    </p>
  </section>

  <template v-else-if="trabajo">
    <section
      class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Mi trabajo"
    >
      <TarjetaIndicador
        titulo="Actividades por cumplir"
        :valor="trabajo.resumen.actividadesActivas"
        data-test="kpi-actividades"
      />
      <TarjetaIndicador
        titulo="Retrasadas"
        :valor="trabajo.resumen.actividadesRetrasadas"
        :tono="trabajo.resumen.actividadesRetrasadas ? 'alerta' : 'normal'"
        data-test="kpi-retrasadas"
      />
      <TarjetaIndicador
        titulo="Tareas pendientes"
        :valor="trabajo.resumen.tareasPendientes"
        :nota="trabajo.resumen.tareasVencidas ? `${trabajo.resumen.tareasVencidas} vencidas` : undefined"
        data-test="kpi-tareas"
      />
      <TarjetaIndicador
        titulo="Sesiones sin marcar"
        :valor="trabajo.resumen.sesionesSinMarcar"
        :tono="trabajo.resumen.sesionesSinMarcar ? 'alerta' : 'normal'"
        nota="ya pasó su fecha"
        data-test="kpi-sesiones"
      />
    </section>

    <section class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
      <h3 class="text-sm font-semibold text-slate-700">
        Mis actividades
      </h3>
      <ul class="mt-4 divide-y divide-slate-100">
        <li
          v-for="a in trabajo.actividades"
          :key="a.id"
          class="py-3 first:pt-0 last:pb-0"
          data-test="mi-actividad"
        >
          <RouterLink
            :to="{ name: 'marco-logico-proyecto', params: { id: a.proyectoId } }"
            class="group block"
          >
            <p class="flex flex-wrap items-baseline justify-between gap-2">
              <span class="min-w-0 text-sm text-slate-800 group-hover:underline">
                <span class="mr-1.5 text-xs font-semibold text-violet-800">{{ a.codigo }}</span>{{ a.nombre }}
              </span>
              <span
                v-if="a.retrasada"
                class="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20"
                data-test="etiqueta-retrasada"
              >Retrasada</span>
            </p>
            <p class="mt-0.5 text-xs text-slate-500">
              {{ a.proyectoCodigo }} · {{ a.tipoCronograma === 'DISCRETO' ? 'por sesiones' : 'continua' }} · termina el {{ formatoFecha(a.fechaFin) }}
              <template v-if="a.proximaSesion">
                · próxima sesión: {{ formatoFechaCorta(a.proximaSesion) }}
              </template>
              <template v-if="a.sesionesSinMarcar">
                · <span class="font-medium text-amber-700">{{ a.sesionesSinMarcar }} {{ a.sesionesSinMarcar === 1 ? 'sesión' : 'sesiones' }} sin marcar</span>
              </template>
            </p>
            <div class="mt-2 flex items-center gap-3">
              <BarraAvance
                :pct="a.cumplimientoPct"
                :tono="a.retrasada ? 'retrasado' : 'normal'"
                :etiqueta="`Avance de ${a.codigo}`"
              />
              <span class="w-9 shrink-0 text-right text-xs tabular-nums text-slate-600">{{ Math.round(a.cumplimientoPct) }}%</span>
            </div>
          </RouterLink>
        </li>
      </ul>
    </section>

    <section
      v-if="trabajo.tareas.length"
      class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5"
    >
      <h3 class="text-sm font-semibold text-slate-700">
        Mis tareas pendientes
      </h3>
      <ul class="mt-4 divide-y divide-slate-100">
        <li
          v-for="t in trabajo.tareas"
          :key="t.id"
          class="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0"
          data-test="mi-tarea"
        >
          <RouterLink
            :to="{ name: 'marco-logico-proyecto', params: { id: t.proyectoId } }"
            class="min-w-0 text-slate-800 hover:underline"
          >
            {{ t.nombre }}
            <span class="ml-1 text-xs text-slate-400">{{ t.proyectoCodigo }} · {{ t.actividadCodigo }}</span>
          </RouterLink>
          <span
            v-if="t.fechaLimite"
            :class="['shrink-0 text-xs', t.vencida ? 'font-medium text-red-600' : 'text-slate-500']"
          >
            {{ t.vencida ? 'Venció el ' : 'Hasta el ' }}{{ formatoFecha(t.fechaLimite) }}
          </span>
        </li>
      </ul>
    </section>
  </template>
</template>