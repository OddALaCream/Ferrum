<script setup lang="ts">
import { isAxiosError } from 'axios';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Password from 'primevue/password';
import { computed, nextTick, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ProblemDetails } from '@/api/proyectos';
import AuthLayout from '@/components/auth/AuthLayout.vue';
import { useAuthStore } from '@/stores/auth';

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Lo que dura el salto de las figuras antes de entrar al sistema. */
const DURACION_CELEBRACION = 950;

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const form = reactive({ email: '', password: '' });
const enviado = ref(false);
const ingresando = ref(false);
const estadoLogo = ref<'reposo' | 'celebrando' | 'negando'>('reposo');
const errorServidor = ref<{ severidad: 'error' | 'warn'; texto: string } | null>(null);

const aviso = computed(() => {
  if (route.query.expirada) return 'Tu sesión venció. Ingresa de nuevo para continuar.';
  if (route.query.salida) return 'Cerraste sesión. Hasta pronto.';
  if (route.query.restablecida) return 'Tu contraseña se actualizó. Ingresa con la nueva.';
  return null;
});

const errores = computed(() => {
  const e: { email?: string; password?: string } = {};
  const email = form.email.trim();
  if (!email) e.email = 'Ingresa tu correo electrónico.';
  else if (!CORREO_VALIDO.test(email)) e.email = 'Revisa el correo: debe tener la forma nombre@dominio.org.';
  if (!form.password) e.password = 'Ingresa tu contraseña.';
  return e;
});

const visible = (campo: 'email' | 'password') => (enviado.value ? errores.value[campo] : undefined);

const reducirMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ingresar() {
  enviado.value = true;
  errorServidor.value = null;
  if (Object.keys(errores.value).length > 0) return;

  ingresando.value = true;
  try {
    await auth.iniciarSesion(form.email, form.password);
    estadoLogo.value = 'celebrando';
    if (!reducirMovimiento()) await esperar(DURACION_CELEBRACION);
    const destino = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard';
    await router.replace(destino.startsWith('/') && !destino.startsWith('//') ? destino : '/dashboard');
  } catch (e) {
    ingresando.value = false;
    form.password = '';
    // El error del servidor ya explica qué pasó; no marcar la contraseña vacía como error del campo
    enviado.value = false;
    errorServidor.value = traducirError(e);
    estadoLogo.value = 'negando';
    setTimeout(() => (estadoLogo.value = 'reposo'), 500);
    await nextTick();
    document.getElementById('password')?.focus();
  }
}

function traducirError(e: unknown): { severidad: 'error' | 'warn'; texto: string } {
  if (!isAxiosError<ProblemDetails>(e) || !e.response) {
    return { severidad: 'error', texto: 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.' };
  }
  const { status, data } = e.response;
  const detalle = Array.isArray(data?.detail) ? data.detail.join(' ') : data?.detail;
  switch (status) {
    case 401:
      return { severidad: 'error', texto: 'Correo o contraseña incorrectos. Revisa los datos e inténtalo de nuevo.' };
    case 423:
      return { severidad: 'warn', texto: detalle ?? 'Tu cuenta está bloqueada temporalmente.' };
    case 403:
      return { severidad: 'warn', texto: detalle ?? 'Tu cuenta no tiene acceso al sistema.' };
    case 429:
      return { severidad: 'warn', texto: 'Demasiados intentos desde este equipo. Espera un minuto antes de volver a intentar.' };
    default:
      return { severidad: 'error', texto: detalle ?? 'No se pudo iniciar sesión. Inténtalo de nuevo en unos minutos.' };
  }
}
</script>

<template>
  <AuthLayout :estado-logo="estadoLogo">
    <form
      class="auth__form"
      novalidate
      data-test="form-login"
      @submit.prevent="ingresar"
    >
      <h2>Ingresa a tu cuenta</h2>
      <p class="auth__ayuda">
        Usa el correo y la contraseña que te dio el administrador.
      </p>

      <Message
        v-if="aviso && !errorServidor"
        severity="info"
        size="small"
        class="mb-5"
        data-test="aviso"
      >
        {{ aviso }}
      </Message>

      <div
        aria-live="assertive"
        class="contents"
      >
        <Message
          v-if="errorServidor"
          :severity="errorServidor.severidad"
          size="small"
          class="mb-5"
          data-test="error-login"
        >
          {{ errorServidor.texto }}
        </Message>
      </div>

      <div class="auth__campo">
        <label for="email">Correo electrónico</label>
        <InputText
          id="email"
          v-model="form.email"
          type="email"
          autocomplete="username"
          inputmode="email"
          placeholder="nombre@serfamilia.org"
          :invalid="!!visible('email')"
          :disabled="ingresando"
          fluid
          data-test="email"
        />
        <Message
          v-if="visible('email')"
          severity="error"
          size="small"
          variant="simple"
          data-test="error-email"
        >
          {{ visible('email') }}
        </Message>
      </div>

      <div class="auth__campo">
        <label for="password">Contraseña</label>
        <Password
          v-model="form.password"
          input-id="password"
          autocomplete="current-password"
          :feedback="false"
          toggle-mask
          :invalid="!!visible('password')"
          :disabled="ingresando"
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

      <Button
        type="submit"
        :label="ingresando ? 'Ingresando…' : 'Ingresar'"
        :loading="ingresando"
        class="auth__boton"
        fluid
        data-test="ingresar"
      />

      <p class="auth__olvido">
        <RouterLink
          :to="{ name: 'olvide-contrasena' }"
          data-test="olvide"
        >
          ¿Olvidaste tu contraseña?
        </RouterLink>
      </p>
    </form>
  </AuthLayout>
</template>