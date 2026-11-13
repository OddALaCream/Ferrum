<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { listarProyectos, obtenerResumen, type ProyectoResumen, type ResumenCartera } from '@/api/proyectos';
import { obtenerRetrasadas, type ActividadRetrasada } from '@/api/seguimiento';
import { ESTADOS_PROYECTO } from '@/views/Proyectos/estadoProyecto';
import BarraAvance from '@/components/marco-logico/BarraAvance.vue';
import BarrasPorEstado from './BarrasPorEstado.vue';
import TablaRetrasadas from './TablaRetrasadas.vue';
import TarjetaIndicador from './TarjetaIndicador.vue';

/** Panel del Supervisor: solo los proyectos que supervisa, con su avance y lo que se está atrasando. */
const resumen = ref<ResumenCartera | null>(null);
const retrasadas = ref<ActividadRetrasada[]>([]);
const proyectos = ref<ProyectoResumen[]>([]);
const fallo = ref(false);

onMounted(async () => {
  try {
    const [r, rt, lista] = await Promise.all([obtenerResumen(), obtenerRetrasadas(), listarProyectos({ limit: 6 })]);
    resumen.value = r;
    retrasadas.value = rt;
    proyectos.value = lista.items;
  } catch {
    fallo.value = true;
  }
});

const avance = (p: ProyectoResumen) => Number(p.cumplimientoPct) || 0;
</script>

<template>
  <p
    v-if="fallo"
    class="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-900/5"
    data-test="fallo-indicadores"
  >
    No se pudieron cargar los indicadores. Recarga la página para intentarlo de nuevo.
  </p>

  <section
    v-else-if="resumen && resumen.totalProyectos === 0"
    class="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-900/5"
    data-test="sin-proyectos"
  >
    <i class="pi pi-briefcase text-3xl text-slate-300" />
    <h3 class="mt-3 text-base font-semibold text-slate-800">
      Todavía no supervisas ningún proyecto
    </h3>
    <p class="mt-1 text-sm text-slate-500">
      Cuando el Administrador te asigne uno, aparecerá aquí con su avance.
    </p>
  </section>

  <template v-else-if="resumen">
    <section
      class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
      aria-label="Indicadores de mis proyectos"
    >
      <TarjetaIndicador
        titulo="Mis proyectos"
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
        titulo="Avance promedio"
        :valor="`${Math.round(Number(resumen.avancePromedio))} %`"
        nota="de sus actividades"
        data-test="kpi-avance"
      />
      <TarjetaIndicador
        titulo="Actividades retrasadas"
        :valor="resumen.actividades.retrasadas"
        :tono="resumen.actividades.retrasadas ? 'alerta' : 'normal'"
        data-test="kpi-retrasadas"
      />
      <TarjetaIndicador
        titulo="Técnicos a cargo"
        :valor="resumen.tecnicosActivos"
        data-test="kpi-tecnicos"
      />
    </section>

    <section class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
      <h3 class="text-sm font-semibold text-slate-700">
        Lo que se está atrasando
      </h3>
      <p
        v-if="retrasadas.length === 0"
        class="mt-3 text-sm text-slate-500"
        data-test="sin-retrasadas"
      >
        Ninguna actividad de tus proyectos está retrasada.
      </p>
      <TablaRetrasadas
        v-else
        class="mt-3"
        :filas="retrasadas.slice(0, 8)"
        mostrar-responsable
      />
    </section>

    <div class="grid gap-6 lg:grid-cols-2">
      <section class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
        <h3 class="text-sm font-semibold text-slate-700">
          Avance de mis proyectos
        </h3>
        <ul class="mt-4 space-y-4">
          <li
            v-for="p in proyectos"
            :key="p.id"
            data-test="proyecto-supervisado"
          >
            <RouterLink
              :to="{ name: 'detalle-proyecto', params: { id: p.id } }"
              class="group block"
            >
              <p class="flex items-baseline justify-between gap-3 text-sm">
                <span class="min-w-0 truncate text-slate-800 group-hover:underline">
                  <span class="mr-1.5 text-xs font-medium text-slate-400">{{ p.codigo }}</span>{{ p.nombre }}
                </span>
                <span class="shrink-0 tabular-nums text-slate-600">{{ Math.round(avance(p)) }}%</span>
              </p>
              <BarraAvance
                class="mt-1.5"
                :pct="avance(p)"
                :etiqueta="`Avance de ${p.codigo}`"
              />
              <p class="mt-1 text-xs text-slate-400">
                {{ ESTADOS_PROYECTO[p.estado].label }} · {{ p.equipoActivo }} {{ p.equipoActivo === 1 ? 'técnico' : 'técnicos' }}
              </p>
            </RouterLink>
          </li>
        </ul>
      </section>

      <section class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
        <h3 class="text-sm font-semibold text-slate-700">
          Proyectos por estado
        </h3>
        <BarrasPorEstado
          class="mt-4"
          :por-estado="resumen.porEstado"
        />
      </section>
    </div>
  </template>
</template>