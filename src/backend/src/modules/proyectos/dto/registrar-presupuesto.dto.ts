import { Transform } from 'class-transformer';
import { IsIn, ValidateBy } from 'class-validator';
import { MONEDAS, motivoMontoInvalido, type Moneda } from '../presupuesto';

function EsMontoPresupuesto(): PropertyDecorator {
  return ValidateBy({
    name: 'esMontoPresupuesto',
    validator: {
      validate: (valor: unknown) => motivoMontoInvalido(valor) === null,
      defaultMessage: (args) => motivoMontoInvalido(args?.value) ?? 'Monto inválido.',
    },
  });
}

/** Cuerpo de PATCH /proyectos/:id/presupuesto (RF-02). */
export class RegistrarPresupuestoDto {
  /**
   * Monto con hasta dos decimales. Se recomienda enviarlo como texto ("850000.50")
   * para conservar la precisión exacta; un número JSON también se acepta.
   */
  @Transform(({ value }) => (typeof value === 'number' && Number.isFinite(value) ? String(value) : value))
  @EsMontoPresupuesto()
  monto: string;

  @IsIn(MONEDAS, { message: `La moneda debe ser una de: ${MONEDAS.join(', ')}.` })
  moneda: Moneda;
}
