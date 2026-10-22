import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

// Rojo vino institucional (#9B2226 = tono 700). Reemplaza el esmeralda por defecto de Aura.
export const SerfamiliaPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fdf2f2',
      100: '#fce4e4',
      200: '#f9cdce',
      300: '#f4a9ab',
      400: '#eb777a',
      500: '#df4c50',
      600: '#bd2d31',
      700: '#9b2226',
      800: '#811f23',
      900: '#6c1e21',
      950: '#3b0b0d',
    },
    colorScheme: {
      light: {
        primary: {
          color: '{primary.700}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.800}',
          activeColor: '{primary.900}',
        },
        highlight: {
          background: '{primary.50}',
          focusBackground: '{primary.100}',
          color: '{primary.700}',
          focusColor: '{primary.800}',
        },
      },
    },
  },
});
