<script setup lang="ts">
import Button from 'primevue/button';
import Message from 'primevue/message';
import Select from 'primevue/select';
import { computed, onMounted, ref, watch } from 'vue';
import { obtenerEquipo, type TecnicoProyecto } from '@/api/equipo';
import { obtenerMarcoLogico, type ArbolMarcoLogico } from '@/api/marcoLogico';
import { listarProyectos, type ProyectoResumen } from '@/api/proyectos';
import ActividadItem from '@/components/marco-logico/ActividadItem.vue';
import AvancesDialog, { type ObjetivoAvance } from '@/components/marco-logico/AvancesDialog.vue';
import HistorialDialog from '@/components/marco-logico/HistorialDialog.vue';
import { useAuthStore } from '@/stores/auth';
import { mensajeDeError } from '@/utils/errores';
import { formatoFecha } from '@/utils/formato';

const auth = useAuthStore();
const proyectos = ref<ProyectoResumen[]>([]);
const proyectoId = ref<string | null>(null);
const arbol = ref<ArbolMarcoLogico | null>(null);
const equipo = ref<TecnicoProyecto[]>([]);
const cargando = ref(false);
const cargandoProyectos = ref(false);
const error = ref('');
let solicitud = 0;
const actividades = computed(() => (arbol.value?.resultados ?? [])
  .flatMap((r) => r.actividades.map((a) => ({ ...a, resultadoCodigo: r.codigo })))
  .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio) || a.codigo.localeCompare(b.codigo, 'es', { numeric: true })));
const nombres = computed(() => new Map(equipo.value.map((t) => [t.id, t.nombre])));
const abierto = computed(() => arbol.value?.proyecto.estado !== 'CERRADO');
const puedeOperar = (responsableId: string | null) => abierto.value &&
  (auth.role === 'administrador' || (auth.role === 'tecnico' && responsableId === auth.usuario?.id));
/**
 * La franja de cada actividad es su PERÍODO dentro del proyecto (dónde cae en el calendario), no su avance:
 * el avance es el relleno oscuro dentro de la franja, con su % al lado. La línea vertical marca hoy.
 */
const dia = (f: string) => Date.parse(`${f.slice(0, 10)}T00:00:00Z`) / 86400000;
const total = () => {
  const p = arbol.value!.proyecto;
  return Math.max(1, dia(p.fechaFin) - dia(p.fechaInicio) + 1);
};
/** Posición (0–100 %) de una fecha en la línea del proyecto. */
const posicion = (f: string) => Math.min(100, Math.max(0, (dia(f) - dia(arbol.value!.proyecto.fechaInicio)) / total() * 100));
function barra(inicio: string, fin: string) {
  return {
    left: `${posicion(inicio)}%`,
    width: `${Math.max(0.8, (dia(fin) - dia(inicio) + 1) / total() * 100)}%`,
  };
}
/** Hoy en Bolivia (AAAA-MM-DD). */
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(new Date());
const hoyEnProyecto = computed(() => {
  const p = arbol.value?.proyecto;
  return p && hoy >= p.fechaInicio && hoy <= p.fechaFin ? posicion(hoy) : null;
});
/** Inicio de cada mes dentro del proyecto, para las marcas de la línea de tiempo. */
const meses = computed(() => {
  const p = arbol.value?.proyecto;
  if (!p) return [];
  const [a0, m0] = p.fechaInicio.split('-').map(Number);
  const marcas: Array<{ fecha: string; etiqueta: string; left: number }> = [];
  for (let a = a0, m = m0 + 1; ; m++) {
    if (m > 12) { m = 1; a++; }
    const fecha = `${a}-${String(m).padStart(2, '0')}-01`;
    if (fecha > p.fechaFin) break;
    const etiqueta = new Intl.DateTimeFormat('es-BO', { month: 'short' }).format(new Date(a, m - 1, 1)).replace('.', '').toLowerCase();
    marcas.push({ fecha, etiqueta: m === 1 ? `${etiqueta} ${a}` : etiqueta, left: posicion(fecha) });
  }
  return marcas;
});
const tono = (a: { estadoEfectivo: string; estado: string }) =>
  a.estadoEfectivo === 'RETRASADA'
    ? { franja: 'bg-red-100 ring-red-300', relleno: 'bg-red-500', texto: 'text-red-700' }
    : a.estado === 'COMPLETADA'
      ? { franja: 'bg-green-100 ring-green-300', relleno: 'bg-green-500', texto: 'text-green-700' }
      : { franja: 'bg-violet-100 ring-violet-300', relleno: 'bg-violet-500', texto: 'text-slate-700' };

