<script setup lang="ts">
import Button from 'primevue/button';
import Message from 'primevue/message';
import Skeleton from 'primevue/skeleton';
import { computed, onMounted, ref } from 'vue';
import { evidenciasValidas, listarBandeja, type Avance, type Evidencia } from '@/api/avances';
import ListaEvidencias from '@/components/marco-logico/ListaEvidencias.vue';
import AccionesRevision from '@/components/revision/AccionesRevision.vue';
import { mensajeDeError } from '@/utils/errores';
import { formatoFecha, formatoNumero } from '@/utils/formato';

/**
 * SGP-96: bandeja de revisión del Administrador. Los avances enviados de todos los proyectos,
 * del más antiguo al más reciente, con sus evidencias, para aprobarlos u observarlos.
 */
const avances = ref<Avance[]>([]);
const cargando = ref(true);
const error = ref<string | null>(null);

const proyectos = computed(() => new Set(avances.value.map((a) => a.proyecto.id)).size);

async function cargar() {
  cargando.value = true;
  error.value = null;
  try {
    avances.value = await listarBandeja();
  } catch (e) {
    error.value = mensajeDeError(e, 'No se pudo cargar la bandeja de revisión.');
  } finally {
    cargando.value = false;
  }
}
onMounted(cargar);

/** Ya revisado: sale de la bandeja. */
function revisado(a: Avance) {
  avances.value = avances.value.filter((x) => x.id !== a.id);
}

/** SGP-135: el Administrador anuló una evidencia desde la bandeja. */
function evidenciaAnulada(a: Avance, ev: Evidencia) {
  avances.value = avances.value.map((x) =>
    x.id === a.id ? { ...x, evidencias: x.evidencias.map((e) => (e.id === ev.id ? ev : e)) } : x,
  );
}

/** "hace 3 días", para ver cuánto lleva esperando. */
function espera(iso: string | null): string {
  if (!iso) return '';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return `hace ${dias} días`;
}

const valorTexto = (a: Avance) =>
  a.valorReportado === null ? null : `${formatoNumero(a.valorReportado)} ${a.objetivo.unidad ?? ''}`.trim();
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p
        v-if="!cargando && !error"
        class="text-sm text-slate-600"
        data-test="resumen-bandeja"
      >
        <template v-if="avances.length">
          <span class="font-semibold text-slate-800">{{ avances.length }}</span>
          {{ avances.length === 1 ? 'avance espera' : 'avances esperan' }} tu revisión
          en {{ proyectos }} {{ proyectos === 1 ? 'proyecto' : 'proyectos' }}. Los más antiguos van primero.
        </template>
      </p>
      <Button
        label="Actualizar"
        icon="pi pi-refresh"
        severity="secondary"
        outlined
        size="small"
        class="ml-auto"
        :loading="cargando"
        data-test="actualizar"
        @click="cargar"
      />
    </div>

    <div
      v-if="cargando && avances.length === 0"
      class="space-y-3"
      aria-busy="true"
    >
      <Skeleton
        v-for="n in 3"
        :key="n"
        height="9rem"
        border-radius="0.75rem"
      />
    </div>

    <Message
      v-else-if="error"
      severity="error"
    >
      {{ error }}
    </Message>

    <section
      v-else-if="avances.length === 0"
      class="rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-900/5"
      data-test="bandeja-vacia"
    >
      <i
        class="pi pi-check-circle text-3xl text-green-500"
        aria-hidden="true"
      />
      <h2 class="mt-3 text-base font-semibold text-slate-800">
        No hay avances por revisar
      </h2>
      <p class="mt-1 text-sm text-slate-500">
        Cuando un técnico envíe un avance con su evidencia, aparecerá aquí.
      </p>
    </section>

    <ul
      v-else
      class="space-y-3"
    >
      <li
        v-for="a in avances"
        :key="a.id"
        class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5"
        data-test="avance-bandeja"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <RouterLink
              :to="{ name: 'marco-logico-proyecto', params: { id: a.proyecto.id } }"
              class="text-xs font-medium text-violet-700 hover:underline"
              data-test="proyecto"
            >
              {{ a.proyecto.codigo }} · {{ a.proyecto.nombre }}
            </RouterLink>
            <p class="mt-1 text-sm text-slate-800">
              <span class="mr-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-xs font-semibold text-violet-800">{{ a.objetivo.codigo }}</span>
              {{ a.objetivo.nombre }}
            </p>
            <p class="mt-1 text-xs text-slate-500">
              {{ a.autor.nombre }} · corte al {{ formatoFecha(a.fechaCorte) }} · enviado {{ espera(a.enviadoAt) }}
            </p>
          </div>
          <p
            v-if="valorTexto(a)"
            class="text-lg font-semibold tabular-nums text-slate-800"
            data-test="valor"
          >
            {{ valorTexto(a) }}
          </p>
        </div>

        <p
          v-if="a.descripcion"
          class="mt-3 whitespace-pre-line text-sm text-slate-700"
        >
          {{ a.descripcion }}
        </p>
        <p
          v-if="a.observacion"
          class="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          <span class="font-medium">Reenviado tras la observación:</span> {{ a.observacion }}
        </p>

        <div class="mt-3">
          <p class="mb-1.5 text-xs font-medium text-slate-600">
            Evidencias ({{ a.evidencias.filter((e) => e.vigente).length }})
          </p>
          <ListaEvidencias
            :proyecto-id="a.proyecto.id"
            :avance-id="a.id"
            :evidencias="a.evidencias"
            puede-anular
            @anulada="(ev) => evidenciaAnulada(a, ev)"
          />
          <p
            v-if="evidenciasValidas(a).length === 0"
            class="mt-2 text-xs text-amber-700"
            data-test="sin-evidencias-validas"
          >
            Todas sus evidencias están anuladas: obsérvalo para que el técnico suba una válida.
          </p>
        </div>

        <AccionesRevision
          class="mt-4 border-t border-slate-100 pt-3"
          :proyecto-id="a.proyecto.id"
          :avance-id="a.id"
          :puede-aprobar="evidenciasValidas(a).length > 0"
          @revisado="revisado"
        />
      </li>
    </ul>
  </div>
</template>