<script setup lang="ts">
import { onMounted } from 'vue';
import { useAppStore } from '@/stores/app';

const app = useAppStore();
onMounted(() => app.comprobarApi());
</script>

<template>
  <main class="home">
    <h1>Sistema de Gestión de Proyectos Serfamilia</h1>
    <p>Entorno de desarrollo listo.</p>
    <p>
      API: <strong data-test="api-status">{{ app.apiStatus }}</strong>
    </p>
  </main>
</template>

<style scoped>
.home {
  max-width: 40rem;
  margin: 4rem auto;
  padding: 0 1rem;
  font-family: system-ui, sans-serif;
}
</style>
