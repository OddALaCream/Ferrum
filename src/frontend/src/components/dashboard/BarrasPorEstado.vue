<script setup lang="ts">
import { computed } from 'vue';
import type { EstadoProyecto } from '@/api/proyectos';
import { ESTADOS_PROYECTO } from '@/views/Proyectos/estadoProyecto';

/** Cuántos proyectos hay en cada estado, como barras proporcionales. */
const props = defineProps<{ porEstado: Record<EstadoProyecto, number> }>();

const COLOR: Record<EstadoProyecto, string> = {
  PLANIFICACION: 'bg-sky-500',
  EN_EJECUCION: 'bg-green-500',
  PAUSADO: 'bg-amber-500',
  CERRADO: 'bg-slate-400',
};
const total = computed(() => Object.values(props.porEstado).reduce((a, b) => a + b, 0));
const filas = computed(() =>
  (Object.keys(ESTADOS_PROYECTO) as EstadoProyecto[]).map((e) => ({
    clave: e,
    ...ESTADOS_PROYECTO[e],
    cantidad: props.porEstado[e] ?? 0,
    color: COLOR[e],
  })),
);
</script>

<template>
  <ul class="space-y-3">
    <li
      v-for="e in filas"
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
          :class="['h-full rounded-full', e.color]"
          :style="{ width: total ? `${(e.cantidad / total) * 100}%` : '0%' }"
        />
      </div>
    </li>
  </ul>
</template>