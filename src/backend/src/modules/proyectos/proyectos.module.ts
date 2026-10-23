import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Financiador } from './entities/financiador.entity';
import { Proyecto } from './entities/proyecto.entity';
import { ProyectoEquipo } from './entities/proyecto-equipo.entity';
import { Usuario } from './entities/usuario.entity';
import { EquipoController } from './equipo.controller';
import { EquipoService } from './equipo.service';
import { FinanciadoresController } from './financiadores.controller';
import { FinanciadoresService } from './financiadores.service';
import { ProyectosController } from './proyectos.controller';
import { ProyectosService } from './proyectos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Financiador, Usuario, Proyecto, ProyectoEquipo])],
  controllers: [FinanciadoresController, ProyectosController, EquipoController],
  providers: [FinanciadoresService, ProyectosService, EquipoService],
  exports: [TypeOrmModule, ProyectosService, FinanciadoresService, EquipoService],
})
export class ProyectosModule {}
