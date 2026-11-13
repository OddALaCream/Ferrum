<script setup lang="ts">
/** Un indicador del panel: título, valor grande y una nota opcional. */
withDefaults(defineProps<{ titulo: string; valor: string | number; nota?: string; tono?: 'normal' | 'bueno' | 'alerta' }>(), {
  nota: undefined,
  tono: 'normal',
});
</script>

<template>
  <div
    :class="['rounded-xl p-5 shadow-sm ring-1', tono === 'alerta' ? 'bg-red-50 ring-red-200' : 'bg-white ring-slate-900/5']"
  >
    <p :class="['text-xs font-medium uppercase tracking-wide', tono === 'alerta' ? 'text-red-600' : 'text-slate-500']">
      {{ titulo }}
    </p>
    <p
      :class="[
        'mt-2 text-3xl font-semibold tabular-nums',
        tono === 'alerta' ? 'text-red-700' : tono === 'bueno' ? 'text-green-700' : 'text-slate-800',
      ]"
      data-test="valor"
    >
      {{ valor }}
    </p>
    <p
      v-if="nota"
      class="mt-1 text-xs text-slate-500"
    >
      {{ nota }}
    </p>
  </div>
</template>