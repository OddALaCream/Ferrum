import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { ObjetivoEspecifico } from './entities/objetivo-especifico.entity';
import { ObjetivosEspecificosController } from './objetivos-especificos.controller';
import { ObjetivosEspecificosService } from './objetivos-especificos.service';

@Module({
  imports: [TypeOrmModule.forFeature([ObjetivoEspecifico, Proyecto])],
  controllers: [ObjetivosEspecificosController],
  providers: [ObjetivosEspecificosService],
  exports: [ObjetivosEspecificosService],
})
export class ObjetivosEspecificosModule {}
