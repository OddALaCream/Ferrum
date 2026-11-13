<script setup lang="ts">
import { isAxiosError } from 'axios';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Skeleton from 'primevue/skeleton';
import Tag from 'primevue/tag';
import { computed, ref, watch } from 'vue';
import { obtenerEquipo, type TecnicoProyecto } from '@/api/equipo';
import { obtenerMarcoLogico, type ArbolMarcoLogico, type Resultado } from '@/api/marcoLogico';
import { obtenerObjetivos, type ObjetivoEspecifico } from '@/api/objetivos';
import type { EstadoProyecto } from '@/api/proyectos';
import ActividadDialog from '@/components/marco-logico/ActividadDialog.vue';
import BarraAvance from '@/components/marco-logico/BarraAvance.vue';
import IndicadorDialog from '@/components/marco-logico/IndicadorDialog.vue';
import ObjetivoEspecificoDialog from '@/components/marco-logico/ObjetivoEspecificoDialog.vue';
import ResultadoCard from '@/components/marco-logico/ResultadoCard.vue';
import ResultadoDialog from '@/components/marco-logico/ResultadoDialog.vue';
import { useAuthStore } from '@/stores/auth';
import { mensajeDeError } from '@/utils/errores';
import { formatoFecha } from '@/utils/formato';
import { ESTADOS_PROYECTO } from './estadoProyecto';

/**
 * Marco lógico de un proyecto: objetivos específicos → resultados → indicadores y actividades.
 * El Administrador planifica; el técnico responsable anota lo cumplido; el Supervisor consulta.
 */
const props = defineProps<{ id: string }>();
const auth = useAuthStore();

const arbol = ref<ArbolMarcoLogico | null>(null);
const objetivos = ref<ObjetivoEspecifico[]>([]);
const equipo = ref<TecnicoProyecto[]>([]);
const cargando = ref(true);
const error = ref<{ estado: number | null; mensaje: string } | null>(null);

const dialogoObjetivo = ref(false);
const dialogoResultado = ref(false);
const dialogoIndicador = ref(false);
const dialogoActividad = ref(false);
const seleccionado = ref<Resultado | null>(null);

const esAdministrador = computed(() => auth.role === 'administrador');
/** El Técnico solo recibe las actividades que tiene a su cargo. */
const soloMias = computed(() => arbol.value?.alcance === 'MIS_ACTIVIDADES');
const cerrado = computed(() => arbol.value?.proyecto.estado === 'CERRADO');
const puedeEditar = computed(() => esAdministrador.value && !cerrado.value);
const estado = computed(() => (arbol.value ? ESTADOS_PROYECTO[arbol.value.proyecto.estado as EstadoProyecto] : null));

const totales = computed(() => {
  const rs = arbol.value?.resultados ?? [];
  const actividades = rs.flatMap((r) => r.actividades);
  const avance = actividades.length ? actividades.reduce((s, a) => s + a.cumplimientoPct, 0) / actividades.length : 0;
  return {
    objetivos: objetivos.value.length,
    resultados: rs.length,
    indicadores: rs.reduce((s, r) => s + r.indicadores.length, 0),
    actividades: actividades.length,
    retrasadas: actividades.filter((a) => a.estadoEfectivo === 'RETRASADA').length,
    completadas: actividades.filter((a) => a.estadoEfectivo === 'COMPLETADA').length,
    avance,
  };
});

async function cargarObjetivos() {
  objetivos.value = await obtenerObjetivos(props.id);
}

async function cargar(conEsqueleto = true) {
  if (conEsqueleto) cargando.value = true;
  error.value = null;
  try {
    const [a, e, o] = await Promise.all([
      obtenerMarcoLogico(props.id),
      obtenerEquipo(props.id).catch(() => []),
      obtenerObjetivos(props.id).catch(() => [] as ObjetivoEspecifico[]),
    ]);
    arbol.value = a;
    equipo.value = e;
    objetivos.value = o;
  } catch (e) {
    const estado = isAxiosError(e) ? (e.response?.status ?? null) : null;
    error.value = {
      estado,
      mensaje:
        estado === 403
          ? 'No estás asignado a este proyecto.'
          : estado === 404
            ? 'El proyecto no existe.'
            : mensajeDeError(e, 'No se pudo cargar el marco lógico.'),
    };
  } finally {
    cargando.value = false;
  }
}

const recargar = () => cargar(false);

