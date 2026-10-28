<script setup lang="ts">
import { computed } from 'vue';

/** Barra de avance de 0 a 100. El color indica el estado: verde completado, rojo retrasado, violeta el resto. */
const props = withDefaults(defineProps<{ pct: number; tono?: 'normal' | 'completado' | 'retrasado'; etiqueta?: string }>(), {
  tono: 'normal',
  etiqueta: 'Avance',
});

const ancho = computed(() => Math.max(0, Math.min(100, Number(props.pct) || 0)));
const color = computed(() => ({ normal: 'bg-violet-600', completado: 'bg-green-500', retrasado: 'bg-red-500' })[props.tono]);
</script>

<template>
  <div
    class="h-2 w-full overflow-hidden rounded-full bg-slate-100"
    role="progressbar"
    :aria-label="etiqueta"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="Math.round(ancho)"
  >
    <div
      :class="['h-full rounded-full transition-all duration-500', color]"
      :style="{ width: `${ancho}%` }"
    />
  </div>
</template>