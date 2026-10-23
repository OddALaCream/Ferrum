<script setup lang="ts">
import { isAxiosError } from 'axios';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable, { type DataTablePageEvent } from 'primevue/datatable';
import DatePicker from 'primevue/datepicker';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  consultarBitacora,
  obtenerOpcionesBitacora,
  type OpcionesBitacora,
  type RegistroAuditoria,
} from '@/api/auditoria';
import type { ProblemDetails } from '@/api/proyectos';
import {
  aFechaIso,
  camposCambiados,
  etiquetaAccion,
  etiquetaEntidad,
  formatoFechaHora,
  formatoValor,
  quienRealizo,
} from './bitacora';

/** RF-34 / SGP-59: consulta de la bitácora inalterable, filtrada por usuario, entidad, proyecto y fechas. */
const toast = useToast();

const LIMITE_INICIAL = 20;

const filtros = reactive<{
  usuarioId: string | null;
  entidad: string | null;
  proyectoId: string | null;
  rango: (Date | null)[] | null;
}>({ usuarioId: null, entidad: null, proyectoId: null, rango: null });

const opciones = ref<OpcionesBitacora>({ usuarios: [], entidades: [], proyectos: [] });
const registros = ref<RegistroAuditoria[]>([]);
const total = ref(0);
const pagina = ref(1);
const limite = ref(LIMITE_INICIAL);
const cargando = ref(false);
const expandidos = ref<Record<string, boolean>>({});

const opcionesUsuario = computed(() =>
  opciones.value.usuarios.map((u) => ({ value: u.id, label: `${u.nombre} · ${u.email}` })),
);
const opcionesEntidad = computed(() =>
  opciones.value.entidades.map((e) => ({ value: e, label: etiquetaEntidad(e) })),
);
const opcionesProyecto = computed(() =>
  opciones.value.proyectos.map((p) => ({ value: p.id, label: `${p.codigo} · ${p.nombre}` })),
);

const hayFiltros = computed(
  () => !!(filtros.usuarioId || filtros.entidad || filtros.proyectoId || filtros.rango?.[0]),
);

function detalleDe(e: unknown): string | undefined {
  const detail = isAxiosError<ProblemDetails>(e) ? e.response?.data?.detail : undefined;
  return Array.isArray(detail) ? detail.join(' ') : detail;
}

async function cargar() {
  cargando.value = true;
  const [inicio, fin] = filtros.rango ?? [];
  try {
    const resultado = await consultarBitacora({
      usuarioId: filtros.usuarioId ?? undefined,
      entidad: filtros.entidad ?? undefined,
      proyectoId: filtros.proyectoId ?? undefined,
      desde: inicio ? aFechaIso(inicio) : undefined,
      hasta: inicio ? aFechaIso(fin ?? inicio) : undefined,
      pagina: pagina.value,
      limite: limite.value,
    });
    registros.value = resultado.items;
    total.value = resultado.total;
    expandidos.value = {};
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'No se pudo cargar la bitácora',
      detail: detalleDe(e) ?? 'Inténtelo de nuevo en unos minutos.',
      life: 6000,
    });
  } finally {
    cargando.value = false;
  }
}

async function cargarOpciones() {
  try {
    opciones.value = await obtenerOpcionesBitacora();
  } catch {
    // Sin opciones los filtros quedan vacíos, pero la bitácora se puede consultar igual
  }
}

function cambiarPagina(evento: DataTablePageEvent) {
  pagina.value = evento.page + 1;
  limite.value = evento.rows;
  cargar();
}

function limpiarFiltros() {
  Object.assign(filtros, { usuarioId: null, entidad: null, proyectoId: null, rango: null });
}

// Cualquier cambio de filtro vuelve a la primera página. Un rango a medio elegir espera la segunda fecha.
watch(
  () => [filtros.usuarioId, filtros.entidad, filtros.proyectoId, filtros.rango?.[0], filtros.rango?.[1]],
  () => {
    if (filtros.rango?.[0] && !filtros.rango[1]) return;
    pagina.value = 1;
    cargar();
  },
);

onMounted(() => {
  cargarOpciones();
  cargar();
});
</script>

