<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, reactive, ref, watch } from 'vue';
import {
  crearAvance,
  eliminarAvance,
  eliminarEvidencia,
  enviarAvance,
  EXTENSIONES_ADMITIDAS,
  formatoTamano,
  listarAvances,
  motivoArchivoInvalido,
  subirEvidencia,
  urlEvidencia,
  type Avance,
  type EstadoAvance,
} from '@/api/avances';
import AccionesRevision from '@/components/revision/AccionesRevision.vue';
import { mensajeDeError } from '@/utils/errores';
import { formatoFecha, formatoNumero } from '@/utils/formato';
import { abrirEnPestanaNueva } from '@/utils/pestana';

/**
 * SGP-82: avances de un indicador o de una actividad.
 * El técnico responsable registra el avance (queda en borrador), adjunta sus evidencias y lo envía a revisión.
 * El Administrador y el Supervisor ven los avances ya enviados, con sus evidencias.
 * SGP-96: el Administrador también los aprueba u observa desde aquí.
 */
export interface ObjetivoAvance {
  tipo: 'IOV' | 'ACTIVIDAD';
  id: string;
  codigo: string;
  nombre: string;
  /** Unidad del indicador (beneficiarios, %…). Las actividades no la necesitan. */
  unidad?: string | null;
}

const props = defineProps<{
  proyectoId: string;
  objetivo: ObjetivoAvance | null;
  /** Técnico responsable, con el proyecto abierto: puede registrar y enviar. */
  puedeRegistrar: boolean;
  /** Inicio del proyecto: la fecha de corte no puede ser anterior. */
  inicioProyecto: string;
  /** Administrador, con el proyecto abierto: aprueba u observa los avances enviados. */
  puedeRevisar?: boolean;
}>();
const visible = defineModel<boolean>('visible', { required: true });
const emit = defineEmits<{ revisado: [avance: Avance] }>();

const toast = useToast();
const confirm = useConfirm();

const avances = ref<Avance[]>([]);
const cargando = ref(false);
const errorCarga = ref<string | null>(null);
const trabajando = ref<string | null>(null);
const subiendo = ref<string | null>(null);

const hoy = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();
const esIndicador = computed(() => props.objetivo?.tipo === 'IOV');

const form = reactive({ valor: null as number | null, fechaCorte: hoy, descripcion: '' });
const enviado = ref(false);
const errorServidor = ref<string | null>(null);
const guardando = ref(false);

