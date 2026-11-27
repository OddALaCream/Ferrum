<script setup lang="ts">
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';
import Skeleton from 'primevue/skeleton';
import { ref, watch } from 'vue';
import type { EstadoAvance } from '@/api/avances';
import { obtenerHistorial, type Historial, type TipoEvento } from '@/api/historial';
import { mensajeDeError } from '@/utils/errores';
import { formatoFecha, formatoNumero } from '@/utils/formato';
import BarraAvance from './BarraAvance.vue';
import ListaEvidencias from './ListaEvidencias.vue';

/**
 * SGP-116 (CP-28): historial de un indicador o de una actividad. Cada avance en orden cronológico,
 * con su estado, quién lo revisó, sus evidencias (con versiones y anulaciones) y su línea de tiempo.
 */
const props = defineProps<{
  proyectoId: string;
  objetivo: { tipo: 'IOV' | 'ACTIVIDAD'; id: string; codigo: string } | null;
}>();
const visible = defineModel<boolean>('visible', { required: true });

const historial = ref<Historial | null>(null);
const cargando = ref(false);
const error = ref<string | null>(null);

watch(visible, async (abierto) => {
  if (!abierto || !props.objetivo) return;
  cargando.value = true;
  error.value = null;
  historial.value = null;
  try {
    const filtro = props.objetivo.tipo === 'IOV' ? { iovId: props.objetivo.id } : { actividadId: props.objetivo.id };
    historial.value = await obtenerHistorial(props.proyectoId, filtro);
  } catch (e) {
    error.value = mensajeDeError(e, 'No se pudo cargar el historial.');
  } finally {
    cargando.value = false;
  }
});

const ESTADOS: Record<EstadoAvance, { label: string; clases: string }> = {
  BORRADOR: { label: 'Borrador', clases: 'bg-slate-100 text-slate-600' },
  ENVIADO: { label: 'En revisión', clases: 'bg-sky-50 text-sky-700' },
  APROBADO: { label: 'Aprobado', clases: 'bg-green-50 text-green-700' },
  OBSERVADO: { label: 'Observado', clases: 'bg-amber-50 text-amber-700' },
  ANULADO: { label: 'Anulado', clases: 'bg-red-50 text-red-700' },
};

const EVENTOS: Record<TipoEvento, { texto: string; icono: string; color: string }> = {
  REGISTRADO: { texto: 'Registrado', icono: 'pi pi-pencil', color: 'bg-slate-400' },
  CORREGIDO: { texto: 'Corregido', icono: 'pi pi-pencil', color: 'bg-slate-400' },
  EVIDENCIA_ADJUNTADA: { texto: 'Evidencia adjuntada', icono: 'pi pi-paperclip', color: 'bg-slate-400' },
  EVIDENCIA_VERSION: { texto: 'Nueva versión de evidencia', icono: 'pi pi-history', color: 'bg-violet-500' },
  EVIDENCIA_ANULADA: { texto: 'Evidencia anulada', icono: 'pi pi-ban', color: 'bg-red-500' },
  ENVIADO: { texto: 'Enviado a revisión', icono: 'pi pi-send', color: 'bg-sky-500' },
  REENVIADO: { texto: 'Reenviado a revisión', icono: 'pi pi-send', color: 'bg-sky-500' },
  OBSERVADO: { texto: 'Observado', icono: 'pi pi-exclamation-circle', color: 'bg-amber-500' },
  APROBADO: { texto: 'Aprobado', icono: 'pi pi-check', color: 'bg-green-500' },
  ANULADO: { texto: 'Anulado', icono: 'pi pi-times', color: 'bg-red-500' },
};

