import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getHealth } from '@/api/health';

export const useAppStore = defineStore('app', () => {
  const apiStatus = ref<'desconocido' | 'conectada' | 'sin conexión'>('desconocido');

  async function comprobarApi() {
    try {
      const h = await getHealth();
      apiStatus.value = h.status === 'ok' ? 'conectada' : 'sin conexión';
    } catch {
      apiStatus.value = 'sin conexión';
    }
  }

  return { apiStatus, comprobarApi };
});
