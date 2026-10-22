<script setup lang="ts">
import { isAxiosError } from 'axios';
import SelectButton from 'primevue/selectbutton';
import Skeleton from 'primevue/skeleton';
import Tag from 'primevue/tag';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, ref, watch } from 'vue';
import {
  actualizarEstado,
  getFinanciadores,
  obtenerProyecto,
  type EstadoProyecto,
  type Financiador,
  type ProblemDetails,
  type Proyecto,
} from '@/api/proyectos';
import { useAuthStore } from '@/stores/auth';
import { ESTADOS_PROYECTO, OPCIONES_ESTADO } from './estadoProyecto';

const props = defineProps<{ id: string }>();

const auth = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

const proyecto = ref<Proyecto | null>(null);
const financiadores = ref<Financiador[]>([]);
const cargando = ref(true);
const noEncontrado = ref(false);
const guardando = ref(false);
/**
 * Selección del SelectButton. Es un ref propio (no `:model-value="proyecto.estado"`) porque
 * PrimeVue guarda la selección internamente: hay que reasignarla para revertir un cambio
 * cancelado o rechazado.
 */
const estadoSeleccionado = ref<EstadoProyecto | null>(null);

const esDirector = computed(() => auth.role === 'director');
const cerrado = computed(() => proyecto.value?.estado === 'CERRADO');
const soloLectura = computed(() => cerrado.value || !esDirector.value);
const estadoActual = computed(() => (proyecto.value ? ESTADOS_PROYECTO[proyecto.value.estado] : null));
const nombreFinanciador = computed(
  () => financiadores.value.find((f) => f.id === proyecto.value?.financiadorId)?.nombre ?? '—',
);

function detalleDe(e: unknown): string | undefined {
  const detail = isAxiosError<ProblemDetails>(e) ? e.response?.data?.detail : undefined;
  return Array.isArray(detail) ? detail.join(' ') : detail;
}

/** `YYYY-MM-DD` → fecha local legible, sin pasar por UTC. */
function formatoFecha(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatoMonto(p: Proyecto): string {
  return new Intl.NumberFormat('es-BO', { style: 'currency', currency: p.moneda }).format(p.presupuestoTotal);
}

/** `silencioso` recarga sin mostrar el esqueleto (p. ej. tras un 422 para resincronizar el estado). */
async function cargar(silencioso = false) {
  if (!silencioso) cargando.value = true;
  noEncontrado.value = false;
  try {
    const [p, f] = await Promise.all([obtenerProyecto(props.id), getFinanciadores()]);
    proyecto.value = p;
    financiadores.value = f;
  } catch (e) {
    if (isAxiosError(e) && e.response?.status === 404) {
      noEncontrado.value = true;
      proyecto.value = null;
    } else {
      toast.add({ severity: 'error', summary: 'No se pudo cargar el proyecto', detail: detalleDe(e), life: 6000 });
    }
  } finally {
    cargando.value = false;
  }
}

function revertirSeleccion() {
  estadoSeleccionado.value = proyecto.value?.estado ?? null;
}

function solicitarCambio(nuevo: EstadoProyecto | null) {
  if (!proyecto.value || !nuevo || nuevo === proyecto.value.estado) return;
  if (nuevo !== 'CERRADO') {
    cambiarEstado(nuevo);
    return;
  }
  // RN-09: el cierre es irreversible, se pide confirmación explícita
  confirm.require({
    header: 'Cerrar proyecto',
    message: 'Un proyecto cerrado no puede volver a abrirse ni cambiar de estado. ¿Desea continuar?',
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Cancelar', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Cerrar proyecto', severity: 'danger' },
    accept: () => cambiarEstado(nuevo),
    reject: revertirSeleccion,
    onHide: () => {
      if (!guardando.value) revertirSeleccion();
    },
  });
}

async function cambiarEstado(nuevo: EstadoProyecto) {
  guardando.value = true;
  try {
    proyecto.value = await actualizarEstado(props.id, nuevo);
    toast.add({
      severity: 'success',
      summary: 'Estado actualizado',
      detail: `El proyecto pasó a «${ESTADOS_PROYECTO[nuevo].label}».`,
      life: 4000,
    });
  } catch (e) {
    // CP-03: transición rechazada por el backend (RN-09)
    if (isAxiosError(e) && e.response?.status === 422) {
      toast.add({
        severity: 'error',
        summary: 'Transición de proyecto no permitida',
        detail: detalleDe(e),
        life: 6000,
      });
      await cargar(true);
    } else {
      toast.add({
        severity: 'error',
        summary: 'No se pudo cambiar el estado',
        detail: detalleDe(e) ?? 'Inténtelo de nuevo en unos minutos.',
        life: 6000,
      });
    }
  } finally {
    guardando.value = false;
    revertirSeleccion();
  }
}

