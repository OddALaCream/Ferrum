import { createPinia } from 'pinia';
import ConfirmationService from 'primevue/confirmationservice';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';
import './assets/main.css';
import App from './App.vue';
import { router } from './router';
import { localeEs } from './theme/locale-es';
import { SerfamiliaPreset } from './theme/serfamilia';

createApp(App)
  .use(createPinia())
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