/** Fecha y hora cortas en la zona del sistema: "21 nov, 10:15". */
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-BO', { timeZone: 'America/La_Paz', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const valorTexto = (valor: number | null, unidad: string | null) => (valor === null ? null : `${formatoNumero(valor)} ${unidad ?? ''}`.trim());
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="objetivo ? `Historial de ${objetivo.codigo}` : 'Historial'"
    class="w-full max-w-3xl"
    :breakpoints="{ '640px': '100vw' }"
    :pt="{ content: { class: 'pb-5' } }"
  >
    <div
      v-if="cargando"
      class="space-y-3"
      aria-busy="true"
    >
      <Skeleton height="3rem" />
      <Skeleton height="8rem" />
    </div>
    <Message
      v-else-if="error"
      severity="error"
      size="small"
    >
      {{ error }}
    </Message>

    <template v-else-if="historial">
      <header class="-mt-1 mb-4">
        <p class="text-sm text-slate-600">
          {{ historial.objetivo.nombre }}
        </p>
        <div
          v-if="historial.objetivo.tipo === 'IOV'"
          class="mt-2 max-w-xs"
          data-test="cumplimiento-historial"
        >
          <p class="mb-1 flex justify-between text-xs text-slate-500">
            <span>Cumplimiento<template v-if="historial.objetivo.meta !== null"> · meta {{ valorTexto(historial.objetivo.meta, historial.objetivo.unidad) }}</template></span>
            <span class="font-semibold tabular-nums text-slate-800">{{ Math.round(historial.objetivo.cumplimientoPct) }}%</span>
          </p>
          <BarraAvance
            :pct="historial.objetivo.cumplimientoPct"
            :tono="historial.objetivo.cumplimientoPct >= 100 ? 'completado' : 'normal'"
            :etiqueta="`Cumplimiento de ${historial.objetivo.codigo}`"
          />
        </div>
      </header>

      <p
        v-if="historial.avances.length === 0"
        class="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500"
        data-test="sin-historial"
      >
        Todavía no hay avances enviados.
      </p>

      <ol
        v-else
        class="space-y-4"
      >
        <li
          v-for="(a, n) in historial.avances"
          :key="a.id"
          class="rounded-lg border border-slate-200 p-4"
          data-test="avance-historial"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-slate-400">
                Avance {{ n + 1 }} · corte al {{ formatoFecha(a.fechaCorte) }}
              </p>
              <p
                v-if="valorTexto(a.valorReportado, a.objetivo.unidad)"
                class="text-lg font-semibold tabular-nums text-slate-800"
              >
                {{ valorTexto(a.valorReportado, a.objetivo.unidad) }}
              </p>
              <p class="text-xs text-slate-500">
                {{ a.autor.nombre }}<template v-if="a.revisadoPor">
                  · revisó {{ a.revisadoPor.nombre }}
                </template>
              </p>
            </div>
            <span
              :class="['rounded-full px-2.5 py-0.5 text-xs font-medium', ESTADOS[a.estado].clases]"
              data-test="estado-historial"
            >{{ ESTADOS[a.estado].label }}</span>
          </div>
          <p
            v-if="a.descripcion"
            class="mt-2 whitespace-pre-line text-sm text-slate-700"
          >
            {{ a.descripcion }}
          </p>

          <div
            v-if="a.evidencias.length"
            class="mt-3"
          >
            <p class="mb-1.5 text-xs font-medium text-slate-600">
              Evidencias
            </p>
            <ListaEvidencias
              :proyecto-id="proyectoId"
              :avance-id="a.id"
              :evidencias="a.evidencias"
            />
          </div>

          <!-- Línea de tiempo -->
          <ol
            class="relative mt-4 space-y-3 border-l border-slate-200 pl-5"
            data-test="linea-tiempo"
          >
            <li
              v-for="(e, i) in a.eventos"
              :key="i"
              class="relative"
              data-test="evento"
            >
              <span
                :class="['absolute -left-[1.6rem] top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[8px] text-white ring-4 ring-white', EVENTOS[e.tipo].color]"
                aria-hidden="true"
              ><i :class="EVENTOS[e.tipo].icono" /></span>
              <p class="text-sm text-slate-800">
                <span class="font-medium">{{ EVENTOS[e.tipo].texto }}</span>
                <span
                  v-if="e.usuario"
                  class="text-slate-500"
                > · {{ e.usuario.nombre }}</span>
              </p>
              <p class="text-xs text-slate-400">
                {{ fechaHora(e.fecha) }}
              </p>
              <p
                v-if="e.detalle"
                :class="[
                  'mt-0.5 text-xs',
                  e.tipo === 'OBSERVADO' ? 'rounded bg-amber-50 px-2 py-1 text-amber-800' : e.tipo === 'EVIDENCIA_ANULADA' ? 'text-red-700' : 'text-slate-600',
                ]"
                data-test="detalle-evento"
              >
                {{ e.detalle }}
              </p>
            </li>
          </ol>
        </li>
      </ol>
    </template>
  </Dialog>
</template>