import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { ProyectoEquipo } from '../proyectos/entities/proyecto-equipo.entity';
import { ActividadesController } from './controllers/actividades.controller';
import { MarcoLogicoController } from './controllers/marco-logico.controller';
import { TareasController } from './controllers/tareas.controller';
import { Actividad } from './entities/actividad.entity';
import { ActividadSesion } from './entities/actividad-sesion.entity';
import { Iov } from './entities/iov.entity';
import { Resultado } from './entities/resultado.entity';
import { Tarea } from './entities/tarea.entity';
import { ActividadesService } from './services/actividades.service';
import { MarcoLogicoService } from './services/marco-logico.service';
import { TareasService } from './services/tareas.service';

@Module({
  imports: [TypeOrmModule.forFeature([Proyecto, ProyectoEquipo, Resultado, Iov, Actividad, ActividadSesion, Tarea])],
  controllers: [MarcoLogicoController, ActividadesController, TareasController],
  providers: [MarcoLogicoService, ActividadesService, TareasService],
})
export class MarcoLogicoModule {}