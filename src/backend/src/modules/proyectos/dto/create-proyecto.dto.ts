import {
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

@ValidatorConstraint({ name: 'fechaFinNoAnterior', async: false })
class FechaFinNoAnteriorConstraint implements ValidatorConstraintInterface {
  validate(fechaFin: string, args: ValidationArguments) {
    const { fechaInicio } = args.object as CreateProyectoDto;
    if (!fechaInicio || !fechaFin) return true;
    return fechaFin >= fechaInicio;
  }

  defaultMessage() {
    return 'fechaFin no puede ser anterior a fechaInicio';
  }
}

export class CreateProyectoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  codigo!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  nombre!: string;

  @IsUUID()
  financiadorId!: string;

  @Matches(FECHA_ISO, { message: 'fechaInicio debe tener el formato YYYY-MM-DD' })
  fechaInicio!: string;

  @Matches(FECHA_ISO, { message: 'fechaFin debe tener el formato YYYY-MM-DD' })
  @Validate(FechaFinNoAnteriorConstraint)
  fechaFin!: string;
}
