<script setup lang="ts">
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { ref } from 'vue';
import { aprobarAvance, observarAvance, type Avance } from '@/api/avances';
import { mensajeDeError } from '@/utils/errores';

/**
 * SGP-94 / SGP-96: el Administrador aprueba u observa un avance enviado.
 * Para observar hace falta escribir qué corregir (CP-27).
 */
const props = defineProps<{ proyectoId: string; avanceId: string }>();
const emit = defineEmits<{ revisado: [avance: Avance] }>();

const toast = useToast();
const confirm = useConfirm();

const observando = ref(false);
const observacion = ref('');
const intento = ref(false);
const trabajando = ref<'aprobar' | 'observar' | null>(null);

function pedirAprobacion() {
  confirm.require({
    header: 'Aprobar avance',
    message: 'Al aprobarlo, su valor se suma al cumplimiento del indicador y ya no se puede modificar. ¿Continuar?',
    icon: 'pi pi-check-circle',
    rejectLabel: 'Cancelar',
    acceptLabel: 'Aprobar',
    accept: aprobar,
  });
}

async function aprobar() {
  trabajando.value = 'aprobar';
  try {
    emit('revisado', await aprobarAvance(props.proyectoId, props.avanceId));
    toast.add({ severity: 'success', summary: 'Avance aprobado', detail: 'El cumplimiento se actualizó.', life: 4000 });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'No se pudo aprobar', detail: mensajeDeError(e), life: 7000 });
  } finally {
    trabajando.value = null;
  }
}

async function observar() {
  intento.value = true;
  const texto = observacion.value.trim();
  if (!texto) return;
  trabajando.value = 'observar';
  try {
    emit('revisado', await observarAvance(props.proyectoId, props.avanceId, texto));
    toast.add({ severity: 'info', summary: 'Avance observado', detail: 'Volvió al técnico para que lo corrija.', life: 4000 });
    cancelar();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'No se pudo observar', detail: mensajeDeError(e), life: 7000 });
  } finally {
    trabajando.value = null;
  }
}

function cancelar() {
  observando.value = false;
  observacion.value = '';
  intento.value = false;
}
</script>

<template>
  <div data-test="acciones-revision">
    <form
      v-if="observando"
      class="flex flex-col gap-2"
      novalidate
      @submit.prevent="observar"
    >
      <label
        :for="`obs-${avanceId}`"
        class="text-sm font-medium text-slate-700"
      >¿Qué debe corregir el técnico?</label>
      <Textarea
        :id="`obs-${avanceId}`"
        v-model="observacion"
        rows="2"
        auto-resize
        maxlength="2000"
        placeholder="El acta no tiene las firmas de los beneficiarios…"
        :invalid="intento && !observacion.trim()"
        :disabled="trabajando !== null"
        fluid
        data-test="texto-observacion"
      />
      <small
        v-if="intento && !observacion.trim()"
        class="text-xs text-red-600"
        data-test="falta-observacion"
      >Escribe la observación: el técnico necesita saber qué corregir.</small>
      <div class="flex justify-end gap-2">
        <Button
          label="Cancelar"
          severity="secondary"
          text
          size="small"
          :disabled="trabajando !== null"
          @click="cancelar"
        />
        <Button
          type="submit"
          label="Enviar observación"
          icon="pi pi-send"
          severity="warn"
          size="small"
          :loading="trabajando === 'observar'"
          data-test="confirmar-observacion"
        />
      </div>
    </form>
    <div
      v-else
      class="flex flex-wrap justify-end gap-2"
    >
      <Button
        label="Observar"
        icon="pi pi-comment"
        severity="warn"
        outlined
        size="small"
        :disabled="trabajando !== null"
        data-test="observar"
        @click="observando = true"
      />
      <Button
        label="Aprobar"
        icon="pi pi-check"
        severity="success"
        size="small"
        :loading="trabajando === 'aprobar'"
        data-test="aprobar"
        @click="pedirAprobacion"
      />
    </div>
  </div>
</template>