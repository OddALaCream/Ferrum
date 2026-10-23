import { createPinia } from 'pinia';
import ConfirmationService from 'primevue/confirmationservice';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';
import './assets/main.css';
import { conectarSesion } from './api/http';
import App from './App.vue';
import { router } from './router';
import { useAuthStore } from './stores/auth';
import { localeEs } from './theme/locale-es';
import { SerfamiliaPreset } from './theme/serfamilia';

const pinia = createPinia();
const auth = useAuthStore(pinia);

conectarSesion({
  token: () => auth.accessToken,
  renovar: () => auth.renovar(),
  alExpirar: () => {
    auth.limpiar();
    const actual = router.currentRoute.value;
    if (actual.name !== 'login') router.replace({ name: 'login', query: { expirada: '1', redirect: actual.fullPath } });
  },
});

createApp(App)
  .use(pinia)
  .use(router)
  .use(PrimeVue, {
    locale: localeEs,
    theme: {
      preset: SerfamiliaPreset,
      options: {
        darkModeSelector: '.app-dark',
        // Las utilidades de Tailwind quedan fuera de esta capa y pueden sobrescribir estilos de PrimeVue
        cssLayer: { name: 'primevue', order: 'theme, base, primevue' },
      },
    },
  })
  .use(ToastService)
  .use(ConfirmationService)
  .directive('tooltip', Tooltip)
  .mount('#app');