<script setup lang="ts">
import { isAxiosError } from 'axios';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';
import Password from 'primevue/password';
import { ref, watch } from 'vue';
import type { ProblemDetails } from '@/api/proyectos';
import { restablecerPassword, type Usuario } from '@/api/usuarios';

/** El Administrador asigna una contraseña nueva; la cuenta se desbloquea y sus sesiones se cierran. */
const props = defineProps<{ usuario: Usuario | null }>();
const visible = defineModel<boolean>('visible', { required: true });
const emit = defineEmits<{ guardado: [] }>();

const password = ref('');
const enviado = ref(false);
const guardando = ref(false);
const errorServidor = ref<string | null>(null);

watch(visible, (abierto) => {
  if (!abierto) return;
  password.value = '';
  enviado.value = false;
  errorServidor.value = null;
});

async function guardar() {
  enviado.value = true;
  errorServidor.value = null;
  if (!props.usuario || password.value.length < 8) return;

  guardando.value = true;
  try {
    await restablecerPassword(props.usuario.id, password.value);
    emit('guardado');
    visible.value = false;
  } catch (e) {
    const detalle = isAxiosError<ProblemDetails>(e) ? e.response?.data?.detail : undefined;
    errorServidor.value = (Array.isArray(detalle) ? detalle.join(' ') : detalle) ?? 'No se pudo cambiar la contraseña.';
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Restablecer contraseña"
    class="w-full max-w-md"
    :closable="!guardando"
  >
    <form
      class="flex flex-col gap-4"
      novalidate
      @submit.prevent="guardar"
    >
      <p class="text-sm text-slate-600">
        Nueva contraseña para <strong class="font-medium text-slate-800">{{ usuario?.nombre }}</strong>.
        Se cerrarán sus sesiones abiertas y, si estaba bloqueada, la cuenta se desbloquea.
      </p>
      <Message
        v-if="errorServidor"
        severity="error"
        size="small"
      >
        {{ errorServidor }}
      </Message>
      <div class="flex flex-col gap-1.5">
        <label
          for="nueva-password"
          class="text-sm font-medium text-slate-700"
        >Nueva contraseña</label>
        <Password
          v-model="password"
          input-id="nueva-password"
          autocomplete="new-password"
          :feedback="false"
          toggle-mask
          :invalid="enviado && password.length < 8"
          :disabled="guardando"
          fluid
        />
        <Message
          v-if="enviado && password.length < 8"
          severity="error"
          size="small"
          variant="simple"
        >
          Usa al menos 8 caracteres.
        </Message>
      </div>
      <div class="mt-2 flex justify-end gap-2">
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
          label="Cambiar contraseña"
          :loading="guardando"
        />
      </div>
    </form>
  </Dialog>
</template>