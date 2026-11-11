import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { Proyecto, type EstadoProyecto } from '../proyectos/entities/proyecto.entity';
import { CreateObjetivoEspecificoDto } from './dto/create-objetivo-especifico.dto';
import { ObjetivoEspecifico } from './entities/objetivo-especifico.entity';
import { ObjetivosEspecificosService } from './objetivos-especificos.service';

const PROYECTO_ID = '33333333-3333-4333-8333-333333333333';

function proyecto(estado: EstadoProyecto = 'EN_EJECUCION'): Proyecto {
  return Object.assign(new Proyecto(), { id: PROYECTO_ID, estado, codigo: 'PRY-DEMO-001' });
}

describe('ObjetivosEspecificosService', () => {
  let service: ObjetivosEspecificosService;
  let objetivos: { create: jest.Mock; save: jest.Mock; find: jest.Mock };
  let proyectos: { findOne: jest.Mock };

  const dto: CreateObjetivoEspecificoDto = {
    codigo: 'OE.1',
    descripcion: 'Desarrollar habilidades parentales en familias en situación de riesgo',
  };

  beforeEach(async () => {
    objetivos = {
      create: jest.fn((v) => v),
      save: jest.fn(),
      find: jest.fn(),
    };
    proyectos = { findOne: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ObjetivosEspecificosService,
        { provide: getRepositoryToken(ObjetivoEspecifico), useValue: objetivos },
        { provide: getRepositoryToken(Proyecto), useValue: proyectos },
      ],
    }).compile();

    service = module.get(ObjetivosEspecificosService);
  });

  it('crea el objetivo específico vinculado al proyecto', async () => {
    proyectos.findOne.mockResolvedValue(proyecto());
    const guardado = { id: 'oe-1', proyectoId: PROYECTO_ID, ...dto };
    objetivos.save.mockResolvedValue(guardado);

    const resultado = await service.crearObjetivo(PROYECTO_ID, dto);

    expect(objetivos.create).toHaveBeenCalledWith({
      proyectoId: PROYECTO_ID,
      codigo: 'OE.1',
      descripcion: dto.descripcion,
    });
    expect(objetivos.save).toHaveBeenCalled();
    expect(resultado).toEqual(guardado);
  });

  it('lanza ConflictException (409) si el código ya existe en ese proyecto', async () => {
    proyectos.findOne.mockResolvedValue(proyecto());
    const driverError = Object.assign(new Error('duplicate'), {
      code: '23505',
      constraint: 'objetivos_especificos_proyecto_id_codigo_key',
    });
    objetivos.save.mockRejectedValue(new QueryFailedError('', [], driverError));

    await expect(service.crearObjetivo(PROYECTO_ID, dto)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.crearObjetivo(PROYECTO_ID, dto)).rejects.toThrow(
      /Ya existe un objetivo específico con ese código en el proyecto/,
    );
  });

  it('lista los objetivos del proyecto ordenados por código', async () => {
    proyectos.findOne.mockResolvedValue(proyecto());
    const lista = [{ id: 'oe-1', codigo: 'OE.1' }];
    objetivos.find.mockResolvedValue(lista);

    const resultado = await service.obtenerPorProyecto(PROYECTO_ID);

    expect(objetivos.find).toHaveBeenCalledWith({
      where: { proyectoId: PROYECTO_ID },
      order: { codigo: 'ASC' },
    });
    expect(resultado).toEqual(lista);
  });

  it('responde 404 si el proyecto no existe', async () => {
    proyectos.findOne.mockResolvedValue(null);

    await expect(service.crearObjetivo(PROYECTO_ID, dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(objetivos.save).not.toHaveBeenCalled();
  });
});
