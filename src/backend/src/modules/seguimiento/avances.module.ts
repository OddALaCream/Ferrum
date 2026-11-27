import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Actividad } from '../marco-logico/entities/actividad.entity';
import { Iov } from '../marco-logico/entities/iov.entity';
import { ProyectoEquipo } from '../proyectos/entities/proyecto-equipo.entity';
import { ProyectoSupervisor } from '../proyectos/entities/proyecto-supervisor.entity';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { AvancesController } from './avances.controller';
import { AvancesService } from './avances.service';
import { CumplimientoService } from './cumplimiento.service';
import { Avance } from './entities/avance.entity';
import { Evidencia } from './entities/evidencia.entity';
import { RevisionController } from './revision.controller';

/** Seguimiento: avances de indicadores y actividades con sus evidencias (SGP-82), su revisión (SGP-94) y el % de cumplimiento (SGP-95). El almacenamiento es global. */
@Module({
  // ProyectoEquipo y ProyectoSupervisor: los requiere @AlcanceProyecto
  imports: [TypeOrmModule.forFeature([Avance, Evidencia, Proyecto, Iov, Actividad, ProyectoEquipo, ProyectoSupervisor]), AuditoriaModule],
  controllers: [AvancesController, RevisionController],
  providers: [AvancesService, CumplimientoService],
})
export class AvancesModule {}