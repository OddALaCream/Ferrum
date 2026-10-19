import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

const toBool = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? ['true', '1', 'yes'].includes(value.toLowerCase()) : value;

/** Variables de entorno requeridas por la API. Se validan al arrancar (falla rápido). */
export class EnvironmentVariables {
  @IsEnum(NodeEnv) NODE_ENV: NodeEnv = NodeEnv.Development;
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(65535) API_PORT: number = 3000;
  @IsString() CORS_ORIGIN: string = 'http://localhost:5173';
  @IsString() APP_BASE_URL: string = 'http://localhost:5173';

  // PostgreSQL
  @IsString() @IsNotEmpty() DB_HOST: string = 'localhost';
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(65535) DB_PORT: number = 5432;
  @IsString() @IsNotEmpty() DB_USER: string;
  @IsString() DB_PASSWORD: string;
  @IsString() @IsNotEmpty() DB_NAME: string;
  @Transform(toBool) @IsBoolean() DB_SSL: boolean = false;

  // JWT (ADR-004): access 15 min, refresh 7 días
  @IsString() @MinLength(32) JWT_ACCESS_SECRET: string;
  @IsString() @MinLength(32) JWT_REFRESH_SECRET: string;
  @IsString() JWT_ACCESS_TTL: string = '15m';
  @IsString() JWT_REFRESH_TTL: string = '7d';

  // Almacenamiento S3-compatible (ADR-003)
  @IsString() @IsNotEmpty() S3_ENDPOINT: string;
  @IsString() S3_REGION: string = 'us-east-1';
  @IsString() @IsNotEmpty() S3_ACCESS_KEY: string;
  @IsString() @IsNotEmpty() S3_SECRET_KEY: string;
  @IsString() @IsNotEmpty() S3_BUCKET: string;
  @Transform(toBool) @IsBoolean() S3_FORCE_PATH_STYLE: boolean = true;

  // Correo SMTP (RF-33, RF-35)
  @IsString() @IsNotEmpty() SMTP_HOST: string;
  @Transform(({ value }) => Number(value)) @IsInt() SMTP_PORT: number = 1025;
  @Transform(toBool) @IsBoolean() SMTP_SECURE: boolean = false;
  @IsOptional() @IsString() SMTP_USER?: string;
  @IsOptional() @IsString() SMTP_PASS?: string;
  @IsString() @IsNotEmpty() MAIL_FROM: string = 'SGP Serfamilia <no-reply@serfamilia.local>';
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const parsed = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });
  const errors = validateSync(parsed, { skipMissingProperties: false });
  if (errors.length > 0) {
    const detalle = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas o faltantes:\n${detalle}\n(Revise el archivo .env; use .env.example como base.)`);
  }
  return parsed;
}
