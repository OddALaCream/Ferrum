<script setup lang="ts">
import { isAxiosError } from 'axios';
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import SelectButton from 'primevue/selectbutton';
import Skeleton from 'primevue/skeleton';
import Tag from 'primevue/tag';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, ref, watch } from 'vue';
import {
  asignarTecnico,
  buscarTecnicosDisponibles,
  obtenerEquipo,
  retirarTecnico,
  type TecnicoProyecto,
} from '@/api/equipo';
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
import PresupuestoProyecto from './PresupuestoProyecto.vue';

const props = defineProps<{ id: string }>();

const auth = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

const proyecto = ref<Proyecto | null>(null);
const financiadores = ref<Financiador[]>([]);
const equipo = ref<TecnicoProyecto[]>([]);
const cargando = ref(true);
const cargandoEquipo = ref(false);
const noEncontrado = ref(false);
const guardando = ref(false);
const asignando = ref(false);
const tecnicoSeleccionado = ref<TecnicoProyecto | { id: string; nombre: string; email: string } | null>(null);
const sugerencias = ref<{ id: string; nombre: string; email: string }[]>([]);
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

async function cargarEquipo() {
  cargandoEquipo.value = true;
  try {
    equipo.value = await obtenerEquipo(props.id);
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'No se pudo cargar el equipo',
      detail: detalleDe(e),
      life: 6000,
    });
  } finally {
    cargandoEquipo.value = false;
  }
}

/** `silencioso` recarga sin mostrar el esqueleto (p. ej. tras un 422 para resincronizar el estado). */
async function cargar(silencioso = false) {
  if (!silencioso) cargando.value = true;
  noEncontrado.value = false;
  try {
    const [p, f] = await Promise.all([obtenerProyecto(props.id), getFinanciadores()]);
    proyecto.value = p;
    financiadores.value = f;
    await cargarEquipo();
  } catch (e) {
    if (isAxiosError(e) && e.response?.status === 404) {
      noEncontrado.value = true;
      proyecto.value = null;
      equipo.value = [];
    } else {
      toast.add({ severity: 'error', summary: 'No se pudo cargar el proyecto', detail: detalleDe(e), life: 6000 });
    }
  } finally {
    cargando.value = false;
  }
}

async function filtrarTecnicos(event: AutoCompleteCompleteEvent) {
  try {
    sugerencias.value = await buscarTecnicosDisponibles(props.id, event.query);
  } catch {
    sugerencias.value = [];
  }
}

async function asignarSeleccionado() {
  const tecnico = tecnicoSeleccionado.value;
  if (!tecnico || typeof tecnico === 'string' || !('id' in tecnico)) {
    toast.add({
      severity: 'warn',
      summary: 'Seleccione un técnico',
      detail: 'Busque y elija un técnico de la lista antes de asignar.',
      life: 4000,
    });
    return;
  }

  asignando.value = true;
  try {
    await asignarTecnico(props.id, tecnico.id);
    toast.add({
      severity: 'success',
      summary: 'Técnico asignado',
      detail: `${tecnico.nombre} se unió al equipo del proyecto.`,
      life: 4000,
    });
    tecnicoSeleccionado.value = null;
    sugerencias.value = [];
    await cargarEquipo();
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'No se pudo asignar',
      detail: detalleDe(e) ?? 'Inténtelo de nuevo.',
      life: 6000,
    });
  } finally {
    asignando.value = false;
  }
}

function solicitarRetiro(tecnico: TecnicoProyecto) {
  confirm.require({
    header: 'Retirar del equipo',
    message: `¿Retirar a ${tecnico.nombre} del equipo del proyecto?`,
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Cancelar', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Retirar', severity: 'danger' },
    accept: () => confirmarRetiro(tecnico),
  });
}

async function confirmarRetiro(tecnico: TecnicoProyecto) {
  try {
    await retirarTecnico(props.id, tecnico.id);
    toast.add({
      severity: 'success',
      summary: 'Técnico retirado',
      detail: `${tecnico.nombre} ya no forma parte del equipo.`,
      life: 4000,
    });
    await cargarEquipo();
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'No se pudo retirar',
      detail: detalleDe(e) ?? 'Inténtelo de nuevo.',
      life: 6000,
    });
  }
}

function formatoFechaAsignacion(iso: string): string {
  return new Date(iso).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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
        <dl class="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">
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
          <div
            v-if="proyecto.objetivoGeneral"
            class="sm:col-span-2"
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

      <PresupuestoProyecto
        :proyecto="proyecto"
        :editable="!soloLectura"
        @actualizado="proyecto = $event"
      />

      <section
        class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5"
        data-test="seccion-equipo"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-slate-800">
              Equipo Técnico
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              Técnicos asignados al seguimiento del proyecto.
            </p>
          </div>
        </div>

        <div
          v-if="!soloLectura"
          class="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
          data-test="asignar-equipo"
        >
          <div class="min-w-0 flex-1">
            <label
              for="buscar-tecnico"
              class="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Buscar técnico
            </label>
            <AutoComplete
              v-model="tecnicoSeleccionado"
              input-id="buscar-tecnico"
              :suggestions="sugerencias"
              option-label="nombre"
              placeholder="Escriba el nombre del técnico…"
              dropdown
              force-selection
              fluid
              :disabled="asignando"
              data-test="autocomplete-tecnico"
              @complete="filtrarTecnicos"
            >
              <template #option="{ option }">
                <div class="flex flex-col leading-tight">
                  <span class="text-sm font-medium text-slate-800">{{ option.nombre }}</span>
                  <span class="text-xs text-slate-500">{{ option.email }}</span>
                </div>
              </template>
            </AutoComplete>
          </div>
          <Button
            label="Asignar"
            icon="pi pi-user-plus"
            :loading="asignando"
            :disabled="!tecnicoSeleccionado"
            data-test="btn-asignar"
            @click="asignarSeleccionado"
          />
        </div>

        <DataTable
          :value="equipo"
          :loading="cargandoEquipo"
          data-key="id"
          class="mt-5"
          size="small"
          striped-rows
          data-test="tabla-equipo"
        >
          <template #empty>
            <p class="py-4 text-center text-sm text-slate-500">
              Aún no hay técnicos asignados a este proyecto.
            </p>
          </template>
          <Column
            field="nombre"
            header="Nombre"
          />
          <Column
            field="email"
            header="Email"
          />
          <Column header="Fecha de Asignación">
            <template #body="{ data }">
              {{ formatoFechaAsignacion(data.fechaAsignacion) }}
            </template>
          </Column>
          <Column
            v-if="!soloLectura"
            header="Acciones"
            style="width: 6rem"
          >
            <template #body="{ data }">
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                :aria-label="`Retirar a ${data.nombre}`"
                data-test="btn-retirar"
                @click="solicitarRetiro(data)"
              />
            </template>
          </Column>
        </DataTable>
      </section>
    </template>
  </div>
</template>
