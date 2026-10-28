<script setup lang="ts">
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable, { type DataTablePageEvent } from 'primevue/datatable';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { listarProyectos, type EstadoProyecto, type ProyectoResumen } from '@/api/proyectos';
import BarraAvance from '@/components/marco-logico/BarraAvance.vue';
import { useAuthStore } from '@/stores/auth';
import { mensajeDeError } from '@/utils/errores';
import { formatoFecha, formatoMonto } from '@/utils/formato';
import { ESTADOS_PROYECTO, OPCIONES_ESTADO } from './estadoProyecto';

/**
 * RF-04: proyectos de la fundación. El Administrador y el Supervisor ven todos;
 * el Técnico solo los que tiene asignados.
 */
const POR_PAGINA = 10;
const auth = useAuthStore();
const router = useRouter();
const toast = useToast();

const filtros = reactive<{ q: string; estado: EstadoProyecto | null }>({ q: '', estado: null });
const items = ref<ProyectoResumen[]>([]);
const total = ref(0);
const primero = ref(0);
const cargando = ref(false);
const cargadoUnaVez = ref(false);

const esAdministrador = computed(() => auth.role === 'administrador');
const hayFiltros = computed(() => !!filtros.q.trim() || filtros.estado !== null);

async function cargar() {
  cargando.value = true;
  try {
    const r = await listarProyectos({
      q: filtros.q.trim() || undefined,
      estado: filtros.estado ?? undefined,
      page: Math.floor(primero.value / POR_PAGINA) + 1,
      limit: POR_PAGINA,
    });
    items.value = r.items;
    total.value = r.total;
  } catch (e) {
    toast.add({ severity: 'error', summary: 'No se pudo cargar la lista', detail: mensajeDeError(e), life: 6000 });
  } finally {
    cargando.value = false;
    cargadoUnaVez.value = true;
  }
}

function cambiarPagina(e: DataTablePageEvent) {
  primero.value = e.first;
  cargar();
}

let espera: ReturnType<typeof setTimeout> | undefined;
watch(
  () => filtros.q,
  () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      primero.value = 0;
      cargar();
    }, 300);
  },
);
watch(
  () => filtros.estado,
  () => {
    primero.value = 0;
    cargar();
  },
);
onMounted(cargar);

const abrir = (id: string) => router.push({ name: 'detalle-proyecto', params: { id } });
const abrirMarco = (id: string) => router.push({ name: 'marco-logico-proyecto', params: { id } });
const avance = (p: ProyectoResumen) => Number(p.cumplimientoPct) || 0;
</script>

<template>
  <section class="rounded-xl bg-white shadow-sm ring-1 ring-slate-900/5">
    <div class="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
      <IconField class="min-w-56 flex-1">
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="filtros.q"
          placeholder="Buscar por código o nombre"
          aria-label="Buscar proyecto"
          fluid
          data-test="buscar"
        />
      </IconField>
      <Select
        v-model="filtros.estado"
        :options="OPCIONES_ESTADO"
        option-label="label"
        option-value="value"
        placeholder="Todos los estados"
        show-clear
        aria-label="Filtrar por estado"
        class="w-52"
      />
      <RouterLink
        v-if="esAdministrador"
        v-slot="{ navigate }"
        :to="{ name: 'crear-proyecto' }"
        custom
      >
        <Button
          label="Nuevo proyecto"
          icon="pi pi-plus"
          class="ml-auto"
          data-test="nuevo-proyecto"
          @click="navigate"
        />
      </RouterLink>
    </div>

    <DataTable
      :value="items"
      :loading="cargando"
      lazy
      paginator
      :rows="POR_PAGINA"
      :first="primero"
      :total-records="total"
      data-key="id"
      row-hover
      class="cursor-pointer"
      data-test="tabla-proyectos"
      @page="cambiarPagina"
      @row-click="(e) => abrir((e.data as ProyectoResumen).id)"
    >
      <template #empty>
        <div
          v-if="cargadoUnaVez"
          class="py-10 text-center"
          data-test="vacio"
        >
          <i class="pi pi-folder-open text-3xl text-slate-300" />
          <p class="mt-3 text-sm font-medium text-slate-700">
            {{ hayFiltros ? 'No hay proyectos que coincidan con la búsqueda.' : esAdministrador ? 'Todavía no hay proyectos.' : 'Todavía no te asignaron a ningún proyecto.' }}
          </p>
          <p class="mt-1 text-sm text-slate-500">
            {{ hayFiltros ? 'Prueba con otro nombre o quita el filtro de estado.' : esAdministrador ? 'Crea el primero con «Nuevo proyecto».' : 'Cuando el Administrador te asigne uno, aparecerá aquí.' }}
          </p>
        </div>
      </template>

      <Column header="Proyecto">
        <template #body="{ data }">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-400">
            {{ data.codigo }}
          </p>
          <p class="font-medium text-slate-800">
            {{ data.nombre }}
          </p>
        </template>
      </Column>
      <Column header="Estado">
        <template #body="{ data }">
          <Tag
            :value="ESTADOS_PROYECTO[data.estado as EstadoProyecto].label"
            :icon="ESTADOS_PROYECTO[data.estado as EstadoProyecto].icono"
            :class="ESTADOS_PROYECTO[data.estado as EstadoProyecto].clases"
            rounded
          />
        </template>
      </Column>
      <Column header="Periodo">
        <template #body="{ data }">
          <span class="text-sm text-slate-600">{{ formatoFecha(data.fechaInicio) }}<br>{{ formatoFecha(data.fechaFin) }}</span>
        </template>
      </Column>
      <Column header="Presupuesto">
        <template #body="{ data }">
          <span class="whitespace-nowrap text-sm tabular-nums text-slate-700">{{ formatoMonto(data.presupuestoTotal, data.moneda) }}</span>
        </template>
      </Column>
      <Column
        header="Avance"
        class="w-40"
      >
        <template #body="{ data }">
          <div class="flex items-center gap-2">
            <BarraAvance
              :pct="avance(data)"
              :etiqueta="`Avance de ${data.codigo}`"
            />
            <span class="w-9 text-right text-xs tabular-nums text-slate-600">{{ Math.round(avance(data)) }}%</span>
          </div>
        </template>
      </Column>
      <Column header="Equipo">
        <template #body="{ data }">
          <span class="text-sm text-slate-600"><i class="pi pi-users mr-1 text-xs text-slate-400" />{{ data.equipoActivo }}</span>
        </template>
      </Column>
      <Column header="">
        <template #body="{ data }">
          <Button
            v-tooltip.top="'Marco lógico'"
            icon="pi pi-sitemap"
            severity="secondary"
            text
            rounded
            :aria-label="`Abrir el marco lógico de ${data.nombre}`"
            data-test="abrir-marco"
            @click.stop="abrirMarco(data.id)"
          />
        </template>
      </Column>
    </DataTable>
  </section>
</template>