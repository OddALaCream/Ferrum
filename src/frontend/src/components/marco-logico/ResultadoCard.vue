<script setup lang="ts">
import Button from 'primevue/button';
import { computed, ref } from 'vue';
import type { TecnicoProyecto } from '@/api/equipo';
import type { Resultado } from '@/api/marcoLogico';
import { formatoNumero } from '@/utils/formato';
import ActividadItem from './ActividadItem.vue';
import AvancesDialog, { type ObjetivoAvance } from './AvancesDialog.vue';
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
  /** Inicio del proyecto: límite inferior de la fecha de corte de un avance. */
  inicioProyecto: string;
}>();
const emit = defineEmits<{ cambio: []; 'agregar-indicador': []; 'agregar-actividad': [] }>();

const descripcionLarga = computed(() => props.resultado.descripcion.length > 220);
const expandida = ref(false);

const nombres = computed(() => new Map(props.equipo.map((t) => [t.id, t.nombre])));
const puedeOperar = (responsableId: string | null) =>
  !props.proyectoCerrado &&
  (props.esAdministrador || (props.esTecnico && responsableId !== null && responsableId === props.usuarioId));

/** SGP-95: cumplimiento del resultado, según los avances aprobados de sus indicadores. */
const cumplimiento = computed(() => Number(props.resultado.cumplimientoPct) || 0);
const tono = (pct: number) => (pct >= 100 ? 'completado' : 'normal');
/** Avance de las actividades del resultado: promedio de su avance. */
const avance = computed(() => {
  const a = props.resultado.actividades;
  return a.length ? a.reduce((s, x) => s + x.cumplimientoPct, 0) / a.length : 0;
});
/** SGP-82 (RN-10): solo el técnico responsable registra avances, y nunca en un proyecto cerrado. */
const puedeRegistrar = (responsableId: string | null | undefined) =>
  !props.proyectoCerrado && props.esTecnico && !!responsableId && responsableId === props.usuarioId;

const dialogoAvances = ref(false);
const objetivoAvances = ref<ObjetivoAvance | null>(null);
const registraAvances = ref(false);
function abrirAvances(objetivo: ObjetivoAvance, responsableId: string | null | undefined) {
  objetivoAvances.value = objetivo;
  registraAvances.value = puedeRegistrar(responsableId);
  dialogoAvances.value = true;
}

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
        <div class="w-48 shrink-0 space-y-2">
          <div data-test="cumplimiento-resultado">
            <p class="mb-1 flex justify-between text-xs text-slate-500">
              <span>Cumplimiento</span><span class="font-semibold tabular-nums text-slate-800">{{ Math.round(cumplimiento) }}%</span>
            </p>
            <BarraAvance
              :pct="cumplimiento"
              :tono="tono(cumplimiento)"
              :etiqueta="`Cumplimiento de ${resultado.codigo}`"
            />
          </div>
          <div>
            <p class="mb-1 flex justify-between text-xs text-slate-500">
              <span>Actividades</span><span class="font-medium tabular-nums text-slate-700">{{ Math.round(avance) }}%</span>
            </p>
            <BarraAvance
              :pct="avance"
              :etiqueta="`Avance de las actividades de ${resultado.codigo}`"
            />
          </div>
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
        <table class="w-full min-w-[52rem] text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="w-24 px-3 py-2 font-medium">
                Código
              </th>
              <th class="px-3 py-2 font-medium">
                Indicador / responsable
              </th>
              <th class="w-32 px-3 py-2 font-medium">
                Meta
              </th>
              <th class="w-40 px-3 py-2 font-medium">
                Cumplimiento
              </th>
              <th class="w-44 px-3 py-2 font-medium">
                Fuentes de verificación
              </th>
              <th class="w-32 px-3 py-2 font-medium">
                <span class="sr-only">Avances</span>
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
                <span class="mt-1 block text-xs text-slate-500">Responsable: {{ i.responsableId ? nombres.get(i.responsableId) ?? 'Técnico fuera del equipo activo' : 'Sin asignar' }}</span>
              </td>
              <td class="px-3 py-2 text-slate-800">
                <span class="font-semibold tabular-nums">{{ formatoNumero(i.meta) }}</span> {{ i.unidad }}
                <span
                  v-if="i.lineaBase > 0"
                  class="block text-xs text-slate-400"
                >desde {{ formatoNumero(i.lineaBase) }}</span>
              </td>
              <td
                class="px-3 py-2"
                data-test="cumplimiento-iov"
              >
                <p class="mb-1 flex justify-between gap-2 text-xs">
                  <span class="tabular-nums text-slate-500">{{ formatoNumero(i.valorActual) }} de {{ formatoNumero(i.meta) }}</span>
                  <span class="font-semibold tabular-nums text-slate-800">{{ Math.round(i.cumplimientoPct) }}%</span>
                </p>
                <BarraAvance
                  :pct="i.cumplimientoPct"
                  :tono="tono(i.cumplimientoPct)"
                  :etiqueta="`Cumplimiento de ${i.codigo}`"
                />
              </td>
              <td class="px-3 py-2 text-xs text-slate-500">
                {{ i.fuenteVerificacion }}
              </td>
              <td class="px-3 py-2 text-right">
                <Button
                  :label="puedeRegistrar(i.responsableId) ? 'Registrar avance' : 'Avances'"
                  :icon="puedeRegistrar(i.responsableId) ? 'pi pi-upload' : 'pi pi-folder-open'"
                  size="small"
                  :severity="puedeRegistrar(i.responsableId) ? undefined : 'secondary'"
                  :outlined="!puedeRegistrar(i.responsableId)"
                  class="whitespace-nowrap"
                  data-test="ver-avances-iov"
                  @click="abrirAvances({ tipo: 'IOV', id: i.id, codigo: i.codigo, nombre: i.descripcion, unidad: i.unidad }, i.responsableId)"
                />
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
      <div
        v-if="resultado.actividades.length === 0"
        class="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500"
        data-test="sin-actividades"
      >
        <i
          class="pi pi-inbox text-base text-slate-400"
          aria-hidden="true"
        />
        <p>
          {{ esTecnico ? 'No tienes actividades ni tareas asignadas en este resultado.' : 'Este resultado todavía no tiene actividades.' }}
        </p>
      </div>
      <div class="space-y-3">
        <ActividadItem
          v-for="a in resultado.actividades"
          :key="a.id"
          :actividad="a"
          :proyecto-id="proyectoId"
          :equipo="equipo"
          :usuario-id="usuarioId"
          :puede-actualizar-asignadas="esTecnico && !proyectoCerrado"
          :puede-operar="puedeOperar(a.responsableId)"
          :nombre-responsable="a.responsableId ? nombres.get(a.responsableId) : undefined"
          :puede-registrar-avance="puedeRegistrar(a.responsableId)"
          @cambio="emit('cambio')"
          @avances="abrirAvances({ tipo: 'ACTIVIDAD', id: a.id, codigo: a.codigo, nombre: a.nombre }, a.responsableId)"
        />
      </div>
    </div>

    <AvancesDialog
      v-model:visible="dialogoAvances"
      :proyecto-id="proyectoId"
      :objetivo="objetivoAvances"
      :puede-registrar="registraAvances"
      :inicio-proyecto="inicioProyecto"
      :puede-revisar="esAdministrador && !proyectoCerrado"
      @revisado="emit('cambio')"
    />
  </section>
</template>