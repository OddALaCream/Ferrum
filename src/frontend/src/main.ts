import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';
import './assets/main.css';
import App from './App.vue';
import { router } from './router';
import { SerfamiliaPreset } from './theme/serfamilia';

createApp(App)
  .use(createPinia())
  .use(router)
  .use(PrimeVue, {
    theme: {
      preset: SerfamiliaPreset,
      options: {
        darkModeSelector: '.app-dark',
        // Las utilidades de Tailwind quedan fuera de esta capa y pueden sobrescribir estilos de PrimeVue
        cssLayer: { name: 'primevue', order: 'theme, base, primevue' },
      },
    },
  })
  .directive('tooltip', Tooltip)
  .mount('#app');