const ESTADOS: Record<EstadoAvance, { label: string; clases: string; icono: string }> = {
  BORRADOR: { label: 'Borrador', icono: 'pi pi-pencil', clases: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20' },
  ENVIADO: { label: 'En revisión', icono: 'pi pi-send', clases: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20' },
  APROBADO: { label: 'Aprobado', icono: 'pi pi-check', clases: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' },
  OBSERVADO: { label: 'Observado', icono: 'pi pi-exclamation-circle', clases: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/30' },
  ANULADO: { label: 'Anulado', icono: 'pi pi-ban', clases: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' },
};

const errores = computed(() => {
  const e: Partial<Record<'valor' | 'fecha', string>> = {};
  if (esIndicador.value && form.valor === null) e.valor = 'Indica cuánto se alcanzó en este periodo.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.fechaCorte)) e.fecha = 'Indica hasta qué día se mide el avance.';
  else if (form.fechaCorte > hoy) e.fecha = 'La fecha de corte no puede ser posterior a hoy.';
  else if (form.fechaCorte < props.inicioProyecto) e.fecha = `No puede ser anterior al inicio del proyecto (${formatoFecha(props.inicioProyecto)}).`;
  return e;
});

const editable = (a: Avance) => props.puedeRegistrar && (a.estado === 'BORRADOR' || a.estado === 'OBSERVADO');

async function cargar() {
  if (!props.objetivo) return;
  cargando.value = true;
  errorCarga.value = null;
  try {
    const filtro = props.objetivo.tipo === 'IOV' ? { iovId: props.objetivo.id } : { actividadId: props.objetivo.id };
    avances.value = await listarAvances(props.proyectoId, filtro);
  } catch (e) {
    errorCarga.value = mensajeDeError(e, 'No se pudieron cargar los avances.');
  } finally {
    cargando.value = false;
  }
}

watch(visible, (abierto) => {
  if (!abierto) return;
  Object.assign(form, { valor: null, fechaCorte: hoy, descripcion: '' });
  enviado.value = false;
  errorServidor.value = null;
  avances.value = [];
  cargar();
});

async function registrar() {
  enviado.value = true;
  errorServidor.value = null;
  if (Object.keys(errores.value).length || !props.objetivo) return;
  guardando.value = true;
  try {
    const nuevo = await crearAvance(props.proyectoId, {
      ...(esIndicador.value ? { iovId: props.objetivo.id, valorReportado: form.valor! } : { actividadId: props.objetivo.id }),
      fechaCorte: form.fechaCorte,
      ...(form.descripcion.trim() ? { descripcion: form.descripcion.trim() } : {}),
    });
    avances.value = [nuevo, ...avances.value];
    Object.assign(form, { valor: null, fechaCorte: hoy, descripcion: '' });
    enviado.value = false;
    toast.add({ severity: 'success', summary: 'Avance guardado como borrador', detail: 'Adjunta su evidencia y envíalo a revisión.', life: 5000 });
  } catch (e) {
    errorServidor.value = mensajeDeError(e, 'No se pudo guardar el avance.');
  } finally {
    guardando.value = false;
  }
}

/** Reemplaza un avance de la lista por su versión actualizada. */
function actualizar(a: Avance) {
  avances.value = avances.value.map((x) => (x.id === a.id ? a : x));
}

async function adjuntar(a: Avance, evento: Event) {
  const input = evento.target as HTMLInputElement;
  const archivos = Array.from(input.files ?? []);
  input.value = '';
  for (const archivo of archivos) {
    const motivo = motivoArchivoInvalido(archivo);
    if (motivo) {
      toast.add({ severity: 'warn', summary: 'Archivo no admitido', detail: motivo, life: 7000 });
      continue;
    }
    subiendo.value = a.id;
    try {
      const evidencia = await subirEvidencia(props.proyectoId, a.id, archivo);
      const actual = avances.value.find((x) => x.id === a.id)!;
      actualizar({ ...actual, evidencias: [...actual.evidencias, evidencia] });
    } catch (e) {
      toast.add({ severity: 'error', summary: `No se pudo subir "${archivo.name}"`, detail: mensajeDeError(e), life: 7000 });
    } finally {
      subiendo.value = null;
    }
  }
}

async function abrirEvidencia(a: Avance, evidenciaId: string) {
  try {
    await abrirEnPestanaNueva(() => urlEvidencia(props.proyectoId, a.id, evidenciaId));
  } catch (e) {
    toast.add({ severity: 'error', summary: 'No se pudo abrir la evidencia', detail: mensajeDeError(e), life: 6000 });
  }
}

async function quitarEvidencia(a: Avance, evidenciaId: string) {
  trabajando.value = evidenciaId;
  try {
    await eliminarEvidencia(props.proyectoId, a.id, evidenciaId);
    actualizar({ ...a, evidencias: a.evidencias.filter((e) => e.id !== evidenciaId) });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'No se pudo quitar la evidencia', detail: mensajeDeError(e), life: 6000 });
  } finally {
    trabajando.value = null;
  }
}

async function enviarARevision(a: Avance) {
  trabajando.value = a.id;
  try {
    actualizar(await enviarAvance(props.proyectoId, a.id));
    toast.add({ severity: 'success', summary: 'Avance enviado a revisión', detail: 'El Administrador lo revisará.', life: 5000 });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'No se pudo enviar', detail: mensajeDeError(e), life: 7000 });
  } finally {
    trabajando.value = null;
  }
}

function pedirEliminar(a: Avance) {
  confirm.require({
    header: 'Eliminar borrador',
    message: '¿Eliminar este avance en borrador y sus evidencias? No se puede deshacer.',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancelar',
    acceptLabel: 'Eliminar',
    acceptProps: { severity: 'danger' },
    accept: async () => {
      try {
        await eliminarAvance(props.proyectoId, a.id);
        avances.value = avances.value.filter((x) => x.id !== a.id);
      } catch (e) {
        toast.add({ severity: 'error', summary: 'No se pudo eliminar', detail: mensajeDeError(e), life: 6000 });
      }
    },
  });
}

/** SGP-96: el avance revisado se actualiza en la lista y el marco lógico recalcula sus %. */
function revisado(a: Avance) {
  actualizar(a);
  emit('revisado', a);
}

const revisionTexto = (a: Avance) =>
  a.revisadoPor && a.revisadoAt && (a.estado === 'APROBADO' || a.estado === 'OBSERVADO')
    ? `${a.estado === 'APROBADO' ? 'Aprobado' : 'Observado'} por ${a.revisadoPor.nombre} el ${formatoFecha(a.revisadoAt)}`
    : null;

const valorTexto = (a: Avance) =>
  a.valorReportado === null ? null : `${formatoNumero(a.valorReportado)} ${a.objetivo.unidad ?? ''}`.trim();
const iconoArchivo = (mime: string) => (mime === 'application/pdf' ? 'pi pi-file-pdf' : 'pi pi-image');
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="objetivo ? `Avances de ${objetivo.codigo}` : 'Avances'"
    class="w-full max-w-2xl"
    :breakpoints="{ '640px': '100vw' }"
    :pt="{ content: { class: 'pb-5' } }"
  >
    <p
      v-if="objetivo"
      class="-mt-1 mb-4 line-clamp-2 text-sm text-slate-500"
    >
      {{ objetivo.nombre }}
    </p>

    <!-- Registrar un avance nuevo -->
    <form
      v-if="puedeRegistrar"
      class="mb-5 rounded-lg border border-violet-200 bg-violet-50/40 p-4"
      novalidate
      data-test="form-avance"
      @submit.prevent="registrar"
    >
      <h3 class="mb-3 text-sm font-semibold text-slate-700">
        Registrar avance
      </h3>
      <Message
        v-if="errorServidor"
        severity="error"
        size="small"
        class="mb-3"
        data-test="error-servidor"
      >
        {{ errorServidor }}
      </Message>
      <div class="grid gap-3 sm:grid-cols-2">
        <div
          v-if="esIndicador"
          class="flex flex-col gap-1.5"
        >
          <label
            for="av-valor"
            class="text-sm font-medium text-slate-700"
          >Valor alcanzado</label>
          <InputNumber
            v-model="form.valor"
            input-id="av-valor"
            :min="0"
            :max-fraction-digits="2"
            :suffix="objetivo?.unidad ? ` ${objetivo.unidad}` : undefined"
            placeholder="Ej.: 40"
            :invalid="enviado && !!errores.valor"
            :disabled="guardando"
            fluid
            data-test="valor"
          />
          <small
            v-if="enviado && errores.valor"
            class="text-xs text-red-600"
          >{{ errores.valor }}</small>
        </div>
        <div class="flex flex-col gap-1.5">
          <label
            for="av-fecha"
            class="text-sm font-medium text-slate-700"
          >Fecha de corte</label>
          <InputText
            id="av-fecha"
            v-model="form.fechaCorte"
            type="date"
            :min="inicioProyecto"
            :max="hoy"
            :invalid="enviado && !!errores.fecha"
            :disabled="guardando"
            fluid
            data-test="fecha-corte"
          />
          <small
            v-if="enviado && errores.fecha"
            class="text-xs text-red-600"
          >{{ errores.fecha }}</small>
        </div>
        <div class="flex flex-col gap-1.5 sm:col-span-2">
          <label
            for="av-desc"
            class="text-sm font-medium text-slate-700"
          >Qué se hizo (opcional)</label>
          <Textarea
            id="av-desc"
            v-model="form.descripcion"
            rows="2"
            auto-resize
            maxlength="2000"
            placeholder="Huertos instalados en la zona alta…"
            :disabled="guardando"
            fluid
          />
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs text-slate-500">
          Se guarda como borrador. Después adjunta la evidencia y envíalo.
        </p>
        <Button
          type="submit"
          label="Guardar borrador"
          icon="pi pi-save"
          size="small"
          :loading="guardando"
          data-test="guardar-borrador"
        />
      </div>
    </form>

    <!-- Avances registrados -->
    <h3 class="mb-2 text-sm font-semibold text-slate-700">
      {{ puedeRegistrar ? 'Mis avances' : 'Avances enviados' }}
    </h3>
    <p
      v-if="cargando"
      class="py-4 text-center text-sm text-slate-400"
      aria-busy="true"
    >
      Cargando…
    </p>
    <Message
      v-else-if="errorCarga"
      severity="error"
      size="small"
    >
      {{ errorCarga }}
    </Message>
    <p
      v-else-if="avances.length === 0"
      class="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500"
      data-test="sin-avances"
    >
      {{ puedeRegistrar ? 'Todavía no registraste avances aquí.' : 'Todavía no hay avances enviados.' }}
    </p>

    <ul
      v-else
      class="space-y-3"
    >
      <li
        v-for="a in avances"
        :key="a.id"
        class="rounded-lg border border-slate-200 p-4"
        data-test="avance"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p
              v-if="valorTexto(a)"
              class="text-lg font-semibold tabular-nums text-slate-800"
              data-test="avance-valor"
            >
              {{ valorTexto(a) }}
            </p>
            <p class="text-xs text-slate-500">
              Al {{ formatoFecha(a.fechaCorte) }}<template v-if="!puedeRegistrar">
                · {{ a.autor.nombre }}
              </template>
            </p>
          </div>
          <Tag
            :value="ESTADOS[a.estado].label"
            :icon="ESTADOS[a.estado].icono"
            :class="ESTADOS[a.estado].clases"
            rounded
            data-test="avance-estado"
          />
        </div>
        <p
          v-if="a.descripcion"
          class="mt-2 whitespace-pre-line text-sm text-slate-700"
        >
          {{ a.descripcion }}
        </p>
        <p
          v-if="a.estado === 'OBSERVADO' && a.observacion"
          class="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          <span class="font-medium">Observación:</span> {{ a.observacion }}
        </p>
        <p
          v-if="revisionTexto(a)"
          class="mt-1.5 text-xs text-slate-500"
          data-test="avance-revision"
        >
          {{ revisionTexto(a) }}
        </p>

        <!-- Evidencias -->
        <div class="mt-3">
          <div class="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs font-medium text-slate-600">
              Evidencias ({{ a.evidencias.length }})
            </p>
            <!-- RN-08 (SGP-134): lo enviado no se toca -->
            <span
              v-if="a.estado !== 'BORRADOR' && a.evidencias.length"
              class="inline-flex items-center gap-1 text-xs text-slate-500"
              title="Las evidencias de un avance enviado no se pueden quitar ni modificar."
              data-test="evidencias-bloqueadas"
            >
              <i
                class="pi pi-lock text-[10px]"
                aria-hidden="true"
              />Enviadas: no se pueden quitar ni modificar
            </span>
          </div>
          <ul class="space-y-1">
            <li
              v-for="e in a.evidencias"
              :key="e.id"
              class="flex items-center gap-2 text-sm"
              data-test="evidencia"
            >
              <i :class="[iconoArchivo(e.mime), 'text-slate-400']" />
              <button
                type="button"
                class="min-w-0 truncate text-left text-violet-700 hover:underline"
                :title="`Abrir ${e.nombreOriginal}`"
                @click="abrirEvidencia(a, e.id)"
              >
                {{ e.nombreOriginal }}
              </button>
              <span class="shrink-0 text-xs text-slate-400">{{ formatoTamano(e.tamanoBytes) }}</span>
              <Button
                v-if="puedeRegistrar && a.estado === 'BORRADOR'"
                icon="pi pi-times"
                severity="secondary"
                text
                rounded
                size="small"
                class="ml-auto"
                :loading="trabajando === e.id"
                :aria-label="`Quitar ${e.nombreOriginal}`"
                data-test="quitar-evidencia"
                @click="quitarEvidencia(a, e.id)"
              />
            </li>
          </ul>

          <label
            v-if="editable(a)"
            :class="[
              'mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm transition-colors',
              subiendo === a.id ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-300 text-slate-600 hover:border-violet-400 hover:bg-violet-50/50',
            ]"
            data-test="adjuntar"
          >
            <i :class="subiendo === a.id ? 'pi pi-spin pi-spinner' : 'pi pi-paperclip'" />
            {{
              subiendo === a.id
                ? 'Subiendo…'
                : a.estado === 'OBSERVADO'
                  ? 'Adjuntar evidencia corregida (PDF, JPG, PNG o WEBP, hasta 25 MB)'
                  : 'Adjuntar evidencia (PDF, JPG, PNG o WEBP, hasta 25 MB)'
            }}
            <input
              type="file"
              class="sr-only"
              multiple
              :accept="EXTENSIONES_ADMITIDAS"
              :disabled="subiendo === a.id"
              data-test="input-archivo"
              @change="adjuntar(a, $event)"
            >
          </label>
        </div>

        <!-- Revisión del Administrador (SGP-96) -->
        <AccionesRevision
          v-if="puedeRevisar && a.estado === 'ENVIADO'"
          class="mt-3 border-t border-slate-100 pt-3"
          :proyecto-id="proyectoId"
          :avance-id="a.id"
          @revisado="revisado"
        />

        <!-- Acciones -->
        <div
          v-if="editable(a)"
          class="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3"
        >
          <span
            v-if="a.evidencias.length === 0"
            class="mr-auto text-xs text-amber-700"
            data-test="falta-evidencia"
          >
            Adjunta al menos una evidencia para poder enviarlo.
          </span>
          <Button
            v-if="a.estado === 'BORRADOR'"
            label="Eliminar"
            icon="pi pi-trash"
            severity="danger"
            text
            size="small"
            data-test="eliminar-avance"
            @click="pedirEliminar(a)"
          />
          <Button
            :label="a.estado === 'OBSERVADO' ? 'Reenviar a revisión' : 'Enviar a revisión'"
            icon="pi pi-send"
            size="small"
            :disabled="a.evidencias.length === 0"
            :loading="trabajando === a.id"
            data-test="enviar-avance"
            @click="enviarARevision(a)"
          />
        </div>
      </li>
    </ul>
  </Dialog>
</template>