watch(() => proyecto.value?.estado, revertirSeleccion);
watch(() => props.id, () => cargar(), { immediate: true });
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <RouterLink
      :to="{ name: 'dashboard' }"
      class="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-800"
    >
      <i class="pi pi-arrow-left text-xs" />
      Volver al dashboard
    </RouterLink>

    <section
      v-if="cargando"
      class="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5"
      aria-busy="true"
    >
      <Skeleton
        width="8rem"
        height="0.875rem"
      />
      <Skeleton
        width="60%"
        height="2rem"
      />
      <Skeleton
        width="100%"
        height="2.75rem"
      />
    </section>

    <section
      v-else-if="noEncontrado"
      class="rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-900/5"
      data-test="no-encontrado"
    >
      <i class="pi pi-search text-3xl text-slate-300" />
      <h1 class="mt-3 text-lg font-semibold text-slate-800">
        Proyecto no encontrado
      </h1>
      <p class="mt-1 text-sm text-slate-500">
        El proyecto solicitado no existe o fue eliminado.
      </p>
    </section>

    <template v-else-if="proyecto && estadoActual">
      <section
        :class="[
          'rounded-xl p-6 shadow-sm ring-1 ring-slate-900/5 transition-colors',
          cerrado ? 'bg-slate-50' : 'bg-white',
        ]"
      >
        <p class="text-xs font-medium uppercase tracking-wider text-slate-500">
          {{ proyecto.codigo }}
        </p>
        <div class="mt-1 flex flex-wrap items-center gap-3">
          <h1 class="text-2xl font-semibold text-slate-800">
            {{ proyecto.nombre }}
          </h1>
          <Tag
            :value="estadoActual.label"
            :icon="estadoActual.icono"
            :class="estadoActual.clases"
            rounded
            data-test="tag-estado"
          />
        </div>
        <p
          v-if="proyecto.descripcion"
          class="mt-2 text-sm text-slate-500"
        >
          {{ proyecto.descripcion }}
        </p>

        <div class="mt-6 border-t border-slate-100 pt-5">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2
              id="estado-label"
              class="text-sm font-medium text-slate-700"
            >
              Estado del proyecto
            </h2>
            <span
              v-if="guardando"
              class="flex items-center gap-2 text-xs text-slate-500"
            >
              <i class="pi pi-spin pi-spinner" /> Guardando…
            </span>
          </div>

          <SelectButton
            v-model="estadoSeleccionado"
            :options="OPCIONES_ESTADO"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            :disabled="soloLectura || guardando"
            aria-labelledby="estado-label"
            :class="['flex flex-wrap', soloLectura && 'opacity-60']"
            data-test="selector-estado"
            @update:model-value="solicitarCambio"
          >
            <template #option="{ option }">
              <i :class="[option.icono, 'text-xs']" />
              <span>{{ option.label }}</span>
            </template>
          </SelectButton>

          <div
            v-if="cerrado"
            role="status"
            class="mt-4 flex gap-3 rounded-lg bg-white p-4 text-sm ring-1 ring-slate-200"
            data-test="aviso-solo-lectura"
          >
            <i class="pi pi-lock mt-0.5 text-slate-400" />
            <div>
              <p class="font-medium text-slate-700">
                Proyecto cerrado · Solo lectura
              </p>
              <p class="mt-0.5 text-slate-500">
                Un proyecto cerrado no puede cambiar de estado (RN-09).
              </p>
            </div>
          </div>
          <p
            v-else-if="!esDirector"
            class="mt-3 text-xs text-slate-500"
          >
            Solo el Director puede cambiar el estado del proyecto.
          </p>
        </div>
      </section>

      <section class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
        <h2 class="text-base font-semibold text-slate-800">
          Información general
        </h2>
        <dl class="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-3">
          <div>
            <dt class="text-xs font-medium uppercase tracking-wider text-slate-500">
              Financiador
            </dt>
            <dd class="mt-1 text-sm text-slate-800">
              {{ nombreFinanciador }}
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium uppercase tracking-wider text-slate-500">
              Periodo de ejecución
            </dt>
            <dd class="mt-1 text-sm text-slate-800">
              {{ formatoFecha(proyecto.fechaInicio) }} – {{ formatoFecha(proyecto.fechaFin) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium uppercase tracking-wider text-slate-500">
              Presupuesto total
            </dt>
            <dd class="mt-1 text-sm font-medium tabular-nums text-slate-800">
              {{ formatoMonto(proyecto) }}
            </dd>
          </div>
          <div
            v-if="proyecto.objetivoGeneral"
            class="sm:col-span-3"
          >
            <dt class="text-xs font-medium uppercase tracking-wider text-slate-500">
              Objetivo general
            </dt>
            <dd class="mt-1 text-sm text-slate-800">
              {{ proyecto.objetivoGeneral }}
            </dd>
          </div>
        </dl>
      </section>
    </template>
  </div>
</template>
