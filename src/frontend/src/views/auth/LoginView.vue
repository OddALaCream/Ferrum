<script setup lang="ts">
import { isAxiosError } from 'axios';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Password from 'primevue/password';
import { computed, nextTick, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ProblemDetails } from '@/api/proyectos';
import LogoSerFamilia from '@/components/auth/LogoSerFamilia.vue';
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
  <div class="login">
    <section
      class="login__marca"
      aria-label="Fundación Ser Familia"
    >
      <div class="login__identidad">
        <LogoSerFamilia
          :estado="estadoLogo"
          class="login__logo"
          data-test="logo"
        />
        <p class="login__nombre">
          Ser Familia
          <span>Fundación</span>
        </p>
      </div>

      <div class="login__mensaje">
        <h1>Cada proyecto, un barrio que mejora.</h1>
        <p>
          Planifica actividades, registra avances con evidencia y sigue el presupuesto
          de cada proyecto social de la fundación.
        </p>
      </div>

      <svg
        class="login__paisaje"
        :class="{ 'login__paisaje--avanza': estadoLogo === 'celebrando' }"
        viewBox="0 0 800 300"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <path
          d="M0 150 C 120 104, 250 134, 370 116 C 500 96, 640 128, 800 92 L800 300 L0 300 Z"
          fill="#2b3a8f"
        />
        <path
          d="M0 206 C 150 168, 280 190, 420 176 C 570 160, 690 190, 800 168 L800 300 L0 300 Z"
          fill="#47238f"
        />
        <g class="login__casas">
          <path d="M556 160 h22 v18 h-22 z M590 154 h26 v22 h-26 z M628 158 h20 v17 h-20 z" />
        </g>
        <g class="login__techos">
          <path d="M552 161 l15 -12 l15 12 z M586 155 l17 -14 l17 14 z M624 159 l14 -11 l14 11 z" />
        </g>
        <path
          d="M0 250 C 210 226, 430 252, 800 232 L800 300 L0 300 Z"
          fill="#341a6f"
        />
        <path
          class="login__camino"
          d="M70 300 C 170 262, 310 268, 420 236 C 500 212, 540 194, 588 178"
        />
        <path
          class="login__camino-linea"
          d="M70 300 C 170 262, 310 268, 420 236 C 500 212, 540 194, 588 178"
        />
      </svg>
    </section>

    <main class="login__panel">
      <form
        class="login__form"
        novalidate
        data-test="form-login"
        @submit.prevent="ingresar"
      >
        <h2>Ingresa a tu cuenta</h2>
        <p class="login__ayuda">
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

        <div class="login__campo">
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

        <div class="login__campo">
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
          class="login__boton"
          fluid
          data-test="ingresar"
        />

        <p class="login__olvido">
          ¿Olvidaste tu contraseña? Pide al administrador que la restablezca.
        </p>
      </form>

      <p class="login__pie">
        © {{ new Date().getFullYear() }} Fundación Ser Familia
      </p>
    </main>
  </div>
</template>

<style scoped>
.login {
  --uva: #2a1458;
  --violeta: #5b2ba8;
  --lavanda: #cdbdf5;
  --azul: #2b3a8f;
  --crema: #fbf6ec;
  --rojo: #b3222b;
  --tinta: #2b2140;

  display: grid;
  min-height: 100%;
  font-family: 'Lexend', ui-sans-serif, system-ui, sans-serif;
  background: var(--crema);
  color: var(--tinta);
}

/* Panel de marca */
.login__marca {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-height: 15rem;
  padding: 1.5rem 1.5rem 7rem;
  overflow: hidden;
  background: var(--uva);
  color: var(--crema);
}
.login__identidad {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}
.login__logo {
  width: 3.75rem;
  flex-shrink: 0;
}
.login__nombre {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.01em;
}
.login__nombre span {
  display: block;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--lavanda);
}
.login__mensaje {
  position: relative;
  z-index: 1;
  max-width: 30rem;
}
.login__mensaje h1 {
  margin: 0;
  font-size: 1.625rem;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
  text-wrap: balance;
}
.login__mensaje p {
  display: none;
  margin: 1rem 0 0;
  max-width: 34ch;
  font-size: 1rem;
  font-weight: 300;
  line-height: 1.6;
  color: var(--lavanda);
}

.login__paisaje {
  position: absolute;
  inset: auto 0 0;
  width: 100%;
  height: 9rem;
}
.login__casas {
  fill: var(--crema);
}
.login__techos {
  fill: var(--rojo);
}
.login__camino {
  fill: none;
  stroke: #e7dcc4;
  stroke-width: 16;
  stroke-linecap: round;
}
.login__camino-linea {
  fill: none;
  stroke: var(--rojo);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 14 16;
}
/* Al entrar, la línea del camino avanza hacia el barrio */
.login__paisaje--avanza .login__camino-linea {
  animation: avanzar 950ms cubic-bezier(0.4, 0, 0.2, 1) both;
}
@keyframes avanzar {
  to {
    stroke-dashoffset: -120;
  }
}

/* Formulario */
.login__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem 1.5rem;
}
.login__form {
  width: 100%;
  max-width: 24rem;
}
.login__form h2 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--uva);
}
.login__ayuda {
  margin: 0.5rem 0 1.75rem;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: #6b6280;
}
.login__campo {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 1.25rem;
}
.login__campo label {
  font-size: 0.875rem;
  font-weight: 500;
}
.login__boton {
  margin-top: 0.5rem;
  padding-block: 0.75rem;
  font-weight: 600;
}
.login__olvido {
  margin: 1.5rem 0 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #6b6280;
}
.login__pie {
  margin: 2.5rem 0 0;
  font-size: 0.8125rem;
  color: #8a829b;
}

@media (min-width: 1024px) {
  .login {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  }
  .login__marca {
    justify-content: space-between;
    padding: 3rem 3.5rem 15rem;
  }
  .login__logo {
    width: 6.5rem;
  }
  .login__nombre {
    font-size: 1.75rem;
  }
  .login__nombre span {
    font-size: 1.125rem;
  }
  .login__mensaje {
    margin-bottom: auto;
    padding-top: 3rem;
  }
  .login__mensaje h1 {
    font-size: 2.75rem;
  }
  .login__mensaje p {
    display: block;
  }
  .login__paisaje {
    height: 19rem;
  }
  .login__pie {
    margin-top: 0;
    position: absolute;
    bottom: 1.5rem;
  }
  .login__panel {
    position: relative;
    padding: 3rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login__paisaje--avanza .login__camino-linea {
    animation: none;
  }
}
</style>