<template>
  <div class="space-y-6">
    <section
      class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5"
      data-test="filtros-bitacora"
    >
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label
            id="filtro-usuario-label"
            for="filtro-usuario"
            class="mb-1.5 block text-sm font-medium text-slate-700"
          >Usuario</label>
          <Select
            v-model="filtros.usuarioId"
            input-id="filtro-usuario"
            aria-labelledby="filtro-usuario-label"
            :options="opcionesUsuario"
            option-label="label"
            option-value="value"
            placeholder="Todos"
            filter
            show-clear
            fluid
            data-test="filtro-usuario"
          />
        </div>
        <div>
          <label
            id="filtro-entidad-label"
            for="filtro-entidad"
            class="mb-1.5 block text-sm font-medium text-slate-700"
          >Entidad</label>
          <Select
            v-model="filtros.entidad"
            input-id="filtro-entidad"
            aria-labelledby="filtro-entidad-label"
            :options="opcionesEntidad"
            option-label="label"
            option-value="value"
            placeholder="Todas"
            show-clear
            fluid
            data-test="filtro-entidad"
          />
        </div>
        <div>
          <label
            id="filtro-proyecto-label"
            for="filtro-proyecto"
            class="mb-1.5 block text-sm font-medium text-slate-700"
          >Proyecto</label>
          <Select
            v-model="filtros.proyectoId"
            input-id="filtro-proyecto"
            aria-labelledby="filtro-proyecto-label"
            :options="opcionesProyecto"
            option-label="label"
            option-value="value"
            placeholder="Todos"
            filter
            show-clear
            fluid
            data-test="filtro-proyecto"
          />
        </div>
        <div>
          <label
            for="filtro-fechas"
            class="mb-1.5 block text-sm font-medium text-slate-700"
          >Rango de fechas</label>
          <DatePicker
            v-model="filtros.rango"
            input-id="filtro-fechas"
            selection-mode="range"
            date-format="dd/mm/yy"
            placeholder="dd/mm/aaaa – dd/mm/aaaa"
            :manual-input="false"
            show-button-bar
            show-icon
            fluid
            data-test="filtro-fechas"
          />
        </div>
      </div>
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p class="flex items-center gap-2 text-xs text-slate-500">
          <i class="pi pi-lock" />
          Los registros de la bitácora no se pueden editar ni eliminar.
        </p>
        <Button
          label="Limpiar filtros"
          icon="pi pi-filter-slash"
          size="small"
          severity="secondary"
          text
          :disabled="!hayFiltros"
          data-test="btn-limpiar"
          @click="limpiarFiltros"
        />
      </div>
    </section>

    <section class="rounded-xl bg-white p-2 shadow-sm ring-1 ring-slate-900/5 sm:p-4">
      <DataTable
        v-model:expanded-rows="expandidos"
        :value="registros"
        :loading="cargando"
        :total-records="total"
        :rows="limite"
        :first="(pagina - 1) * limite"
        :rows-per-page-options="[20, 50, 100]"
        data-key="id"
        size="small"
        lazy
        paginator
        striped-rows
        data-test="tabla-bitacora"
        @page="cambiarPagina"
      >
        <template #empty>
          <p class="py-6 text-center text-sm text-slate-500">
            No hay registros que coincidan con los filtros.
          </p>
        </template>
        <Column
          expander
          style="width: 3rem"
        />
        <Column header="Fecha y hora">
          <template #body="{ data }">
            <span class="whitespace-nowrap tabular-nums">{{ formatoFechaHora(data.fecha) }}</span>
          </template>
        </Column>
        <Column header="Usuario">
          <template #body="{ data }">
            <span :class="data.usuarioId || data.usuarioEmail ? 'text-slate-800' : 'italic text-slate-400'">
              {{ quienRealizo(data) }}
            </span>
          </template>
        </Column>
        <Column header="Acción">
          <template #body="{ data }">
            <Tag
              :value="etiquetaAccion(data.accion).label"
              :icon="etiquetaAccion(data.accion).icono"
              :class="etiquetaAccion(data.accion).clases"
              rounded
            />
          </template>
        </Column>
        <Column header="Entidad">
          <template #body="{ data }">
            {{ etiquetaEntidad(data.entidad) }}
          </template>
        </Column>
        <Column header="Proyecto">
          <template #body="{ data }">
            {{ data.proyectoCodigo ?? '—' }}
          </template>
        </Column>
        <Column header="IP">
          <template #body="{ data }">
            <span class="font-mono text-xs text-slate-600">{{ data.ip ?? '—' }}</span>
          </template>
        </Column>

        <template #expansion="{ data }">
          <div
            class="space-y-3 px-2 py-3"
            data-test="detalle-registro"
          >
            <table class="w-full text-left text-sm">
              <thead class="text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th class="py-1.5 pr-4 font-medium">
                    Campo
                  </th>
                  <th class="py-1.5 pr-4 font-medium">
                    Valor anterior
                  </th>
                  <th class="py-1.5 font-medium">
                    Valor nuevo
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="c in camposCambiados(data.valorAnterior, data.valorNuevo)"
                  :key="c.campo"
                  class="border-t border-slate-100"
                  :data-test="`campo-${c.campo}`"
                >
                  <td class="py-1.5 pr-4 font-mono text-xs text-slate-600">
                    {{ c.campo }}
                  </td>
                  <td
                    class="py-1.5 pr-4 break-all"
                    :class="c.cambio && data.valorAnterior ? 'text-red-700' : 'text-slate-500'"
                  >
                    {{ formatoValor(c.anterior) }}
                  </td>
                  <td
                    class="py-1.5 break-all"
                    :class="c.cambio && data.valorNuevo ? 'font-medium text-emerald-700' : 'text-slate-500'"
                  >
                    {{ formatoValor(c.nuevo) }}
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="text-xs text-slate-500">
              Registro n.º {{ data.id }} · ID de la entidad: <span class="font-mono">{{ data.entidadId ?? '—' }}</span>
              <template v-if="data.userAgent">
                · Navegador: {{ data.userAgent }}
              </template>
            </p>
          </div>
        </template>
      </DataTable>
    </section>
  </div>
</template>
