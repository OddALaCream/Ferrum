<script setup lang="ts">
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { computed, ref } from 'vue';
import {
  cambiarEstadoActividad,
  cambiarEstadoTarea,
  crearTarea,
  marcarSesion,
  type Actividad,
  type EstadoActividad,
  type Tarea,
} from '@/api/marcoLogico';
import { formatoFecha, formatoFechaCorta, formatoNumero } from '@/utils/formato';
import { mensajeDeError } from '@/utils/errores';
import BarraAvance from './BarraAvance.vue';

/**
 * Una actividad con su cronograma. El técnico responsable solo anota lo cumplido:
 * - CONTINUA: indica su estado y su avance.
 * - DISCRETA: marca cada sesión como realizada; el avance se calcula solo.
 */
const props = defineProps<{
  actividad: Actividad;
  proyectoId: string;
  /** Administrador o técnico responsable de esta actividad, con el proyecto abierto. */
  puedeOperar: boolean;
  nombreResponsable?: string;
}>();
const emit = defineEmits<{ cambio: [] }>();

const toast = useToast();
const trabajando = ref(false);
const avance = ref<number | null>(null);
const nuevaTarea = ref('');

const ESTADOS: Record<EstadoActividad, { label: string; icono: string; clases: string }> = {
  PENDIENTE: { label: 'Pendiente', icono: 'pi pi-clock', clases: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20' },
  EN_CURSO: { label: 'En curso', icono: 'pi pi-play', clases: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20' },
  COMPLETADA: { label: 'Completada', icono: 'pi pi-check', clases: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' },
  RETRASADA: { label: 'Retrasada', icono: 'pi pi-exclamation-triangle', clases: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' },
};

const estado = computed(() => ESTADOS[props.actividad.estadoEfectivo]);
const discreta = computed(() => props.actividad.tipoCronograma === 'DISCRETO');
const tono = computed<'normal' | 'completado' | 'retrasado'>(() => {
  if (props.actividad.estadoEfectivo === 'COMPLETADA') return 'completado';
  if (props.actividad.estadoEfectivo === 'RETRASADA') return 'retrasado';
  return 'normal';
});
const hoy = new Date().toISOString().slice(0, 10);
const realizadas = computed(() => props.actividad.sesiones.filter((s) => s.realizada).length);
const meta = computed(() => {
  const a = props.actividad;
  if (a.metaCuantitativa === null) return null;
  return `${formatoNumero(a.metaCuantitativa)} ${a.unidadMeta ?? ''}`.trim();
});

async function ejecutar(accion: () => Promise<unknown>, titulo: string) {
  trabajando.value = true;
  try {
    await accion();
    emit('cambio');
  } catch (e) {
    toast.add({ severity: 'error', summary: titulo, detail: mensajeDeError(e), life: 6000 });
  } finally {
    trabajando.value = false;
  }
}

const alternarSesion = (id: string, realizada: boolean) =>
  ejecutar(() => marcarSesion(props.proyectoId, props.actividad.id, id, !realizada), 'No se pudo marcar la sesión');

const cambiarEstado = (e: 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADA', pct?: number) =>
  ejecutar(() => cambiarEstadoActividad(props.proyectoId, props.actividad.id, e, pct), 'No se pudo actualizar la actividad');

const guardarAvance = () => {
  if (avance.value === null) return;
  return cambiarEstado(avance.value >= 100 ? 'COMPLETADA' : 'EN_CURSO', avance.value);
};

const alternarTarea = (t: Tarea) =>
  ejecutar(
    () => cambiarEstadoTarea(props.proyectoId, t.id, t.estado === 'COMPLETADA' ? 'PENDIENTE' : 'COMPLETADA'),
    'No se pudo actualizar la tarea',
  );

async function agregarTarea() {
  const nombre = nuevaTarea.value.trim();
  if (!nombre) return;
  await ejecutar(() => crearTarea(props.proyectoId, props.actividad.id, { nombre }), 'No se pudo crear la tarea');
  nuevaTarea.value = '';
}

const tareaVencida = (t: Tarea) => t.estado !== 'COMPLETADA' && !!t.fechaLimite && t.fechaLimite < hoy;
</script>

<template>
  <article
    class="rounded-lg border border-slate-200 bg-white p-4"
    :data-test="`actividad-${actividad.codigo}`"
  >
    <header class="flex flex-wrap items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="flex flex-wrap items-center gap-2">
          <span class="rounded bg-violet-50 px-1.5 py-0.5 text-xs font-semibold text-violet-800">{{ actividad.codigo }}</span>
          <span class="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
            <i :class="['mr-1 text-[10px]', discreta ? 'pi pi-calendar' : 'pi pi-arrows-h']" />{{ discreta ? 'Discreta · por sesiones' : 'Continua' }}
          </span>
        </p>
        <h4 class="mt-1 text-sm font-medium text-slate-800">
          {{ actividad.nombre }}
        </h4>
      </div>
      <Tag
        :value="estado.label"
        :icon="estado.icono"
        :class="estado.clases"
        rounded
        data-test="estado-actividad"
      />
    </header>

    <dl class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
      <div>
        <dt class="inline">
          Cronograma:
        </dt>
        <dd class="inline text-slate-700">
          {{ formatoFecha(actividad.fechaInicio) }} – {{ formatoFecha(actividad.fechaFin) }}
        </dd>
      </div>
      <div v-if="nombreResponsable">
        <dt class="inline">
          Responsable:
        </dt>
        <dd class="inline text-slate-700">
          {{ nombreResponsable }}
        </dd>
      </div>
      <div v-if="meta">
        <dt class="inline">
          Meta:
        </dt>
        <dd class="inline text-slate-700">
          {{ meta }}
        </dd>
      </div>
    </dl>

    <div class="mt-3 flex items-center gap-3">
      <BarraAvance
        :pct="actividad.cumplimientoPct"
        :tono="tono"
        :etiqueta="`Avance de ${actividad.codigo}`"
      />
      <span
        class="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-slate-600"
        data-test="avance-actividad"
      >{{ Math.round(actividad.cumplimientoPct) }}%</span>
    </div>

    <!-- Actividad discreta: sesiones -->
    <div
      v-if="discreta"
      class="mt-3"
    >
      <p class="mb-1.5 text-xs font-medium text-slate-600">
        Sesiones ({{ realizadas }} de {{ actividad.sesiones.length }} realizadas)
      </p>
      <p
        v-if="actividad.sesiones.length === 0"
        class="text-xs text-slate-400"
      >
        Todavía no hay fechas programadas.
      </p>
      <ul class="flex flex-wrap gap-1.5">
        <li
          v-for="s in actividad.sesiones"
          :key="s.id"
        >
          <button
            type="button"
            :disabled="!puedeOperar || trabajando"
            :class="[
              'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ring-1 ring-inset transition-colors',
              s.realizada
                ? 'bg-green-50 text-green-700 ring-green-600/20'
                : s.fecha < hoy
                  ? 'bg-amber-50 text-amber-700 ring-amber-600/30'
                  : 'bg-white text-slate-600 ring-slate-300',
              puedeOperar ? 'cursor-pointer hover:brightness-95' : 'cursor-default',
            ]"
            :aria-pressed="s.realizada"
            :title="puedeOperar ? (s.realizada ? 'Marcar como no realizada' : 'Marcar como realizada') : undefined"
            data-test="sesion"
            @click="alternarSesion(s.id, s.realizada)"
          >
            <i :class="s.realizada ? 'pi pi-check-circle' : 'pi pi-circle'" />
            {{ formatoFechaCorta(s.fecha) }}
          </button>
        </li>
      </ul>
    </div>

    <!-- Actividad continua: el técnico indica su avance -->
    <div
      v-else-if="puedeOperar && actividad.estado !== 'COMPLETADA'"
      class="mt-3 flex flex-wrap items-end gap-2"
    >
      <Button
        v-if="actividad.estado === 'PENDIENTE'"
        label="Iniciar"
        icon="pi pi-play"
        size="small"
        severity="secondary"
        outlined
        :disabled="trabajando"
        data-test="iniciar"
        @click="cambiarEstado('EN_CURSO')"
      />
      <InputNumber
        v-model="avance"
        :min="0"
        :max="100"
        suffix=" %"
        placeholder="Avance"
        size="small"
        input-class="w-24"
        :disabled="trabajando"
        :aria-label="`Avance de ${actividad.codigo}`"
        data-test="avance-input"
      />
      <Button
        label="Guardar avance"
        size="small"
        :disabled="trabajando || avance === null"
        data-test="guardar-avance"
        @click="guardarAvance"
      />
      <Button
        label="Completar"
        icon="pi pi-check"
        size="small"
        severity="success"
        outlined
        :disabled="trabajando"
        data-test="completar"
        @click="cambiarEstado('COMPLETADA')"
      />
    </div>

    <!-- Tareas -->
    <div
      v-if="actividad.tareas.length || puedeOperar"
      class="mt-4 border-t border-slate-100 pt-3"
    >
      <p class="mb-1.5 text-xs font-medium text-slate-600">
        Tareas
      </p>
      <ul class="space-y-1">
        <li
          v-for="t in actividad.tareas"
          :key="t.id"
          class="flex items-center gap-2 text-sm"
        >
          <button
            type="button"
            :disabled="!puedeOperar || trabajando"
            :class="['text-base', t.estado === 'COMPLETADA' ? 'text-green-600' : 'text-slate-400', puedeOperar ? 'hover:text-violet-700' : '']"
            :aria-label="t.estado === 'COMPLETADA' ? `Reabrir ${t.nombre}` : `Completar ${t.nombre}`"
            :aria-pressed="t.estado === 'COMPLETADA'"
            data-test="tarea-toggle"
            @click="alternarTarea(t)"
          >
            <i :class="t.estado === 'COMPLETADA' ? 'pi pi-check-square' : 'pi pi-stop'" />
          </button>
          <span :class="t.estado === 'COMPLETADA' ? 'text-slate-400 line-through' : 'text-slate-700'">{{ t.nombre }}</span>
          <span
            v-if="t.fechaLimite"
            :class="['ml-auto shrink-0 text-xs', tareaVencida(t) ? 'font-medium text-red-600' : 'text-slate-400']"
          >
            {{ tareaVencida(t) ? 'Venció el ' : 'Hasta el ' }}{{ formatoFecha(t.fechaLimite) }}
          </span>
        </li>
      </ul>
      <form
        v-if="puedeOperar"
        class="mt-2 flex gap-2"
        @submit.prevent="agregarTarea"
      >
        <InputText
          v-model="nuevaTarea"
          placeholder="Nueva tarea…"
          size="small"
          class="flex-1"
          maxlength="250"
          :aria-label="`Nueva tarea de ${actividad.codigo}`"
          data-test="nueva-tarea"
        />
        <Button
          type="submit"
          icon="pi pi-plus"
          size="small"
          severity="secondary"
          :disabled="trabajando || !nuevaTarea.trim()"
          aria-label="Agregar tarea"
          data-test="agregar-tarea"
        />
      </form>
    </div>
  </article>
</template>