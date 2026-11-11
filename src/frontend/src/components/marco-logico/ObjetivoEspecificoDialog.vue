<script setup lang="ts">
import { isAxiosError } from 'axios';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Textarea from 'primevue/textarea';
import { useToast } from 'primevue/usetoast';
import { computed, reactive, ref, watch } from 'vue';
import { crearObjetivo } from '@/api/objetivos';
import type { ProblemDetails } from '@/api/proyectos';
import { mensajeDeError } from '@/utils/errores';

const props = defineProps<{ proyectoId: string; sugerencia: string }>();
const visible = defineModel<boolean>('visible', { required: true });
const emit = defineEmits<{ guardado: [] }>();

const toast = useToast();
const form = reactive({ codigo: '', descripcion: '' });
const enviado = ref(false);
const guardando = ref(false);

watch(visible, (abierto) => {
  if (!abierto) return;
  form.codigo = props.sugerencia;
  form.descripcion = '';
  enviado.value = false;
});

const errores = computed(() => ({
  codigo: form.codigo.trim()
    ? form.codigo.trim().length > 20
      ? 'El código no puede superar 20 caracteres.'
      : undefined
    : 'Ingresa el código, por ejemplo OE.1.',
  descripcion: form.descripcion.trim() ? undefined : 'Describe el objetivo específico.',
}));

function detalleProblema(e: unknown): string {
  if (!isAxiosError<ProblemDetails>(e)) return mensajeDeError(e);
  const detalle = e.response?.data?.detail;
  return (Array.isArray(detalle) ? detalle.join(' ') : detalle) || mensajeDeError(e);
}

async function guardar() {
  enviado.value = true;
  if (errores.value.codigo || errores.value.descripcion) return;
  guardando.value = true;
  try {
    await crearObjetivo(props.proyectoId, {
      codigo: form.codigo.trim(),
      descripcion: form.descripcion.trim(),
    });
    toast.add({
      severity: 'success',
      summary: 'Objetivo registrado',
      detail: `Se guardó el objetivo ${form.codigo.trim()}.`,
      life: 4000,
    });
    emit('guardado');
    visible.value = false;
  } catch (e) {
    if (isAxiosError(e) && e.response?.status === 409) {
      toast.add({
        severity: 'error',
        summary: 'Código duplicado',
        detail: detalleProblema(e) || 'Ya existe un objetivo específico con ese código en el proyecto.',
        life: 6000,
      });
      return;
    }
    toast.add({
      severity: 'error',
      summary: 'No se pudo guardar',
      detail: detalleProblema(e),
      life: 6000,
    });
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Nuevo Objetivo Específico"
    class="w-full max-w-lg"
    :closable="!guardando"
  >
    <form
      class="flex flex-col gap-4"
      novalidate
      data-test="form-objetivo"
      @submit.prevent="guardar"
    >
      <div class="flex flex-col gap-1.5">
        <label
          for="oe-codigo"
          class="text-sm font-medium text-slate-700"
        >Código</label>
        <InputText
          id="oe-codigo"
          v-model="form.codigo"
          maxlength="20"
          placeholder="OE.1"
          :invalid="enviado && !!errores.codigo"
          :disabled="guardando"
          data-test="oe-codigo"
        />
        <Message
          v-if="enviado && errores.codigo"
          severity="error"
          size="small"
          variant="simple"
          data-test="error-oe-codigo"
        >
          {{ errores.codigo }}
        </Message>
      </div>
      <div class="flex flex-col gap-1.5">
        <label
          for="oe-descripcion"
          class="text-sm font-medium text-slate-700"
        >Descripción</label>
        <Textarea
          id="oe-descripcion"
          v-model="form.descripcion"
          rows="4"
          auto-resize
          placeholder="Desarrollar habilidades parentales…"
          :invalid="enviado && !!errores.descripcion"
          :disabled="guardando"
          data-test="oe-descripcion"
        />
        <Message
          v-if="enviado && errores.descripcion"
          severity="error"
          size="small"
          variant="simple"
          data-test="error-oe-descripcion"
        >
          {{ errores.descripcion }}
        </Message>
      </div>
      <div class="flex justify-end gap-2">
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
          label="Crear objetivo"
          :loading="guardando"
          data-test="guardar-objetivo"
        />
      </div>
    </form>
  </Dialog>
</template>
