<script setup lang="ts">
/**
 * Logo de la Fundación Ser Familia dibujado en SVG para poder animar cada figura.
 * - reposo: la figura que salta flota suavemente (solo si `animado`).
 * - celebrando: las tres figuras saltan (login correcto).
 * - negando: la gota se sacude (login rechazado).
 * Con `prefers-reduced-motion` no se anima nada.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    estado?: 'reposo' | 'celebrando' | 'negando';
    animado?: boolean;
  }>(),
  { estado: 'reposo', animado: true },
);

/** La entrada (la figura cae y rebota) se ve una sola vez al montar. */
const entrando = ref(props.animado);
let temporizador: ReturnType<typeof setTimeout> | undefined;
onMounted(() => {
  temporizador = setTimeout(() => (entrando.value = false), 1100);
});
onBeforeUnmount(() => clearTimeout(temporizador));
</script>

<template>
  <svg
    viewBox="0 0 200 222"
    role="img"
    aria-label="Fundación Ser Familia"
    :class="['logo', animado && `logo--${estado}`, animado && entrando && 'logo--entrada']"
  >
    <g class="logo__todo">
      <path
        class="logo__gota"
        d="M90 20 C 82 64, 42 100, 42 156 A 58 58 0 0 0 158 156 C 158 118, 122 92, 106 60 Z"
      />
      <g class="logo__figura logo__adulto">
        <circle
          cx="76"
          cy="108"
          r="10"
        />
        <path
          d="M82 124 C 70 148, 80 182, 110 196"
          stroke-width="11"
        />
        <path
          class="logo__brazo"
          d="M86 130 C 98 122, 110 110, 120 96"
          stroke-width="9"
        />
      </g>
      <g class="logo__figura logo__nino">
        <circle
          cx="128"
          cy="146"
          r="8"
        />
        <path
          d="M122 160 C 114 172, 120 186, 140 190"
          stroke-width="8.5"
        />
        <path
          d="M125 163 C 134 161, 141 155, 146 148"
          stroke-width="7"
        />
      </g>
      <g class="logo__saltarin">
        <circle
          cx="152"
          cy="28"
          r="11"
        />
        <path
          d="M146 46 C 142 64, 128 76, 110 86"
          stroke-width="11"
        />
        <path
          d="M146 50 C 136 44, 131 34, 130 22"
          stroke-width="8"
        />
        <path
          d="M149 50 C 160 50, 168 44, 174 34"
          stroke-width="8"
        />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.logo {
  --logo-claro: #fffdf8;
  --logo-rojo: #b3222b;
  overflow: visible;
}

.logo__gota {
  fill: var(--logo-claro);
}

.logo__figura circle {
  fill: var(--logo-rojo);
}
.logo__figura path {
  fill: none;
  stroke: var(--logo-rojo);
  stroke-linecap: round;
}

.logo__saltarin circle {
  fill: var(--logo-claro);
}
.logo__saltarin path {
  fill: none;
  stroke: var(--logo-claro);
  stroke-linecap: round;
}

.logo__todo,
.logo__gota,
.logo__adulto,
.logo__nino,
.logo__saltarin,
.logo__brazo {
  transform-box: fill-box;
}
.logo__gota,
.logo__adulto,
.logo__nino,
.logo__saltarin {
  transform-origin: 50% 100%;
}
.logo__brazo {
  transform-origin: 0% 100%;
}

/* En reposo la figura que salta flota y el adulto saluda de vez en cuando */
.logo--reposo .logo__saltarin {
  animation: flotar 3.4s ease-in-out infinite;
}

/* Entrada: la figura que salta cae y rebota; las otras dos aparecen */
.logo--entrada.logo--reposo .logo__saltarin {
  animation:
    llegar 900ms cubic-bezier(0.34, 1.4, 0.64, 1) both,
    flotar 3.4s ease-in-out 900ms infinite;
}
.logo--entrada.logo--reposo .logo__adulto {
  animation: aparecer 500ms ease-out 250ms both;
}
.logo--entrada.logo--reposo .logo__nino {
  animation: aparecer 500ms ease-out 400ms both;
}
.logo--reposo .logo__brazo {
  animation: saludar 3.4s ease-in-out 1.2s infinite;
}

/* Login correcto: saltan las tres figuras, la gota amortigua el aterrizaje */
.logo--celebrando .logo__saltarin {
  animation: saltar-alto 950ms cubic-bezier(0.3, 0.7, 0.4, 1) both;
}
.logo--celebrando .logo__adulto {
  animation: saltar-bajo 950ms cubic-bezier(0.3, 0.7, 0.4, 1) 60ms both;
}
.logo--celebrando .logo__nino {
  animation: saltar-medio 950ms cubic-bezier(0.3, 0.7, 0.4, 1) 140ms both;
}
.logo--celebrando .logo__gota {
  animation: amortiguar 950ms ease-out both;
}

/* Login rechazado: la gota dice que no */
.logo--negando .logo__todo {
  transform-origin: 50% 70%;
  animation: negar 480ms ease-in-out both;
}

@keyframes llegar {
  0% {
    transform: translateY(-46px) rotate(-12deg);
    opacity: 0;
  }
  60% {
    transform: translateY(4px) rotate(2deg);
    opacity: 1;
  }
  100% {
    transform: translateY(0) rotate(0);
    opacity: 1;
  }
}
@keyframes aparecer {
  from {
    transform: scale(0.6);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
@keyframes flotar {
  0%,
  100% {
    transform: translateY(0) rotate(0);
  }
  50% {
    transform: translateY(-6px) rotate(-3deg);
  }
}
@keyframes saludar {
  0%,
  70%,
  100% {
    transform: rotate(0);
  }
  78% {
    transform: rotate(-9deg);
  }
  86% {
    transform: rotate(4deg);
  }
  94% {
    transform: rotate(-6deg);
  }
}
@keyframes saltar-alto {
  0% {
    transform: translateY(0) rotate(0);
  }
  32% {
    transform: translateY(-34px) rotate(-14deg);
  }
  58% {
    transform: translateY(0) rotate(0);
  }
  74% {
    transform: translateY(-12px) rotate(6deg);
  }
  100% {
    transform: translateY(0) rotate(0);
  }
}
@keyframes saltar-medio {
  0%,
  100% {
    transform: translateY(0);
  }
  36% {
    transform: translateY(-16px) rotate(6deg);
  }
  62% {
    transform: translateY(0);
  }
  78% {
    transform: translateY(-6px);
  }
}
@keyframes saltar-bajo {
  0%,
  100% {
    transform: translateY(0);
  }
  36% {
    transform: translateY(-10px) rotate(-4deg);
  }
  62% {
    transform: translateY(0);
  }
}
@keyframes amortiguar {
  0%,
  45%,
  100% {
    transform: scale(1, 1);
  }
  60% {
    transform: scale(1.04, 0.95);
  }
  75% {
    transform: scale(0.99, 1.01);
  }
}
@keyframes negar {
  0%,
  100% {
    transform: translateX(0) rotate(0);
  }
  20% {
    transform: translateX(-8px) rotate(-4deg);
  }
  45% {
    transform: translateX(7px) rotate(3deg);
  }
  70% {
    transform: translateX(-4px) rotate(-2deg);
  }
  88% {
    transform: translateX(2px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .logo *,
  .logo .logo__todo {
    animation: none !important;
  }
}
</style>