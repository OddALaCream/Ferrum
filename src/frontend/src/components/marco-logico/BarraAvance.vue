<script setup lang="ts">
import { computed } from 'vue';

/** Barra de avance de 0 a 100. El color indica el estado: verde completado, rojo retrasado, violeta el resto. */
const props = withDefaults(defineProps<{ pct: number; tono?: 'normal' | 'completado' | 'retrasado'; etiqueta?: string }>(), {
  tono: 'normal',
  etiqueta: 'Avance',
});

const ancho = computed(() => Math.max(0, Math.min(100, Number(props.pct) || 0)));
const color = computed(() => ({ normal: 'bg-violet-600', completado: 'bg-green-500', retrasado: 'bg-red-500' })[props.tono]);
const texto = computed(() => `${props.etiqueta}: ${Math.round(ancho.value)}%`);
</script>

<template>
  <div
    class="h-2 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner"
    role="progressbar"
    :title="texto"
    :aria-label="etiqueta"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="Math.round(ancho)"
  >
    <div
      :class="['h-full rounded-full transition-all duration-500 ease-out motion-reduce:transition-none', color]"
      :style="{ width: `${ancho}%`, minWidth: ancho > 0 ? '0.5rem' : undefined }"
    />
  </div>
</template>