<script setup lang="ts">
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import { useToast } from 'primevue/usetoast';
import { ref } from 'vue';
import { anularEvidencia, EXTENSIONES_ADMITIDAS, formatoTamano, urlEvidencia, type Evidencia } from '@/api/avances';
import { mensajeDeError } from '@/utils/errores';
import { formatoFecha } from '@/utils/formato';
import { abrirEnPestanaNueva } from '@/utils/pestana';

/**
 * Una evidencia de un avance: se abre en otra pestaña, el autor la quita mientras es borrador o la
 * corrige con una nueva versión si el avance fue observado (SGP-136), y el Administrador la anula con
 * motivo (SGP-135). Una anulada o reemplazada se sigue pudiendo abrir.
 */
const props = defineProps<{
  proyectoId: string;
  avanceId: string;
  evidencia: Evidencia;
  /** Autor con el avance en borrador. */
  puedeQuitar?: boolean;
  quitando?: boolean;
  /** Administrador, con el avance ya enviado y el proyecto abierto. */
  puedeAnular?: boolean;
  /** Autor con el avance observado: corrige con una nueva versión. */
  puedeVersionar?: boolean;
  versionando?: boolean;
}>();
const emit = defineEmits<{ quitar: []; anulada: [evidencia: Evidencia]; 'nueva-version': [archivo: File] }>();

const toast = useToast();
const MINIMO = 5;

const anulando = ref(false);
const motivo = ref('');
const intento = ref(false);
const guardando = ref(false);

const iconoArchivo = (mime: string) => (mime === 'application/pdf' ? 'pi pi-file-pdf' : 'pi pi-image');

async function abrir() {
  try {
    await abrirEnPestanaNueva(() => urlEvidencia(props.proyectoId, props.avanceId, props.evidencia.id));
  } catch (e) {
    toast.add({ severity: 'error', summary: 'No se pudo abrir la evidencia', detail: mensajeDeError(e), life: 6000 });
  }
}

const motivoInvalido = () => motivo.value.trim().length < MINIMO;

async function anular() {
  intento.value = true;
  if (motivoInvalido()) return;
  guardando.value = true;
  try {
    emit('anulada', await anularEvidencia(props.proyectoId, props.avanceId, props.evidencia.id, motivo.value.trim()));
    toast.add({ severity: 'info', summary: 'Evidencia anulada', detail: 'El archivo original se conserva y quedó en la bitácora.', life: 5000 });
    cancelar();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'No se pudo anular', detail: mensajeDeError(e), life: 7000 });
  } finally {
    guardando.value = false;
  }
}

function elegirVersion(evento: Event) {
  const input = evento.target as HTMLInputElement;
  const archivo = input.files?.[0];
  input.value = '';
  if (archivo) emit('nueva-version', archivo);
}

function cancelar() {
  anulando.value = false;
  motivo.value = '';
  intento.value = false;
}
</script>

<template>
  <li
    class="text-sm"
    data-test="evidencia"
  >
    <div class="flex items-center gap-2">
      <i :class="[iconoArchivo(evidencia.mime), 'text-slate-400']" />
      <button
        type="button"
        :class="[
          'min-w-0 truncate text-left hover:underline',
          evidencia.anulacion ? 'text-slate-500 line-through' : evidencia.vigente ? 'text-violet-700' : 'text-slate-500',
        ]"
        :title="`Abrir ${evidencia.nombreOriginal}`"
        data-test="abrir-evidencia"
        @click="abrir"
      >
        {{ evidencia.nombreOriginal }}
      </button>
      <span class="shrink-0 text-xs text-slate-400">{{ formatoTamano(evidencia.tamanoBytes) }}</span>
      <span
        v-if="evidencia.version > 1"
        class="shrink-0 rounded bg-violet-50 px-1.5 text-[11px] font-medium text-violet-700"
        :title="`Versión ${evidencia.version}`"
        data-test="version"
      >v{{ evidencia.version }}</span>
      <span
        v-if="!evidencia.vigente"
        class="shrink-0 rounded bg-slate-100 px-1.5 text-[11px] text-slate-500"
        data-test="reemplazada"
      >Reemplazada</span>
      <Tag
        v-if="evidencia.anulacion"
        value="Anulada"
        icon="pi pi-ban"
        class="!bg-red-50 !px-1.5 !py-0 !text-[11px] !text-red-700"
        rounded
        data-test="evidencia-anulada"
      />
      <Button
        v-if="puedeQuitar"
        icon="pi pi-times"
        severity="secondary"
        text
        rounded
        size="small"
        class="ml-auto"
        :loading="quitando"
        :aria-label="`Quitar ${evidencia.nombreOriginal}`"
        data-test="quitar-evidencia"
        @click="emit('quitar')"
      />
      <label
        v-if="puedeVersionar && evidencia.vigente"
        :class="[
          'ml-auto inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
          versionando ? 'text-violet-500' : 'text-violet-700 hover:bg-violet-50',
        ]"
        :title="`Subir una versión corregida de ${evidencia.nombreOriginal}`"
        data-test="nueva-version"
      >
        <i :class="versionando ? 'pi pi-spin pi-spinner' : 'pi pi-history'" />
        {{ versionando ? 'Subiendo…' : 'Nueva versión' }}
        <input
          type="file"
          class="sr-only"
          :accept="EXTENSIONES_ADMITIDAS"
          :disabled="versionando"
          data-test="input-version"
          @change="elegirVersion"
        >
      </label>
      <Button
        v-if="puedeAnular && evidencia.vigente && !evidencia.anulacion && !anulando"
        label="Anular"
        icon="pi pi-ban"
        severity="danger"
        text
        size="small"
        class="ml-auto"
        data-test="anular-evidencia"
        @click="anulando = true"
      />
    </div>

    <p
      v-if="evidencia.anulacion"
      class="ml-6 mt-0.5 text-xs text-red-700"
      data-test="motivo-anulacion"
    >
      Anulada por {{ evidencia.anulacion.por.nombre }} el {{ formatoFecha(evidencia.anulacion.at) }}: {{ evidencia.anulacion.motivo }}
    </p>

    <form
      v-if="anulando"
      class="ml-6 mt-2 flex flex-col gap-2 rounded-md border border-red-200 bg-red-50/40 p-3"
      novalidate
      @submit.prevent="anular"
    >
      <label
        :for="`anular-${evidencia.id}`"
        class="text-xs font-medium text-slate-700"
      >¿Por qué se anula? El archivo no se borra: queda como registro.</label>
      <Textarea
        :id="`anular-${evidencia.id}`"
        v-model="motivo"
        rows="2"
        auto-resize
        maxlength="1000"
        placeholder="La foto corresponde a otra comunidad…"
        :invalid="intento && motivoInvalido()"
        :disabled="guardando"
        fluid
        data-test="motivo"
      />
      <small
        v-if="intento && motivoInvalido()"
        class="text-xs text-red-600"
        data-test="falta-motivo"
      >Explica el motivo de la anulación (al menos {{ MINIMO }} caracteres).</small>
      <div class="flex justify-end gap-2">
        <Button
          label="Cancelar"
          severity="secondary"
          text
          size="small"
          :disabled="guardando"
          @click="cancelar"
        />
        <Button
          type="submit"
          label="Anular evidencia"
          icon="pi pi-ban"
          severity="danger"
          size="small"
          :loading="guardando"
          data-test="confirmar-anulacion"
        />
      </div>
    </form>
  </li>
</template>