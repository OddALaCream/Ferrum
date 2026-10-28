import type { ValueTransformer } from 'typeorm';

/** PostgreSQL devuelve NUMERIC como texto; aquí se convierte a número para el marco lógico (metas, pesos y %). */
export const numerico: ValueTransformer = {
  to: (valor?: number | null) => valor,
  from: (valor?: string | null) => (valor === null || valor === undefined ? valor : Number(valor)),
};