import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProyectoEquipo } from '../proyectos/entities/proyecto-equipo.entity';
import { ProyectoSupervisor } from '../proyectos/entities/proyecto-supervisor.entity';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { ObjetivoEspecifico } from './entities/objetivo-especifico.entity';
import { ObjetivosEspecificosController } from './objetivos-especificos.controller';
import { ObjetivosEspecificosService } from './objetivos-especificos.service';

@Module({
  // ProyectoEquipo y ProyectoSupervisor: los requiere @AlcanceProyecto (técnicos y supervisores).
  imports: [TypeOrmModule.forFeature([ObjetivoEspecifico, Proyecto, ProyectoEquipo, ProyectoSupervisor])],
  controllers: [ObjetivosEspecificosController],
  providers: [ObjetivosEspecificosService],
  exports: [ObjetivosEspecificosService],
})
export class ObjetivosEspecificosModule {}