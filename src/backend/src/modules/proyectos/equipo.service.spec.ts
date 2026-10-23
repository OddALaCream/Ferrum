import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DIRECTOR_SEED_ID } from './constants';
import { ProyectoEquipo } from './entities/proyecto-equipo.entity';
import { Proyecto } from './entities/proyecto.entity';
import { RolUsuario, Usuario } from './entities/usuario.entity';
import { EquipoService } from './equipo.service';

describe('EquipoService', () => {
  const PROYECTO = '33333333-3333-4333-8333-333333333333';
  const TECNICO = '22222222-2222-4222-8222-222222222222';

  const equipo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(),
  };
  const proyectos = { exists: jest.fn() };
  const usuarios = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  let service: EquipoService;

  beforeEach(async () => {
    jest.clearAllMocks();
    proyectos.exists.mockResolvedValue(true);
    const module = await Test.createTestingModule({
      providers: [
        EquipoService,
        { provide: getRepositoryToken(ProyectoEquipo), useValue: equipo },
        { provide: getRepositoryToken(Proyecto), useValue: proyectos },
        { provide: getRepositoryToken(Usuario), useValue: usuarios },
      ],
    }).compile();
    service = module.get(EquipoService);
  });

  it('lista el equipo activo con el formato del frontend', async () => {
    equipo.find.mockResolvedValue([
      {
        usuarioId: TECNICO,
        asignadoAt: new Date('2026-01-15T10:00:00.000Z'),
        usuario: { nombre: 'Técnico Demo', email: 'tecnico@serfamilia.test' },
      },
    ]);

    await expect(service.listar(PROYECTO)).resolves.toEqual([
      {
        id: TECNICO,
        nombre: 'Técnico Demo',
        email: 'tecnico@serfamilia.test',
        fechaAsignacion: '2026-01-15T10:00:00.000Z',
      },
    ]);
  });

  it('asigna con asignado_por del Director seed', async () => {
    equipo.findOne
      .mockResolvedValueOnce(null) // sin asignación activa previa
      .mockResolvedValueOnce({
        id: 'asig-nueva',
        usuarioId: TECNICO,
        asignadoAt: new Date('2026-03-01T12:00:00.000Z'),
        usuario: { nombre: 'Técnico Demo', email: 'tecnico@serfamilia.test' },
      });
    usuarios.findOne.mockResolvedValue({
      id: TECNICO,
      nombre: 'Técnico Demo',
      email: 'tecnico@serfamilia.test',
      rol: RolUsuario.TECNICO,
    });
    equipo.save.mockImplementation(async (a) => ({ ...a, id: 'asig-nueva' }));

    const resultado = await service.asignar(PROYECTO, TECNICO);

    expect(equipo.create).toHaveBeenCalledWith({
      proyectoId: PROYECTO,
      usuarioId: TECNICO,
      asignadoPorId: DIRECTOR_SEED_ID,
    });
    expect(resultado.id).toBe(TECNICO);
    expect(resultado.fechaAsignacion).toBe('2026-03-01T12:00:00.000Z');
  });

  it('lanza ConflictException si el técnico ya está asignado', async () => {
    equipo.findOne.mockResolvedValue({ id: 'asig-1' });
    usuarios.findOne.mockResolvedValue({ id: TECNICO, rol: RolUsuario.TECNICO });

    await expect(service.asignar(PROYECTO, TECNICO)).rejects.toBeInstanceOf(ConflictException);
  });

  it('retira con baja lógica (retirado_at)', async () => {
    const activa = { id: 'asig-1', retiradoAt: null as Date | null };
    equipo.findOne.mockResolvedValue(activa);
    equipo.save.mockImplementation(async (a) => a);

    await service.retirar(PROYECTO, TECNICO);

    expect(activa.retiradoAt).toBeInstanceOf(Date);
    expect(equipo.save).toHaveBeenCalledWith(activa);
  });

  it('lanza NotFoundException al retirar una asignación inexistente', async () => {
    equipo.findOne.mockResolvedValue(null);
    await expect(service.retirar(PROYECTO, TECNICO)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lanza NotFoundException si el proyecto no existe', async () => {
    proyectos.exists.mockResolvedValue(false);
    await expect(service.listar(PROYECTO)).rejects.toBeInstanceOf(NotFoundException);
  });
});
