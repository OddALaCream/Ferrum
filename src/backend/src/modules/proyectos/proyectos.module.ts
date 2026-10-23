import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Proyecto } from './entities/proyecto.entity';
import { ProyectosController } from './proyectos.controller';
import { ProyectosService } from './proyectos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Proyecto])],
  controllers: [ProyectosController],
  providers: [ProyectosService],
})
export class ProyectosModule {}
