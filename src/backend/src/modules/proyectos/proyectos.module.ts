import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Proyecto } from './entities/proyecto.entity';
import { ProyectoEquipo } from './entities/proyecto-equipo.entity';
import { Usuario } from './entities/usuario.entity';
import { EquipoController } from './equipo.controller';
import { EquipoService } from './equipo.service';
import { ProyectosController } from './proyectos.controller';
import { ProyectosService } from './proyectos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Proyecto, ProyectoEquipo])],
  controllers: [ProyectosController, EquipoController],
  providers: [ProyectosService, EquipoService],
  exports: [TypeOrmModule, ProyectosService, EquipoService],
})
export class ProyectosModule {}