/** Los botones «Avances» e «Historial» de cada actividad abren sus diálogos también aquí. */
const dialogoAvances = ref(false);
const objetivoAvances = ref<ObjetivoAvance | null>(null);
const puedeRegistrarAvances = ref(false);
const dialogoHistorial = ref(false);
const objetivoHistorial = ref<{ tipo: 'IOV' | 'ACTIVIDAD'; id: string; codigo: string } | null>(null);
const puedeRegistrar = (responsableId: string | null) =>
  abierto.value && auth.role === 'tecnico' && !!responsableId && responsableId === auth.usuario?.id;
function abrirAvances(a: { id: string; codigo: string; nombre: string; responsableId: string | null }) {
  objetivoAvances.value = { tipo: 'ACTIVIDAD', id: a.id, codigo: a.codigo, nombre: a.nombre };
  puedeRegistrarAvances.value = puedeRegistrar(a.responsableId);
  dialogoAvances.value = true;
}
function abrirHistorial(a: { id: string; codigo: string }) {
  objetivoHistorial.value = { tipo: 'ACTIVIDAD', id: a.id, codigo: a.codigo };
  dialogoHistorial.value = true;
}
async function cargarProyectos() {
  cargandoProyectos.value = true;
  error.value = '';
  try {
    const items: ProyectoResumen[] = [];
    let page = 1;
    let total = 0;
    do {
      const respuesta = await listarProyectos({ page, limit: 50 });
      items.push(...respuesta.items);
      total = respuesta.total;
      if (!respuesta.items.length) break;
      page++;
    } while (items.length < total);
    proyectos.value = items;
    proyectoId.value = items[0]?.id ?? null;
  } catch (e) {
    error.value = mensajeDeError(e, 'No se pudieron cargar los proyectos.');
  } finally {
    cargandoProyectos.value = false;
  }
}
async function cargar() {
  const actual = ++solicitud;
  const id = proyectoId.value;
  arbol.value = null;
  equipo.value = [];
  error.value = '';
  if (!id) { cargando.value = false; return; }
  cargando.value = true;
  try {
    const [a, e] = await Promise.all([obtenerMarcoLogico(id), obtenerEquipo(id)]);
    if (actual !== solicitud) return;
    arbol.value = a;
    equipo.value = e;
  } catch (e) {
    if (actual === solicitud) error.value = mensajeDeError(e, 'No se pudo cargar el cronograma.');
  } finally {
    if (actual === solicitud) cargando.value = false;
  }
}
watch(proyectoId, cargar);
onMounted(cargarProyectos);
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-5">
    <section class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
      <label
        for="cronograma-proyecto"
        class="mb-2 block text-sm font-medium text-slate-700"
      >Proyecto</label>
      <Select
        v-model="proyectoId"
        input-id="cronograma-proyecto"
        aria-label="Proyecto"
        :options="proyectos"
        option-label="nombre"
        option-value="id"
        filter
        placeholder="Selecciona un proyecto"
        class="w-full"
        :disabled="cargandoProyectos"
      />
      <p
        v-if="cargandoProyectos || cargando"
        class="mt-3 text-sm text-slate-500"
        role="status"
      >
        Cargando cronograma…
      </p>
      <p
        v-else-if="!proyectos.length && !error"
        class="mt-3 text-sm text-slate-500"
      >
        No tienes proyectos disponibles.
      </p>
      <Message
        v-if="error"
        severity="error"
        class="mt-3"
      >
        {{ error }}
      </Message>
      <Button
        v-if="error"
        label="Reintentar"
        class="mt-3"
        size="small"
        @click="proyectoId ? cargar() : cargarProyectos()"
      />
    </section>
    <template v-if="arbol && !cargando">
      <section class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="font-semibold text-slate-800">
            {{ arbol.proyecto.codigo }} · {{ arbol.proyecto.nombre }}
          </h2>
          <RouterLink
            :to="{ name: 'marco-logico-proyecto', params: { id: proyectoId } }"
            class="text-sm font-medium text-violet-700 hover:underline"
          >
            {{ auth.role === 'administrador' && abierto ? 'Planificar actividades' : 'Ver marco lógico' }}
          </RouterLink>
        </div>
        <p
          v-if="!abierto"
          class="mt-2 text-sm text-slate-500"
        >
          Proyecto cerrado: solo lectura.
        </p>
        <div class="mt-4 flex justify-between text-xs text-slate-500">
          <span>{{ formatoFecha(arbol.proyecto.fechaInicio) }}</span>
          <span>{{ formatoFecha(arbol.proyecto.fechaFin) }}</span>
        </div>
        <!-- Meses del proyecto y la marca de hoy -->
        <div
          v-if="actividades.length"
          class="relative mt-1 h-9 border-b border-slate-200 text-[11px] text-slate-400"
          aria-hidden="true"
          data-test="eje-meses"
        >
          <span
            v-for="m in meses"
            :key="m.fecha"
            class="absolute bottom-0.5 -translate-x-1/2"
            :style="{ left: `${m.left}%` }"
          >{{ m.etiqueta }}</span>
          <span
            v-if="hoyEnProyecto !== null"
            class="absolute top-0 -translate-x-1/2 rounded bg-slate-700 px-1 text-[10px] font-medium text-white"
            :style="{ left: `${hoyEnProyecto}%` }"
          >Hoy</span>
        </div>
        <p
          v-if="actividades.length"
          class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500"
          data-test="leyenda"
        >
          <span class="inline-flex items-center gap-1.5"><span class="inline-block h-2.5 w-6 rounded-sm bg-violet-100 ring-1 ring-inset ring-violet-300" />Período de la actividad</span>
          <span class="inline-flex items-center gap-1.5"><span class="inline-block h-2.5 w-6 rounded-sm bg-violet-500" />Avance logrado</span>
          <span class="inline-flex items-center gap-1.5"><span class="inline-block h-3 w-px bg-slate-700" />Hoy</span>
          <span class="inline-flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />Retrasada</span>
          <span class="inline-flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-sm bg-green-500" />Completada</span>
        </p>
        <p
          v-if="!actividades.length"
          class="mt-4 text-sm text-slate-500"
        >
          Todavía no hay actividades programadas.
        </p>
        <ol
          class="mt-3 space-y-3"
          aria-label="Cronograma de actividades"
        >
          <li
            v-for="a in actividades"
            :key="a.id"
            data-test="cronograma-actividad"
          >
            <p class="text-sm text-slate-700">
              {{ a.resultadoCodigo }} · {{ a.codigo }} · {{ a.nombre }}
            </p>
            <p class="flex flex-wrap gap-x-3 text-xs text-slate-500">
              <span>{{ formatoFecha(a.fechaInicio) }} – {{ formatoFecha(a.fechaFin) }}</span>
              <span
                :class="['font-medium', tono(a).texto]"
                data-test="avance-cronograma"
              >{{ Math.round(a.cumplimientoPct) }} % de avance{{ a.estadoEfectivo === 'RETRASADA' ? ' · retrasada' : a.estado === 'COMPLETADA' ? ' · completada' : '' }}</span>
            </p>
            <div
              class="relative mt-1 h-3 rounded bg-slate-50"
              aria-hidden="true"
            >
              <span
                v-for="m in meses"
                :key="m.fecha"
                class="absolute inset-y-0 w-px bg-slate-200"
                :style="{ left: `${m.left}%` }"
              />
              <div
                :class="['absolute inset-y-0 overflow-hidden rounded ring-1 ring-inset', tono(a).franja]"
                :style="barra(a.fechaInicio, a.fechaFin)"
                :title="`${formatoFecha(a.fechaInicio)} – ${formatoFecha(a.fechaFin)} · ${Math.round(a.cumplimientoPct)} % de avance`"
                data-test="franja"
              >
                <div
                  :class="['h-full', tono(a).relleno]"
                  :style="{ width: `${Math.min(100, Math.max(0, a.cumplimientoPct))}%` }"
                  data-test="relleno"
                />
              </div>
              <span
                v-if="hoyEnProyecto !== null"
                class="absolute -inset-y-1 w-px bg-slate-700"
                :style="{ left: `${hoyEnProyecto}%` }"
              />
            </div>
          </li>
        </ol>
      </section>
      <ActividadItem
        v-for="a in actividades"
        :key="a.id"
        :actividad="a"
        :proyecto-id="arbol.proyecto.id"
        :equipo="equipo"
        :nombre-responsable="a.responsableId ? nombres.get(a.responsableId) : undefined"
        :puede-operar="puedeOperar(a.responsableId)"
        :usuario-id="auth.usuario?.id"
        :puede-actualizar-asignadas="abierto && auth.role === 'tecnico'"
        :puede-registrar-avance="puedeRegistrar(a.responsableId)"
        @cambio="cargar"
        @avances="abrirAvances(a)"
        @historial="abrirHistorial(a)"
      />
      <AvancesDialog
        v-if="objetivoAvances"
        v-model:visible="dialogoAvances"
        :proyecto-id="arbol.proyecto.id"
        :objetivo="objetivoAvances"
        :puede-registrar="puedeRegistrarAvances"
        :puede-revisar="auth.role === 'administrador' && abierto"
        :inicio-proyecto="arbol.proyecto.fechaInicio"
        @revisado="cargar"
      />
      <HistorialDialog
        v-model:visible="dialogoHistorial"
        :proyecto-id="arbol.proyecto.id"
        :objetivo="objetivoHistorial"
      />
    </template>
  </div>
</template>