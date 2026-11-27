<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Evidencia } from '@/api/avances';
import EvidenciaFila from './EvidenciaFila.vue';

/**
 * SGP-136: evidencias de un avance agrupadas por versión. Se muestra la versión vigente de cada una y,
 * a pedido, su historial (versiones anteriores, anuladas o no), que se sigue pudiendo abrir.
 */
const props = defineProps<{
  proyectoId: string;
  avanceId: string;
  evidencias: Evidencia[];
  puedeQuitar?: boolean;
  quitandoId?: string | null;
  puedeAnular?: boolean;
  puedeVersionar?: boolean;
  versionandoId?: string | null;
}>();
const emit = defineEmits<{
  quitar: [evidenciaId: string];
  anulada: [evidencia: Evidencia];
  'nueva-version': [evidenciaId: string, archivo: File];
}>();

/** Cada versión vigente con su historial, de la más nueva a la más antigua. */
const grupos = computed(() => {
  const porId = new Map(props.evidencias.map((e) => [e.id, e]));
  return props.evidencias
    .filter((e) => e.vigente)
    .map((actual) => {
      const anteriores: Evidencia[] = [];
      let previa = actual.reemplazaA ? porId.get(actual.reemplazaA) : undefined;
      while (previa) {
        anteriores.push(previa);
        previa = previa.reemplazaA ? porId.get(previa.reemplazaA) : undefined;
      }
      return { actual, anteriores };
    });
});

const abiertos = ref(new Set<string>());
function alternar(id: string) {
  const s = new Set(abiertos.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  abiertos.value = s;
}
</script>

<template>
  <ul class="space-y-1.5">
    <template
      v-for="g in grupos"
      :key="g.actual.id"
    >
      <EvidenciaFila
        :proyecto-id="proyectoId"
        :avance-id="avanceId"
        :evidencia="g.actual"
        :puede-quitar="puedeQuitar"
        :quitando="quitandoId === g.actual.id"
        :puede-anular="puedeAnular"
        :puede-versionar="puedeVersionar"
        :versionando="versionandoId === g.actual.id"
        @quitar="emit('quitar', g.actual.id)"
        @anulada="(ev) => emit('anulada', ev)"
        @nueva-version="(archivo) => emit('nueva-version', g.actual.id, archivo)"
      />
      <li
        v-if="g.anteriores.length"
        class="ml-6"
      >
        <button
          type="button"
          class="text-xs text-slate-500 hover:text-violet-700 hover:underline"
          :aria-expanded="abiertos.has(g.actual.id)"
          data-test="ver-historial"
          @click="alternar(g.actual.id)"
        >
          <i :class="['pi mr-1 text-[10px]', abiertos.has(g.actual.id) ? 'pi-chevron-down' : 'pi-chevron-right']" />
          {{ abiertos.has(g.actual.id) ? 'Ocultar' : 'Ver' }} versiones anteriores ({{ g.anteriores.length }})
        </button>
        <ul
          v-if="abiertos.has(g.actual.id)"
          class="mt-1 space-y-1 border-l-2 border-slate-200 pl-3"
          data-test="historial"
        >
          <EvidenciaFila
            v-for="e in g.anteriores"
            :key="e.id"
            :proyecto-id="proyectoId"
            :avance-id="avanceId"
            :evidencia="e"
          />
        </ul>
      </li>
    </template>
  </ul>
</template>