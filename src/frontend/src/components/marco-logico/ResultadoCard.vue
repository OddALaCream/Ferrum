<script setup lang="ts">
import Button from 'primevue/button';
import { computed, ref } from 'vue';
import type { TecnicoProyecto } from '@/api/equipo';
import type { Resultado } from '@/api/marcoLogico';
import { formatoNumero } from '@/utils/formato';
import ActividadItem from './ActividadItem.vue';
import BarraAvance from './BarraAvance.vue';

/** Un resultado esperado del marco lógico, con sus indicadores (I.O.V.) y sus actividades. */
const props = defineProps<{
  resultado: Resultado;
  proyectoId: string;
  equipo: TecnicoProyecto[];
  /** El Administrador puede agregar indicadores y actividades (con el proyecto abierto). */
  puedeEditar: boolean;
  /** Id del usuario con sesión y su rol: el técnico solo opera sobre las actividades de las que es responsable. */
  usuarioId: string | null;
  esAdministrador: boolean;
  esTecnico: boolean;
  proyectoCerrado: boolean;
}>();
const emit = defineEmits<{ cambio: []; 'agregar-indicador': []; 'agregar-actividad': [] }>();

const descripcionLarga = computed(() => props.resultado.descripcion.length > 220);
const expandida = ref(false);

const nombres = computed(() => new Map(props.equipo.map((t) => [t.id, t.nombre])));
const puedeOperar = (responsableId: string | null) =>
  !props.proyectoCerrado &&
  (props.esAdministrador || (props.esTecnico && responsableId !== null && responsableId === props.usuarioId));

/** Avance del resultado: promedio del avance de sus actividades. */
const avance = computed(() => {
  const a = props.resultado.actividades;
  return a.length ? a.reduce((s, x) => s + x.cumplimientoPct, 0) / a.length : 0;
});
const retrasadas = computed(() => props.resultado.actividades.filter((a) => a.estadoEfectivo === 'RETRASADA').length);
</script>

<template>
  <section
    class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5"
    :data-test="`resultado-${resultado.codigo}`"
  >
    <header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <span class="rounded-md bg-violet-700 px-2 py-0.5 text-xs font-semibold text-white">{{ resultado.codigo }}</span>
          <p
            :class="['mt-2 text-sm leading-relaxed text-slate-800', descripcionLarga && !expandida ? 'line-clamp-3' : '']"
          >
            {{ resultado.descripcion }}
          </p>
          <button
            v-if="descripcionLarga"
            type="button"
            class="mt-1 text-xs font-medium text-violet-700 hover:underline"
            @click="expandida = !expandida"
          >
            {{ expandida ? 'Ver menos' : 'Ver completo' }}
          </button>
        </div>
        <div class="w-44 shrink-0">
          <p class="mb-1 flex justify-between text-xs text-slate-500">
            <span>Avance</span><span class="font-medium tabular-nums text-slate-700">{{ Math.round(avance) }}%</span>
          </p>
          <BarraAvance
            :pct="avance"
            :etiqueta="`Avance de ${resultado.codigo}`"
          />
          <p
            v-if="retrasadas"
            class="mt-1.5 text-xs font-medium text-red-600"
            data-test="retrasadas"
          >
            <i class="pi pi-exclamation-triangle mr-1 text-[10px]" />{{ retrasadas }} {{ retrasadas === 1 ? 'actividad retrasada' : 'actividades retrasadas' }}
          </p>
        </div>
      </div>
    </header>

    <!-- Indicadores -->
    <div class="mt-5">
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-700">
          Indicadores (I.O.V.)
        </h3>
        <Button
          v-if="puedeEditar"
          label="Agregar indicador"
          icon="pi pi-plus"
          size="small"
          severity="secondary"
          text
          data-test="agregar-indicador"
          @click="emit('agregar-indicador')"
        />
      </div>
      <p
        v-if="resultado.indicadores.length === 0"
        class="rounded-lg bg-slate-50 p-3 text-sm text-slate-500"
      >
        Este resultado todavía no tiene indicadores.
      </p>
      <div
        v-else
        class="overflow-x-auto rounded-lg border border-slate-200"
      >
        <table class="w-full min-w-[40rem] text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="w-24 px-3 py-2 font-medium">
                Código
              </th>
              <th class="px-3 py-2 font-medium">
                Indicador
              </th>
              <th class="w-40 px-3 py-2 font-medium">
                Meta
              </th>
              <th class="w-64 px-3 py-2 font-medium">
                Fuentes de verificación
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="i in resultado.indicadores"
              :key="i.id"
              class="align-top"
              :data-test="`iov-${i.codigo}`"
            >
              <td class="whitespace-nowrap px-3 py-2 text-xs font-semibold text-violet-800">
                {{ i.codigo }}
              </td>
              <td class="px-3 py-2 text-slate-700">
                {{ i.descripcion }}
              </td>
              <td class="px-3 py-2 text-slate-800">
                <span class="font-semibold tabular-nums">{{ formatoNumero(i.meta) }}</span> {{ i.unidad }}
                <span
                  v-if="i.lineaBase > 0"
                  class="block text-xs text-slate-400"
                >desde {{ formatoNumero(i.lineaBase) }}</span>
              </td>
              <td class="px-3 py-2 text-xs text-slate-500">
                {{ i.fuenteVerificacion }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Actividades -->
    <div class="mt-6">
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-700">
          Actividades ({{ resultado.actividades.length }})
        </h3>
        <Button
          v-if="puedeEditar"
          label="Agregar actividad"
          icon="pi pi-plus"
          size="small"
          severity="secondary"
          text
          data-test="agregar-actividad"
          @click="emit('agregar-actividad')"
        />
      </div>
      <p
        v-if="resultado.actividades.length === 0"
        class="rounded-lg bg-slate-50 p-3 text-sm text-slate-500"
      >
        Este resultado todavía no tiene actividades.
      </p>
      <div class="space-y-3">
        <ActividadItem
          v-for="a in resultado.actividades"
          :key="a.id"
          :actividad="a"
          :proyecto-id="proyectoId"
          :puede-operar="puedeOperar(a.responsableId)"
          :nombre-responsable="a.responsableId ? nombres.get(a.responsableId) : undefined"
          @cambio="emit('cambio')"
        />
      </div>
    </div>
  </section>
</template>