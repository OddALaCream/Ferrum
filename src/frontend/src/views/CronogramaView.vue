<script setup lang="ts">
import Button from 'primevue/button';
import Message from 'primevue/message';
import Select from 'primevue/select';
import { computed, onMounted, ref, watch } from 'vue';
import { obtenerEquipo, type TecnicoProyecto } from '@/api/equipo';
import { obtenerMarcoLogico, type ArbolMarcoLogico } from '@/api/marcoLogico';
import { listarProyectos, type ProyectoResumen } from '@/api/proyectos';
import ActividadItem from '@/components/marco-logico/ActividadItem.vue';
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
const dia = (f: string) => Date.parse(`${f}T00:00:00Z`) / 86400000;
function barra(inicio: string, fin: string) {
  const p = arbol.value!.proyecto;
  const total = Math.max(1, dia(p.fechaFin) - dia(p.fechaInicio) + 1);
  return {
    marginLeft: `${Math.max(0, (dia(inicio) - dia(p.fechaInicio)) / total * 100)}%`,
    width: `${Math.max(0.5, (dia(fin) - dia(inicio) + 1) / total * 100)}%`,
  };
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
            <p class="text-xs text-slate-500">
              {{ formatoFecha(a.fechaInicio) }} – {{ formatoFecha(a.fechaFin) }}
            </p>
            <div
              class="mt-1 h-2 overflow-hidden rounded bg-slate-100"
              aria-hidden="true"
            >
              <div
                class="h-full rounded"
                :class="a.estadoEfectivo === 'RETRASADA' ? 'bg-red-400' : a.estado === 'COMPLETADA' ? 'bg-green-500' : 'bg-violet-500'"
                :style="barra(a.fechaInicio, a.fechaFin)"
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
        @cambio="cargar"
      />
    </template>
  </div>
</template>
