<script setup lang="ts">
import { isAxiosError } from 'axios';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Password from 'primevue/password';
import Select from 'primevue/select';
import { computed, reactive, ref, watch } from 'vue';
import type { RolApi } from '@/api/auth';
import type { ProblemDetails } from '@/api/proyectos';
import { crearUsuario, editarUsuario, ETIQUETA_ROL, type Usuario } from '@/api/usuarios';

/** Crear (sin `usuario`) o editar (con `usuario`) una cuenta. */
const props = defineProps<{ usuario: Usuario | null }>();
const visible = defineModel<boolean>('visible', { required: true });
const emit = defineEmits<{ guardado: [usuario: Usuario, creado: boolean] }>();

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OPCIONES_ROL = (Object.keys(ETIQUETA_ROL) as RolApi[]).map((value) => ({ value, label: ETIQUETA_ROL[value] }));

const esEdicion = computed(() => props.usuario !== null);
const form = reactive({ nombre: '', email: '', rol: 'TECNICO' as RolApi, password: '' });
const enviado = ref(false);
const guardando = ref(false);
const errorServidor = ref<string | null>(null);

watch(visible, (abierto) => {
  if (!abierto) return;
  form.nombre = props.usuario?.nombre ?? '';
  form.email = props.usuario?.email ?? '';
  form.rol = props.usuario?.rol ?? 'TECNICO';
  form.password = '';
  enviado.value = false;
  errorServidor.value = null;
});

const errores = computed(() => {
  const e: Partial<Record<'nombre' | 'email' | 'password', string>> = {};
  if (!form.nombre.trim()) e.nombre = 'Ingresa el nombre completo.';
  if (!CORREO_VALIDO.test(form.email.trim())) e.email = 'Ingresa un correo válido, por ejemplo nombre@serfamilia.org.';
  if (!esEdicion.value && form.password.length < 8) e.password = 'Usa al menos 8 caracteres.';
  return e;
});
const error = (campo: 'nombre' | 'email' | 'password') => (enviado.value ? errores.value[campo] : undefined);

async function guardar() {
  enviado.value = true;
  errorServidor.value = null;
  if (Object.keys(errores.value).length > 0) return;

  guardando.value = true;
  try {
    const datos = { nombre: form.nombre.trim(), email: form.email.trim().toLowerCase(), rol: form.rol };
    const guardado = props.usuario
      ? await editarUsuario(props.usuario.id, datos)
      : await crearUsuario({ ...datos, password: form.password });
    emit('guardado', guardado, !props.usuario);
    visible.value = false;
  } catch (e) {
    const detalle = isAxiosError<ProblemDetails>(e) ? e.response?.data?.detail : undefined;
    errorServidor.value = (Array.isArray(detalle) ? detalle.join(' ') : detalle) ?? 'No se pudo guardar. Inténtalo de nuevo.';
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="esEdicion ? 'Editar usuario' : 'Nuevo usuario'"
    class="w-full max-w-md"
    :closable="!guardando"
  >
    <form
      class="flex flex-col gap-4"
      novalidate
      data-test="form-usuario"
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
          for="usuario-nombre"
          class="text-sm font-medium text-slate-700"
        >Nombre completo</label>
        <InputText
          id="usuario-nombre"
          v-model="form.nombre"
          :invalid="!!error('nombre')"
          :disabled="guardando"
          fluid
        />
        <Message
          v-if="error('nombre')"
          severity="error"
          size="small"
          variant="simple"
        >
          {{ error('nombre') }}
        </Message>
      </div>

      <div class="flex flex-col gap-1.5">
        <label
          for="usuario-email"
          class="text-sm font-medium text-slate-700"
        >Correo electrónico</label>
        <InputText
          id="usuario-email"
          v-model="form.email"
          type="email"
          :invalid="!!error('email')"
          :disabled="guardando"
          fluid
        />
        <Message
          v-if="error('email')"
          severity="error"
          size="small"
          variant="simple"
        >
          {{ error('email') }}
        </Message>
      </div>

      <div class="flex flex-col gap-1.5">
        <label
          id="usuario-rol-label"
          for="usuario-rol"
          class="text-sm font-medium text-slate-700"
        >Rol</label>
        <Select
          v-model="form.rol"
          input-id="usuario-rol"
          aria-labelledby="usuario-rol-label"
          :options="OPCIONES_ROL"
          option-label="label"
          option-value="value"
          :disabled="guardando"
          fluid
        />
      </div>

      <div
        v-if="!esEdicion"
        class="flex flex-col gap-1.5"
      >
        <label
          for="usuario-password"
          class="text-sm font-medium text-slate-700"
        >Contraseña inicial</label>
        <Password
          v-model="form.password"
          input-id="usuario-password"
          autocomplete="new-password"
          :feedback="false"
          toggle-mask
          :invalid="!!error('password')"
          :disabled="guardando"
          fluid
        />
        <Message
          v-if="error('password')"
          severity="error"
          size="small"
          variant="simple"
        >
          {{ error('password') }}
        </Message>
        <p
          v-else
          class="text-xs text-slate-500"
        >
          Compártela con la persona; el sistema le pedirá cambiarla.
        </p>
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
          :label="esEdicion ? 'Guardar cambios' : 'Crear usuario'"
          :loading="guardando"
          data-test="guardar-usuario"
        />
      </div>
    </form>
  </Dialog>
</template>