import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Proyecto } from './entities/proyecto.entity';
import { ProyectoEquipo } from './entities/proyecto-equipo.entity';
import { ProyectoSupervisor } from './entities/proyecto-supervisor.entity';
import { Usuario } from './entities/usuario.entity';
import { EquipoController } from './equipo.controller';
import { EquipoService } from './equipo.service';
import { ProyectosController } from './proyectos.controller';
import { ProyectosService } from './proyectos.service';
import { SupervisoresController } from './supervisores.controller';
import { SupervisoresService } from './supervisores.service';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Proyecto, ProyectoEquipo, ProyectoSupervisor])],
  controllers: [ProyectosController, EquipoController, SupervisoresController],
  providers: [ProyectosService, EquipoService, SupervisoresService],
  exports: [TypeOrmModule, ProyectosService, EquipoService, SupervisoresService],
})
export class ProyectosModule {}