const numeroDe = (codigo: string) => codigo.replace(/^R\./i, '');
const siguienteObjetivo = computed(() => `OE.${objetivos.value.length + 1}`);
const siguienteResultado = computed(() => `R.${(arbol.value?.resultados.length ?? 0) + 1}`);
const siguienteIndicador = computed(() => {
  const r = seleccionado.value;
  return r ? `I.O.V. ${numeroDe(r.codigo)}.${r.indicadores.length + 1}` : '';
});
const siguienteActividad = computed(() => {
  const r = seleccionado.value;
  return r ? `A.${numeroDe(r.codigo)}.${r.actividades.length + 1}` : '';
});

function abrirIndicador(r: Resultado) {
  seleccionado.value = r;
  dialogoIndicador.value = true;
}
function abrirActividad(r: Resultado) {
  seleccionado.value = r;
  dialogoActividad.value = true;
}

watch(() => props.id, () => cargar(), { immediate: true });
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <RouterLink
      :to="{ name: 'detalle-proyecto', params: { id } }"
      class="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-800"
    >
      <i class="pi pi-arrow-left text-xs" />
      Volver al proyecto
    </RouterLink>

    <section
      v-if="cargando"
      class="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5"
      aria-busy="true"
    >
      <Skeleton
        width="10rem"
        height="0.875rem"
      />
      <Skeleton
        width="60%"
        height="2rem"
      />
      <Skeleton
        width="100%"
        height="6rem"
      />
    </section>

    <section
      v-else-if="error"
      class="rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-900/5"
      data-test="error"
    >
      <i :class="['text-3xl text-slate-300', error.estado === 403 ? 'pi pi-lock' : 'pi pi-exclamation-circle']" />
      <h1 class="mt-3 text-lg font-semibold text-slate-800">
        {{ error.mensaje }}
      </h1>
      <Button
        v-if="error.estado !== 403 && error.estado !== 404"
        label="Reintentar"
        icon="pi pi-refresh"
        size="small"
        class="mt-4"
        @click="cargar()"
      />
    </section>

    <template v-else-if="arbol && estado">
      <section :class="['rounded-xl p-6 shadow-sm ring-1 ring-slate-900/5', cerrado ? 'bg-slate-50' : 'bg-white']">
        <p class="text-xs font-medium uppercase tracking-wider text-slate-500">
          Marco lógico · {{ arbol.proyecto.codigo }}
        </p>
        <div class="mt-1 flex flex-wrap items-center gap-3">
          <h1
            class="text-2xl font-semibold text-slate-800"
            data-test="titulo"
          >
            {{ arbol.proyecto.nombre }}
          </h1>
          <Tag
            :value="estado.label"
            :icon="estado.icono"
            :class="estado.clases"
            rounded
          />
        </div>
        <p class="mt-1 text-sm text-slate-500">
          {{ formatoFecha(arbol.proyecto.fechaInicio) }} – {{ formatoFecha(arbol.proyecto.fechaFin) }}
        </p>

        <dl class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div class="rounded-lg bg-slate-50 p-3">
            <dt class="text-xs text-slate-500">
              Objetivos
            </dt>
            <dd
              class="text-xl font-semibold text-slate-800"
              data-test="total-objetivos"
            >
              {{ totales.objetivos }}
            </dd>
          </div>
          <div class="rounded-lg bg-slate-50 p-3">
            <dt class="text-xs text-slate-500">
              Resultados
            </dt>
            <dd
              class="text-xl font-semibold text-slate-800"
              data-test="total-resultados"
            >
              {{ totales.resultados }}
            </dd>
          </div>
          <div class="rounded-lg bg-slate-50 p-3">
            <dt class="text-xs text-slate-500">
              Indicadores
            </dt>
            <dd class="text-xl font-semibold text-slate-800">
              {{ totales.indicadores }}
            </dd>
          </div>
          <div class="rounded-lg bg-slate-50 p-3">
            <dt class="text-xs text-slate-500">
              Actividades
            </dt>
            <dd class="text-xl font-semibold text-slate-800">
              {{ totales.actividades }}
            </dd>
          </div>
          <div :class="['rounded-lg p-3', totales.retrasadas ? 'bg-red-50' : 'bg-slate-50']">
            <dt :class="['text-xs', totales.retrasadas ? 'text-red-600' : 'text-slate-500']">
              Retrasadas
            </dt>
            <dd
              :class="['text-xl font-semibold', totales.retrasadas ? 'text-red-700' : 'text-slate-800']"
              data-test="total-retrasadas"
            >
              {{ totales.retrasadas }}
            </dd>
          </div>
          <div class="col-span-2 rounded-lg bg-slate-50 p-3 sm:col-span-1 lg:col-span-1">
            <dt class="text-xs text-slate-500">
              {{ soloMias ? 'Mi avance' : 'Avance general' }}
            </dt>
            <dd class="mt-1">
              <span class="text-xl font-semibold text-slate-800">{{ Math.round(totales.avance) }}%</span>
              <BarraAvance
                class="mt-1"
                :pct="totales.avance"
                etiqueta="Avance general del proyecto"
              />
            </dd>
          </div>
        </dl>

        <p
          v-if="soloMias"
          class="mt-4 flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-800"
          data-test="solo-mias"
        >
          <i class="pi pi-user text-xs" /> Ves solo las actividades que tienes a tu cargo en este proyecto.
        </p>
        <p
          v-if="cerrado"
          class="mt-4 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600"
        >
          <i class="pi pi-lock text-xs" /> El proyecto está cerrado: el marco lógico queda en solo lectura.
        </p>
      </section>

      <section
        class="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5"
        data-test="seccion-objetivos"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-slate-800">
              Objetivos específicos
            </h2>
            <p class="text-sm text-slate-500">
              Metas intermedias del proyecto (OE.1, OE.2…).
            </p>
          </div>
          <Button
            v-if="puedeEditar"
            label="Nuevo Objetivo Específico"
            icon="pi pi-plus"
            size="small"
            data-test="nuevo-objetivo"
            @click="dialogoObjetivo = true"
          />
        </div>
        <DataTable
          :value="objetivos"
          data-key="id"
          striped-rows
          responsive-layout="scroll"
          data-test="tabla-objetivos"
        >
          <Column
            field="codigo"
            header="Código"
            style="width: 8rem"
          />
          <Column
            field="descripcion"
            header="Descripción"
          />
          <template #empty>
            <p class="py-4 text-center text-sm text-slate-500">
              {{ puedeEditar ? 'Todavía no hay objetivos. Crea el primero.' : 'Aún no se registraron objetivos específicos.' }}
            </p>
          </template>
        </DataTable>
      </section>

      <div
        v-if="puedeEditar"
        class="flex justify-end"
      >
        <Button
          label="Nuevo resultado"
          icon="pi pi-plus"
          size="small"
          data-test="nuevo-resultado"
          @click="dialogoResultado = true"
        />
      </div>

      <section
        v-if="arbol.resultados.length === 0"
        class="rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-900/5"
        data-test="vacio"
      >
        <i class="pi pi-sitemap text-3xl text-slate-300" />
        <h2 class="mt-3 text-base font-semibold text-slate-800">
          Este proyecto todavía no tiene marco lógico
        </h2>
        <p class="mt-1 text-sm text-slate-500">
          {{ puedeEditar ? 'Empieza creando el primer resultado esperado.' : 'El Administrador aún no cargó los resultados.' }}
        </p>
      </section>

      <ResultadoCard
        v-for="r in arbol.resultados"
        :key="r.id"
        :resultado="r"
        :proyecto-id="id"
        :equipo="equipo"
        :puede-editar="puedeEditar"
        :usuario-id="auth.usuario?.id ?? null"
        :es-administrador="esAdministrador"
        :es-tecnico="auth.role === 'tecnico'"
        :proyecto-cerrado="cerrado"
        @cambio="recargar"
        @agregar-indicador="abrirIndicador(r)"
        @agregar-actividad="abrirActividad(r)"
      />

      <ObjetivoEspecificoDialog
        v-model:visible="dialogoObjetivo"
        :proyecto-id="id"
        :sugerencia="siguienteObjetivo"
        @guardado="cargarObjetivos"
      />
      <ResultadoDialog
        v-model:visible="dialogoResultado"
        :proyecto-id="id"
        :sugerencia="siguienteResultado"
        @guardado="recargar"
      />
      <IndicadorDialog
        v-model:visible="dialogoIndicador"
        :proyecto-id="id"
        :resultado-id="seleccionado?.id ?? null"
        :resultado-codigo="seleccionado?.codigo ?? ''"
        :sugerencia="siguienteIndicador"
        :equipo="equipo"
        @guardado="recargar"
      />
      <ActividadDialog
        v-model:visible="dialogoActividad"
        :proyecto-id="id"
        :resultado-id="seleccionado?.id ?? null"
        :resultado-codigo="seleccionado?.codigo ?? ''"
        :sugerencia="siguienteActividad"
        :equipo="equipo"
        :periodo="{ inicio: arbol.proyecto.fechaInicio, fin: arbol.proyecto.fechaFin }"
        @guardado="recargar"
      />
    </template>
  </div>
</template>