import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

// Morado institucional (#5B2BA8 = tono 700). El rojo del logo (#B3222B) queda como acento.
export const SerfamiliaPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f6f2fd',
      100: '#ece4fb',
      200: '#dacbf7',
      300: '#bfa6f0',
      400: '#9f7ae6',
      500: '#8152d9',
      600: '#6c3cc4',
      700: '#5b2ba8',
      800: '#4b2489',
      900: '#3e1f6e',
      950: '#2a1458',
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