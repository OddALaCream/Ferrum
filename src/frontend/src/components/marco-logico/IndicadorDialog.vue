<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Textarea from 'primevue/textarea';
import { computed, reactive, ref, watch } from 'vue';
import { crearIndicador } from '@/api/marcoLogico';
import { mensajeDeError } from '@/utils/errores';

const props = defineProps<{ proyectoId: string; resultadoId: string | null; resultadoCodigo: string; sugerencia: string }>();
const visible = defineModel<boolean>('visible', { required: true });
const emit = defineEmits<{ guardado: [] }>();

const form = reactive({
  codigo: '',
  descripcion: '',
  unidad: '',
  lineaBase: 0 as number | null,
  meta: null as number | null,
  peso: null as number | null,
  fuenteVerificacion: '',
});
const enviado = ref(false);
const guardando = ref(false);
const errorServidor = ref<string | null>(null);

watch(visible, (abierto) => {
  if (!abierto) return;
  Object.assign(form, { codigo: props.sugerencia, descripcion: '', unidad: '', lineaBase: 0, meta: null, peso: null, fuenteVerificacion: '' });
  enviado.value = false;
  errorServidor.value = null;
});

const errores = computed(() => {
  const e: Partial<Record<'codigo' | 'descripcion' | 'unidad' | 'meta' | 'fuente', string>> = {};
  if (!form.codigo.trim()) e.codigo = 'Ingresa el código, por ejemplo I.O.V. 1.1.';
  if (!form.descripcion.trim()) e.descripcion = 'Describe qué se mide.';
  if (!form.unidad.trim()) e.unidad = 'Indica la unidad (%, beneficiarios…).';
  if (form.meta === null) e.meta = 'Ingresa el valor que se quiere alcanzar.';
  else if (form.meta === (form.lineaBase ?? 0)) e.meta = 'La meta debe ser distinta de la línea base.';
  if (!form.fuenteVerificacion.trim()) e.fuente = 'Indica qué documentos o registros prueban el indicador.';
  return e;
});

async function guardar() {
  enviado.value = true;
  errorServidor.value = null;
  if (Object.keys(errores.value).length > 0 || !props.resultadoId) return;
  guardando.value = true;
  try {
    await crearIndicador(props.proyectoId, props.resultadoId, {
      codigo: form.codigo.trim(),
      descripcion: form.descripcion.trim(),
      unidad: form.unidad.trim(),
      lineaBase: form.lineaBase ?? 0,
      meta: form.meta!,
      ...(form.peso === null ? {} : { peso: form.peso }),
      fuenteVerificacion: form.fuenteVerificacion.trim(),
    });
    emit('guardado');
    visible.value = false;
  } catch (e) {
    errorServidor.value = mensajeDeError(e, 'No se pudo guardar el indicador.');
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="`Nuevo indicador en ${resultadoCodigo}`"
    class="w-full max-w-xl"
    :closable="!guardando"
  >
    <form
      class="grid gap-4 sm:grid-cols-2"
      novalidate
      data-test="form-indicador"
      @submit.prevent="guardar"
    >
      <Message
        v-if="errorServidor"
        severity="error"
        size="small"
        class="sm:col-span-2"
        data-test="error-servidor"
      >
        {{ errorServidor }}
      </Message>
      <div class="flex flex-col gap-1.5">
        <label
          for="iov-codigo"
          class="text-sm font-medium text-slate-700"
        >Código</label>
        <InputText
          id="iov-codigo"
          v-model="form.codigo"
          maxlength="20"
          :invalid="enviado && !!errores.codigo"
          :disabled="guardando"
        />
        <Message
          v-if="enviado && errores.codigo"
          severity="error"
          size="small"
          variant="simple"
        >
          {{ errores.codigo }}
        </Message>
      </div>
      <div class="flex flex-col gap-1.5">
        <label
          for="iov-unidad"
          class="text-sm font-medium text-slate-700"
        >Unidad de medida</label>
        <InputText
          id="iov-unidad"
          v-model="form.unidad"
          maxlength="50"
          placeholder="%, beneficiarios, asociaciones…"
          :invalid="enviado && !!errores.unidad"
          :disabled="guardando"
        />
        <Message
          v-if="enviado && errores.unidad"
          severity="error"
          size="small"
          variant="simple"
        >
          {{ errores.unidad }}
        </Message>
      </div>
      <div class="flex flex-col gap-1.5 sm:col-span-2">
        <label
          for="iov-descripcion"
          class="text-sm font-medium text-slate-700"
        >Qué se mide</label>
        <Textarea
          id="iov-descripcion"
          v-model="form.descripcion"
          rows="3"
          auto-resize
          :invalid="enviado && !!errores.descripcion"
          :disabled="guardando"
        />
        <Message
          v-if="enviado && errores.descripcion"
          severity="error"
          size="small"
          variant="simple"
        >
          {{ errores.descripcion }}
        </Message>
      </div>
      <div class="flex flex-col gap-1.5">
        <label
          for="iov-base"
          class="text-sm font-medium text-slate-700"
        >Línea base</label>
        <InputNumber
          v-model="form.lineaBase"
          input-id="iov-base"
          :min="0"
          :max-fraction-digits="2"
          :disabled="guardando"
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <label
          for="iov-meta"
          class="text-sm font-medium text-slate-700"
        >Meta (valor indicador)</label>
        <InputNumber
          v-model="form.meta"
          input-id="iov-meta"
          :min="0"
          :max-fraction-digits="2"
          :invalid="enviado && !!errores.meta"
          :disabled="guardando"
        />
        <Message
          v-if="enviado && errores.meta"
          severity="error"
          size="small"
          variant="simple"
        >
          {{ errores.meta }}
        </Message>
      </div>
      <div class="flex flex-col gap-1.5 sm:col-span-2">
        <label
          for="iov-fuente"
          class="text-sm font-medium text-slate-700"
        >Fuentes de verificación</label>
        <Textarea
          id="iov-fuente"
          v-model="form.fuenteVerificacion"
          rows="2"
          auto-resize
          placeholder="Actas de reunión, listas de asistencia, informes…"
          :invalid="enviado && !!errores.fuente"
          :disabled="guardando"
        />
        <Message
          v-if="enviado && errores.fuente"
          severity="error"
          size="small"
          variant="simple"
        >
          {{ errores.fuente }}
        </Message>
      </div>
      <div class="flex flex-col gap-1.5">
        <label
          for="iov-peso"
          class="text-sm font-medium text-slate-700"
        >Peso (opcional)</label>
        <InputNumber
          v-model="form.peso"
          input-id="iov-peso"
          :min="0"
          :max="100"
          suffix=" %"
          :max-fraction-digits="2"
          :disabled="guardando"
        />
      </div>
      <div class="flex items-end justify-end gap-2 sm:col-span-2">
        <Button
          type="button"
          label="Cancelar"
          severity="secondary"
          text
          :disabled="guardando"
          @click="visible = false"
        />
        <Button
          type="submit"
          label="Crear indicador"
          :loading="guardando"
          data-test="guardar-indicador"
        />
      </div>
    </form>
  </Dialog>
</template>