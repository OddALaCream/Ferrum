<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { obtenerResumen, type ResumenCartera } from '@/api/proyectos';
import { obtenerRetrasadas, type ActividadRetrasada } from '@/api/seguimiento';
import { formatoMonto } from '@/utils/formato';
import BarrasPorEstado from './BarrasPorEstado.vue';
import TablaRetrasadas from './TablaRetrasadas.vue';
import TarjetaIndicador from './TarjetaIndicador.vue';

/** Panel del Administrador: toda la cartera de la fundación, con el presupuesto y lo que está atrasado. */
const resumen = ref<ResumenCartera | null>(null);
const retrasadas = ref<ActividadRetrasada[]>([]);
const fallo = ref(false);

onMounted(async () => {
  try {
    [resumen.value, retrasadas.value] = await Promise.all([obtenerResumen(), obtenerRetrasadas()]);
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
    No se pudieron cargar los indicadores. Recarga la página para intentarlo de nuevo.
  </p>

  <template v-else-if="resumen">
    <section
      class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
      aria-label="Indicadores de la cartera"
    >
      <TarjetaIndicador
        titulo="Proyectos"
        :valor="resumen.totalProyectos"
        data-test="kpi-total"
      />
      <TarjetaIndicador
        titulo="En ejecución"
        :valor="resumen.porEstado.EN_EJECUCION"
        tono="bueno"
        data-test="kpi-ejecucion"
      />
      <TarjetaIndicador
        titulo="Presupuesto total"
        :valor="formatoMonto(resumen.presupuestoBob, 'BOB')"
        data-test="kpi-presupuesto"
      />
      <TarjetaIndicador
        titulo="Técnicos activos"
        :valor="resumen.tecnicosActivos"
        data-test="kpi-tecnicos"
      />
      <TarjetaIndicador
        titulo="Actividades retrasadas"
        :valor="resumen.actividades.retrasadas"
        :tono="resumen.actividades.retrasadas ? 'alerta' : 'normal'"
        data-test="kpi-retrasadas"
      />
    </section>

    <section class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
      <h3 class="text-sm font-semibold text-slate-700">
        Actividades retrasadas
      </h3>
      <p
        v-if="retrasadas.length === 0"
        class="mt-3 text-sm text-slate-500"
        data-test="sin-retrasadas"
      >
        No hay actividades retrasadas.
      </p>
      <TablaRetrasadas
        v-else
        class="mt-3"
        :filas="retrasadas.slice(0, 8)"
        mostrar-responsable
      />
    </section>

    <section class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
      <h3 class="text-sm font-semibold text-slate-700">
        Proyectos por estado
      </h3>
      <p
        v-if="resumen.totalProyectos === 0"
        class="mt-3 text-sm text-slate-500"
        data-test="sin-proyectos"
      >
        Todavía no hay proyectos registrados.
      </p>
      <BarrasPorEstado
        v-else
        class="mt-4"
        :por-estado="resumen.porEstado"
      />
    </section>
  </template>
</template>