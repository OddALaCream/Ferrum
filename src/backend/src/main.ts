import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.getOrThrow<string>('CORS_ORIGIN').split(','),
    credentials: true, // refresh token en cookie HttpOnly (ADR-004)
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();

  // Documentación OpenAPI en /api/docs. Solo fuera de producción: no se expone la API en el despliegue real.
  if (config.get<string>('NODE_ENV') !== 'production') {
    const documento = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('SGP Serfamilia API')
        .setDescription(
          'Sistema de Gestión de Proyectos de la Fundación Ser Familia. ' +
            'Inicia sesión con POST /auth/login, copia el accessToken y pégalo en "Authorize".',
        )
        .setVersion('1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
        .build(),
    );
    // Toda la API exige sesión salvo las rutas públicas (login, refresh, logout, recuperación, health)
    documento.security = [{ bearer: [] }];
    const rutasPublicas = [
      'POST /api/auth/login',
      'POST /api/auth/refresh',
      'POST /api/auth/logout',
      'POST /api/auth/olvide-mi-contrasena',
      'POST /api/auth/restablecer-password',
      'GET /api/health',
      'GET /api/health/ready',
    ];
    for (const ruta of rutasPublicas) {
      const [metodo, path] = ruta.split(' ');
      const operacion = documento.paths[path]?.[metodo.toLowerCase() as 'get' | 'post'];
      if (operacion) operacion.security = []; // sin candado en Swagger: no piden sesión
    }
    SwaggerModule.setup('api/docs', app, documento, {
      jsonDocumentUrl: 'api/docs-json',
      swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
    });
  }

  const port = config.get<number>('API_PORT', 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`API escuchando en http://localhost:${port}/api (health: /api/health, docs: /api/docs)`);
}

bootstrap();