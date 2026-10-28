import { Matches } from 'class-validator';
import { applyDecorators } from '@nestjs/common';

export const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha como texto YYYY-MM-DD (así viajan las fechas de tipo `date` de PostgreSQL). */
export const FechaIso = (campo: string) =>
  applyDecorators(Matches(FECHA_ISO, { message: `${campo} debe tener el formato YYYY-MM-DD` }));