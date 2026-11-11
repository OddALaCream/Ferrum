<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import { reactive, ref, watch } from 'vue';
import type { TecnicoProyecto } from '@/api/equipo';
import { crearTarea, editarTarea, type EstadoTarea, type Tarea } from '@/api/marcoLogico';
import { mensajeDeError } from '@/utils/errores';

const props = defineProps<{
  proyectoId: string;
  actividadId: string;
  equipo: TecnicoProyecto[];
  tarea: Tarea | null;
}>();
const visible = defineModel<boolean>('visible', { required: true });
const emit = defineEmits<{ guardado: [] }>();
const form = reactive({ nombre: '', responsableId: null as string | null, fechaLimite: '', estado: 'PENDIENTE' as EstadoTarea });
const estados = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_CURSO', label: 'En curso' },
  { value: 'COMPLETADA', label: 'Completada' },
];
const guardando = ref(false);
const error = ref('');
watch(visible, (abierta) => {
  if (!abierta) return;
  Object.assign(form, {
    nombre: props.tarea?.nombre ?? '', responsableId: props.tarea?.responsableId ?? null,
    fechaLimite: props.tarea?.fechaLimite ?? '', estado: props.tarea?.estado ?? 'PENDIENTE',
  });
  error.value = '';
});
async function guardar() {
  if (guardando.value) return;
  if (!form.nombre.trim()) { error.value = 'Describe qué hay que hacer.'; return; }
  guardando.value = true;
  error.value = '';
  try {
    const datos = { nombre: form.nombre.trim(), responsableId: form.responsableId || null, fechaLimite: form.fechaLimite || null };
    if (props.tarea) await editarTarea(props.proyectoId, props.tarea.id, { ...datos, estado: form.estado });
    else await crearTarea(props.proyectoId, props.actividadId, {
      nombre: datos.nombre,
      ...(datos.responsableId ? { responsableId: datos.responsableId } : {}),
      ...(datos.fechaLimite ? { fechaLimite: datos.fechaLimite } : {}),
    });
    emit('guardado');
    visible.value = false;
  } catch (e) {
    error.value = mensajeDeError(e, 'No se pudo guardar la tarea.');
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="tarea ? 'Editar tarea' : 'Nueva tarea'"
    :closable="!guardando"
    class="w-full max-w-lg"
  >
    <form
      class="flex flex-col gap-4"
      data-test="form-tarea"
      @submit.prevent="guardar"
    >
      <Message
        v-if="error"
        severity="error"
        data-test="error-tarea"
      >
        {{ error }}
      </Message>
      <div class="flex flex-col gap-1">
        <label for="tarea-descripcion">Descripción</label>
        <InputText
          id="tarea-descripcion"
          v-model="form.nombre"
          maxlength="250"
          :disabled="guardando"
        />
      </div>
      <div class="flex flex-col gap-1">
        <label for="tarea-responsable">Técnico responsable</label>
        <Select
          v-model="form.responsableId"
          input-id="tarea-responsable"
          aria-label="Técnico responsable"
          :options="equipo"
          option-label="nombre"
          option-value="id"
          placeholder="Sin asignar"
          show-clear
          :disabled="guardando"
        />
      </div>
      <div class="flex flex-col gap-1">
        <label for="tarea-fecha">Fecha límite</label>
        <InputText
          id="tarea-fecha"
          v-model="form.fechaLimite"
          type="date"
          :disabled="guardando"
        />
      </div>
      <div
        v-if="tarea"
        class="flex flex-col gap-1"
      >
        <label for="tarea-estado">Estado</label>
        <Select
          v-model="form.estado"
          input-id="tarea-estado"
          aria-label="Estado"
          :options="estados"
          option-label="label"
          option-value="value"
          :disabled="guardando"
        />
      </div>
      <div class="flex justify-end gap-2">
        <Button
          label="Cancelar"
          severity="secondary"
          :disabled="guardando"
          @click="visible = false"
        />
        <Button
          type="submit"
          label="Guardar tarea"
          :loading="guardando"
          data-test="guardar-tarea"
        />
      </div>
    </form>
  </Dialog>
</template>
