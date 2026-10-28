<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Textarea from 'primevue/textarea';
import { computed, reactive, ref, watch } from 'vue';
import { crearResultado } from '@/api/marcoLogico';
import { mensajeDeError } from '@/utils/errores';

const props = defineProps<{ proyectoId: string; sugerencia: string }>();
const visible = defineModel<boolean>('visible', { required: true });
const emit = defineEmits<{ guardado: [] }>();

const form = reactive({ codigo: '', descripcion: '' });
const enviado = ref(false);
const guardando = ref(false);
const errorServidor = ref<string | null>(null);

watch(visible, (abierto) => {
  if (!abierto) return;
  form.codigo = props.sugerencia;
  form.descripcion = '';
  enviado.value = false;
  errorServidor.value = null;
});

const errores = computed(() => ({
  codigo: form.codigo.trim() ? undefined : 'Ingresa el código, por ejemplo R.1.',
  descripcion: form.descripcion.trim() ? undefined : 'Describe qué se espera lograr.',
}));

async function guardar() {
  enviado.value = true;
  errorServidor.value = null;
  if (errores.value.codigo || errores.value.descripcion) return;
  guardando.value = true;
  try {
    await crearResultado(props.proyectoId, { codigo: form.codigo.trim(), descripcion: form.descripcion.trim() });
    emit('guardado');
    visible.value = false;
  } catch (e) {
    errorServidor.value = mensajeDeError(e, 'No se pudo guardar el resultado.');
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Nuevo resultado"
    class="w-full max-w-lg"
    :closable="!guardando"
  >
    <form
      class="flex flex-col gap-4"
      novalidate
      data-test="form-resultado"
      @submit.prevent="guardar"
    >
      <Message
        v-if="errorServidor"
        severity="error"
        size="small"
        data-test="error-servidor"
      >
        {{ errorServidor }}
      </Message>
      <div class="flex flex-col gap-1.5">
        <label
          for="res-codigo"
          class="text-sm font-medium text-slate-700"
        >Código</label>
        <InputText
          id="res-codigo"
          v-model="form.codigo"
          maxlength="20"
          placeholder="R.1"
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
          for="res-descripcion"
          class="text-sm font-medium text-slate-700"
        >Qué se espera lograr</label>
        <Textarea
          id="res-descripcion"
          v-model="form.descripcion"
          rows="4"
          auto-resize
          placeholder="Las personas de la zona se llevan bien…"
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
          label="Crear resultado"
          :loading="guardando"
          data-test="guardar-resultado"
        />
      </div>
    </form>
  </Dialog>
</template>