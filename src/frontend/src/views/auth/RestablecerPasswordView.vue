<script setup lang="ts">
import { isAxiosError } from 'axios';
import Button from 'primevue/button';
import Message from 'primevue/message';
import Password from 'primevue/password';
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { restablecerPassword } from '@/api/auth';
import type { ProblemDetails } from '@/api/proyectos';
import AuthLayout from '@/components/auth/AuthLayout.vue';

/** SGP-110 / CP-33: el usuario llega desde el enlace del correo y elige su nueva contraseña. */
const MINIMO = 8;

const route = useRoute();
const router = useRouter();

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));
const form = reactive({ password: '', confirmacion: '' });
const enviado = ref(false);
const guardando = ref(false);
const enlaceInvalido = ref(false);
const errorServidor = ref<string | null>(null);

const errores = computed(() => {
  const e: { password?: string; confirmacion?: string } = {};
  if (form.password.length < MINIMO) e.password = `Usa al menos ${MINIMO} caracteres.`;
  if (form.confirmacion !== form.password) e.confirmacion = 'Las contraseñas no coinciden.';
  return e;
});
const visible = (campo: 'password' | 'confirmacion') => (enviado.value ? errores.value[campo] : undefined);

async function guardar() {
  enviado.value = true;
  errorServidor.value = null;
  if (Object.keys(errores.value).length > 0) return;

  guardando.value = true;
  try {
    await restablecerPassword(token.value, form.password);
    await router.replace({ name: 'login', query: { restablecida: '1' } });
  } catch (e) {
    const status = isAxiosError<ProblemDetails>(e) ? e.response?.status : undefined;
    if (status === 400 && !errorDeValidacion(e)) {
      enlaceInvalido.value = true;
    } else {
      errorServidor.value = !status
        ? 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
        : status === 429
          ? 'Demasiados intentos. Espera un minuto antes de volver a intentar.'
          : 'No se pudo cambiar la contraseña. Inténtalo de nuevo en unos minutos.';
    }
  } finally {
    guardando.value = false;
  }
}

/** El servidor responde 400 también cuando la contraseña no cumple el mínimo; ese caso no invalida el enlace. */
function errorDeValidacion(e: unknown): boolean {
  const detalle = isAxiosError<ProblemDetails>(e) ? e.response?.data?.detail : undefined;
  const texto = Array.isArray(detalle) ? detalle.join(' ') : (detalle ?? '');
  return /contraseña debe tener|al menos \d+ caracteres/i.test(texto);
}

const sinEnlace = computed(() => !token.value || enlaceInvalido.value);
</script>

<template>
  <AuthLayout>
    <div
      v-if="sinEnlace"
      class="auth__form"
      data-test="enlace-invalido"
    >
      <h2>Este enlace ya no sirve</h2>
      <p class="auth__ayuda">
        El enlace es de un solo uso y vence a los 30 minutos. Pide uno nuevo para elegir tu contraseña.
      </p>
      <RouterLink
        :to="{ name: 'olvide-contrasena' }"
        class="auth__enlace-boton"
        data-test="pedir-nuevo"
      >
        Pedir un enlace nuevo
      </RouterLink>
    </div>

    <form
      v-else
      class="auth__form"
      novalidate
      data-test="form-restablecer"
      @submit.prevent="guardar"
    >
      <h2>Elige tu nueva contraseña</h2>
      <p class="auth__ayuda">
        Usa al menos {{ MINIMO }} caracteres. Al guardarla se cerrarán tus sesiones abiertas.
      </p>

      <div aria-live="assertive">
        <Message
          v-if="errorServidor"
          severity="error"
          size="small"
          class="mb-5"
          data-test="error-servidor"
        >
          {{ errorServidor }}
        </Message>
      </div>

      <div class="auth__campo">
        <label for="password">Nueva contraseña</label>
        <Password
          v-model="form.password"
          input-id="password"
          autocomplete="new-password"
          :feedback="false"
          toggle-mask
          :invalid="!!visible('password')"
          :disabled="guardando"
          fluid
          data-test="password"
        />
        <Message
          v-if="visible('password')"
          severity="error"
          size="small"
          variant="simple"
          data-test="error-password"
        >
          {{ visible('password') }}
        </Message>
      </div>

      <div class="auth__campo">
        <label for="confirmacion">Repite la contraseña</label>
        <Password
          v-model="form.confirmacion"
          input-id="confirmacion"
          autocomplete="new-password"
          :feedback="false"
          toggle-mask
          :invalid="!!visible('confirmacion')"
          :disabled="guardando"
          fluid
          data-test="confirmacion"
        />
        <Message
          v-if="visible('confirmacion')"
          severity="error"
          size="small"
          variant="simple"
          data-test="error-confirmacion"
        >
          {{ visible('confirmacion') }}
        </Message>
      </div>

      <Button
        type="submit"
        :label="guardando ? 'Guardando…' : 'Guardar contraseña'"
        :loading="guardando"
        class="auth__boton"
        fluid
        data-test="guardar"
      />
    </form>
  </AuthLayout>
</template>