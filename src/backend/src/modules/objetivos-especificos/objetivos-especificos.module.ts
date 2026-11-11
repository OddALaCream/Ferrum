import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProyectoEquipo } from '../proyectos/entities/proyecto-equipo.entity';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { ObjetivoEspecifico } from './entities/objetivo-especifico.entity';
import { ObjetivosEspecificosController } from './objetivos-especificos.controller';
import { ObjetivosEspecificosService } from './objetivos-especificos.service';

@Module({
  // ProyectoEquipo: requerido por @AlcanceProyecto en el listado (técnicos).
  imports: [TypeOrmModule.forFeature([ObjetivoEspecifico, Proyecto, ProyectoEquipo])],
  controllers: [ObjetivosEspecificosController],
  providers: [ObjetivosEspecificosService],
  exports: [ObjetivosEspecificosService],
})
export class ObjetivosEspecificosModule {}
