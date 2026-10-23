<script setup lang="ts">
import { isAxiosError } from 'axios';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import { computed, ref } from 'vue';
import { solicitarRestablecimiento } from '@/api/auth';
import type { ProblemDetails } from '@/api/proyectos';
import AuthLayout from '@/components/auth/AuthLayout.vue';

/** SGP-110: el usuario pide el enlace para elegir una contraseña nueva. */
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const email = ref('');
const enviado = ref(false);
const enviando = ref(false);
const solicitado = ref(false);
const errorServidor = ref<string | null>(null);

const errorEmail = computed(() => {
  if (!enviado.value) return undefined;
  if (!email.value.trim()) return 'Ingresa tu correo electrónico.';
  if (!CORREO_VALIDO.test(email.value.trim())) return 'Revisa el correo: debe tener la forma nombre@dominio.org.';
  return undefined;
});

async function solicitar() {
  enviado.value = true;
  errorServidor.value = null;
  if (errorEmail.value) return;

  enviando.value = true;
  try {
    await solicitarRestablecimiento(email.value.trim());
    solicitado.value = true;
  } catch (e) {
    const status = isAxiosError<ProblemDetails>(e) ? e.response?.status : undefined;
    errorServidor.value =
      status === 429
        ? 'Hiciste demasiadas solicitudes. Espera un minuto antes de volver a intentar.'
        : !status
          ? 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
          : 'No se pudo procesar la solicitud. Inténtalo de nuevo en unos minutos.';
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <div
      v-if="solicitado"
      class="auth__form"
      data-test="confirmacion"
    >
      <h2>Revisa tu correo</h2>
      <p class="auth__ayuda">
        Si <strong>{{ email.trim() }}</strong> está registrado, te enviamos un enlace para elegir una nueva contraseña.
        Sirve una sola vez y vence en 30 minutos.
      </p>
      <p class="auth__ayuda">
        ¿No llegó? Revisa la carpeta de spam o pide el enlace de nuevo.
      </p>
      <RouterLink
        :to="{ name: 'login' }"
        class="auth__enlace-boton"
        data-test="volver"
      >
        Volver a iniciar sesión
      </RouterLink>
    </div>

    <form
      v-else
      class="auth__form"
      novalidate
      data-test="form-olvide"
      @submit.prevent="solicitar"
    >
      <h2>¿Olvidaste tu contraseña?</h2>
      <p class="auth__ayuda">
        Escribe tu correo y te enviaremos un enlace para elegir una nueva.
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
        <label for="email">Correo electrónico</label>
        <InputText
          id="email"
          v-model="email"
          type="email"
          autocomplete="username"
          inputmode="email"
          placeholder="nombre@serfamilia.org"
          :invalid="!!errorEmail"
          :disabled="enviando"
          fluid
          data-test="email"
        />
        <Message
          v-if="errorEmail"
          severity="error"
          size="small"
          variant="simple"
          data-test="error-email"
        >
          {{ errorEmail }}
        </Message>
      </div>

      <Button
        type="submit"
        :label="enviando ? 'Enviando…' : 'Enviar enlace'"
        :loading="enviando"
        class="auth__boton"
        fluid
        data-test="enviar"
      />

      <p class="auth__olvido">
        <RouterLink
          :to="{ name: 'login' }"
          data-test="volver"
        >
          Volver a iniciar sesión
        </RouterLink>
      </p>
    </form>
  </AuthLayout>
</template>