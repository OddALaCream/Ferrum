<script setup lang="ts">
import LogoSerFamilia from '@/components/auth/LogoSerFamilia.vue';

/**
 * Marco común de las pantallas públicas (iniciar sesión, olvidé mi contraseña, nueva contraseña):
 * panel morado con el logo animado a la izquierda y el contenido (slot) sobre fondo crema a la derecha.
 * Sus estilos no son "scoped" porque los formularios que van en el slot usan las clases auth__*.
 */
withDefaults(defineProps<{ estadoLogo?: 'reposo' | 'celebrando' | 'negando' }>(), { estadoLogo: 'reposo' });
</script>

<template>
  <div class="auth">
    <section
      class="auth__marca"
      aria-label="Fundación Ser Familia"
    >
      <div class="auth__identidad">
        <LogoSerFamilia
          :estado="estadoLogo"
          class="auth__logo"
          data-test="logo"
        />
        <p class="auth__nombre">
          Ser Familia
          <span>Fundación</span>
        </p>
      </div>

      <div class="auth__mensaje">
        <h1>Cada proyecto, un barrio que mejora.</h1>
        <p>
          Planifica actividades, registra avances con evidencia y sigue el presupuesto
          de cada proyecto social de la fundación.
        </p>
      </div>

      <svg
        class="auth__paisaje"
        :class="{ 'auth__paisaje--avanza': estadoLogo === 'celebrando' }"
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
        <g class="auth__casas">
          <path d="M556 160 h22 v18 h-22 z M590 154 h26 v22 h-26 z M628 158 h20 v17 h-20 z" />
        </g>
        <g class="auth__techos">
          <path d="M552 161 l15 -12 l15 12 z M586 155 l17 -14 l17 14 z M624 159 l14 -11 l14 11 z" />
        </g>
        <path
          d="M0 250 C 210 226, 430 252, 800 232 L800 300 L0 300 Z"
          fill="#341a6f"
        />
        <path
          class="auth__camino"
          d="M70 300 C 170 262, 310 268, 420 236 C 500 212, 540 194, 588 178"
        />
        <path
          class="auth__camino-linea"
          d="M70 300 C 170 262, 310 268, 420 236 C 500 212, 540 194, 588 178"
        />
      </svg>
    </section>

    <main class="auth__panel">
      <slot />
      <p class="auth__pie">
        © {{ new Date().getFullYear() }} Fundación Ser Familia
      </p>
    </main>
  </div>
</template>

<style>
.auth {
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
.auth__marca {
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
.auth__identidad {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}
.auth__logo {
  width: 3.75rem;
  flex-shrink: 0;
}
.auth__nombre {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.01em;
}
.auth__nombre span {
  display: block;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--lavanda);
}
.auth__mensaje {
  position: relative;
  z-index: 1;
  max-width: 30rem;
}
.auth__mensaje h1 {
  margin: 0;
  font-size: 1.625rem;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
  text-wrap: balance;
}
.auth__mensaje p {
  display: none;
  margin: 1rem 0 0;
  max-width: 34ch;
  font-size: 1rem;
  font-weight: 300;
  line-height: 1.6;
  color: var(--lavanda);
}

.auth__paisaje {
  position: absolute;
  inset: auto 0 0;
  width: 100%;
  height: 9rem;
}
.auth__casas {
  fill: var(--crema);
}
.auth__techos {
  fill: var(--rojo);
}
.auth__camino {
  fill: none;
  stroke: #e7dcc4;
  stroke-width: 16;
  stroke-linecap: round;
}
.auth__camino-linea {
  fill: none;
  stroke: var(--rojo);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 14 16;
}
/* Al entrar, la línea del camino avanza hacia el barrio */
.auth__paisaje--avanza .auth__camino-linea {
  animation: auth-avanzar 950ms cubic-bezier(0.4, 0, 0.2, 1) both;
}
@keyframes auth-avanzar {
  to {
    stroke-dashoffset: -120;
  }
}

/* Formulario */
.auth__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem 1.5rem;
}
.auth__form {
  width: 100%;
  max-width: 24rem;
}
.auth__form h2 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--uva);
}
.auth__ayuda {
  margin: 0.5rem 0 1.75rem;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: #6b6280;
}
.auth__campo {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 1.25rem;
}
.auth__campo label {
  font-size: 0.875rem;
  font-weight: 500;
}
.auth__boton {
  margin-top: 0.5rem;
  padding-block: 0.75rem;
  font-weight: 600;
}
.auth__enlace-boton {
  display: block;
  margin-top: 1.25rem;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  background: var(--violeta);
  color: #fff;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
}
.auth__enlace-boton:hover {
  background: var(--uva);
}
.auth__olvido a {
  color: var(--violeta);
  font-weight: 500;
}
.auth__olvido {
  margin: 1.5rem 0 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #6b6280;
}
.auth__pie {
  margin: 2.5rem 0 0;
  font-size: 0.8125rem;
  color: #8a829b;
}

@media (min-width: 1024px) {
  .auth {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  }
  .auth__marca {
    justify-content: space-between;
    padding: 3rem 3.5rem 15rem;
  }
  .auth__logo {
    width: 6.5rem;
  }
  .auth__nombre {
    font-size: 1.75rem;
  }
  .auth__nombre span {
    font-size: 1.125rem;
  }
  .auth__mensaje {
    margin-bottom: auto;
    padding-top: 3rem;
  }
  .auth__mensaje h1 {
    font-size: 2.75rem;
  }
  .auth__mensaje p {
    display: block;
  }
  .auth__paisaje {
    height: 19rem;
  }
  .auth__pie {
    margin-top: 0;
    position: absolute;
    bottom: 1.5rem;
  }
  .auth__panel {
    position: relative;
    padding: 3rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth__paisaje--avanza .auth__camino-linea {
    animation: none;
  }
}
</style>