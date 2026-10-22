<script setup lang="ts">
import { onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';

const app = useAppStore();
const auth = useAuthStore();
onMounted(() => app.comprobarApi());
</script>

<template>
  <section class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
    <h2 class="text-base font-semibold text-slate-800">
      Bienvenido, {{ auth.nombre }}
    </h2>
    <p class="mt-1 text-sm text-slate-500">
      Has iniciado sesión con el perfil {{ auth.rolLabel }}.
    </p>
    <p class="mt-4 flex items-center gap-2 text-sm text-slate-500">
      <span
        class="h-2 w-2 rounded-full"
        :class="app.apiStatus === 'conectada' ? 'bg-green-500' : 'bg-slate-300'"
      />
      API: <strong
        class="font-medium text-slate-700"
        data-test="api-status"
      >{{ app.apiStatus }}</strong>
    </p>
  </section>
</template>
