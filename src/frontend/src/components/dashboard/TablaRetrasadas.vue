<script setup lang="ts">
import type { ActividadRetrasada } from '@/api/seguimiento';
import { formatoFecha } from '@/utils/formato';

/** Actividades vencidas y sin completar, las más atrasadas primero. Cada fila lleva al marco lógico del proyecto. */
defineProps<{ filas: ActividadRetrasada[]; mostrarResponsable?: boolean }>();

const atraso = (dias: number) => `${dias} ${dias === 1 ? 'día' : 'días'}`;
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-slate-200">
    <table class="w-full min-w-[36rem] text-left text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-3 py-2 font-medium">
            Actividad
          </th>
          <th class="px-3 py-2 font-medium">
            Proyecto
          </th>
          <th
            v-if="mostrarResponsable"
            class="px-3 py-2 font-medium"
          >
            Responsable
          </th>
          <th class="px-3 py-2 font-medium">
            Debía terminar
          </th>
          <th class="px-3 py-2 text-right font-medium">
            Atraso
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr
          v-for="f in filas"
          :key="f.id"
          data-test="fila-retrasada"
        >
          <td class="px-3 py-2">
            <RouterLink
              :to="{ name: 'marco-logico-proyecto', params: { id: f.proyectoId } }"
              class="group block"
            >
              <span class="text-xs font-semibold text-violet-800">{{ f.codigo }}</span>
              <span class="block text-slate-800 group-hover:underline">{{ f.nombre }}</span>
            </RouterLink>
          </td>
          <td class="px-3 py-2 text-slate-600">
            <span class="text-xs font-medium text-slate-400">{{ f.proyectoCodigo }}</span>
            <span class="block">{{ f.proyectoNombre }}</span>
          </td>
          <td
            v-if="mostrarResponsable"
            class="px-3 py-2 text-slate-600"
          >
            {{ f.responsable ?? 'Sin asignar' }}
          </td>
          <td class="whitespace-nowrap px-3 py-2 text-slate-600">
            {{ formatoFecha(f.fechaFin) }}
          </td>
          <td class="whitespace-nowrap px-3 py-2 text-right font-medium text-red-600">
            {{ atraso(f.diasAtraso) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>