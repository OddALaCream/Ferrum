import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { Proyecto, type EstadoProyecto } from './entities/proyecto.entity';
import { normalizarMonto } from './presupuesto';
import { ProyectosService } from './proyectos.service';

const ID = '33333333-3333-4333-8333-333333333333';
const ADMIN_ID = '22222222-2222-4222-8222-222222222221';

function proyecto(estado: EstadoProyecto = 'EN_EJECUCION'): Proyecto {
  return Object.assign(new Proyecto(), {
    id: ID,
    codigo: 'PRY-DEMO-001',
    presupuestoTotal: '100000.00',
    moneda: 'BOB',
    estado,
  });
}

describe('ProyectosService.registrarPresupuesto', () => {
  let service: ProyectosService;
  let proyectos: { findOne: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    proyectos = {
      findOne: jest.fn(),
      save: jest.fn((p: Proyecto) => Promise.resolve(p)),
    };
    const module = await Test.createTestingModule({
      providers: [
        ProyectosService,
        { provide: getRepositoryToken(Proyecto), useValue: proyectos },
      ],
    }).compile();
    service = module.get(ProyectosService);
  });

  it('CP-02: guarda 850 000,50 BOB exacto, con dos decimales y su moneda', async () => {
    proyectos.findOne.mockResolvedValue(proyecto());

    const resultado = await service.registrarPresupuesto(ID, { monto: '850000.50', moneda: 'BOB' });

    expect(proyectos.save).toHaveBeenCalledWith(
      expect.objectContaining({ presupuestoTotal: '850000.50', moneda: 'BOB' }),
    );
    expect(resultado.presupuestoTotal).toBe('850000.50');
  });

  it('completa los decimales y cambia la moneda a EUR', async () => {
    proyectos.findOne.mockResolvedValue(proyecto());

    const resultado = await service.registrarPresupuesto(ID, { monto: '1250.5', moneda: 'EUR' });

    expect(resultado).toMatchObject({ presupuestoTotal: '1250.50', moneda: 'EUR' });
  });

  it('responde 404 si el proyecto no existe', async () => {
    proyectos.findOne.mockResolvedValue(null);

    await expect(service.registrarPresupuesto(ID, { monto: '1', moneda: 'BOB' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(proyectos.save).not.toHaveBeenCalled();
  });

  it('responde 422 si el proyecto está cerrado (RN-09)', async () => {
    proyectos.findOne.mockResolvedValue(proyecto('CERRADO'));

    await expect(service.registrarPresupuesto(ID, { monto: '1', moneda: 'BOB' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(proyectos.save).not.toHaveBeenCalled();
  });
});

describe('normalizarMonto', () => {
  it.each([
    ['850000.50', '850000.50'],
    ['850000.5', '850000.50'],
    ['100', '100.00'],
    ['0', '0.00'],
    ['007.1', '7.10'],
    ['999999999999.99', '999999999999.99'],
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarMonto(entrada)).toBe(esperado);
  });
});

describe('ProyectosService (crear / estado)', () => {
  const proyectos = {
    create: jest.fn((v) => v),
    save: jest.fn(),
    findOne: jest.fn(),
  };
  let service: ProyectosService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ProyectosService,
        { provide: getRepositoryToken(Proyecto), useValue: proyectos },
      ],
    }).compile();
    service = module.get(ProyectosService);
  });

  const dto = {
    codigo: 'PRY-2026-010',
    nombre: 'Nuevo proyecto',
    fechaInicio: '2026-01-01',
    fechaFin: '2026-12-31',
  };

  it('crea el proyecto en PLANIFICACION con creado_por del usuario de la sesión', async () => {
    proyectos.save.mockImplementation(async (p) => ({ id: 'nuevo-id', ...p }));

    const resultado = await service.crear(dto, ADMIN_ID);

    expect(resultado.estado).toBe('PLANIFICACION');
    expect(resultado.creadoPorId).toBe(ADMIN_ID);
    expect(resultado.presupuestoTotal).toBe('0.00');
    expect(proyectos.save).toHaveBeenCalled();
  });

  it('lanza ConflictException (409) si el código ya existe', async () => {
    const driverError = Object.assign(new Error('duplicate'), {
      code: '23505',
      constraint: 'uq_proyectos_codigo',
    });
    proyectos.save.mockRejectedValue(new QueryFailedError('', [], driverError));

    await expect(service.crear(dto, ADMIN_ID)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.crear(dto, ADMIN_ID)).rejects.toThrow(/Ya existe un proyecto con el código/);
  });

  it('lanza NotFoundException si el proyecto no existe', async () => {
    proyectos.findOne.mockResolvedValue(null);
    await expect(service.obtenerPorId('00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('RN-09 / CP-03: rechaza transición desde CERRADO con 422', async () => {
    proyectos.findOne.mockResolvedValue({ id: 'p1', estado: 'CERRADO' });

    await expect(
      service.actualizarEstado('p1', { estado: 'EN_EJECUCION' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      service.actualizarEstado('p1', { estado: 'EN_EJECUCION' }),
    ).rejects.toThrow('Un proyecto cerrado no puede cambiar de estado (RN-09).');
  });

  it('permite actualizar el estado cuando la transición es válida', async () => {
    const actual = { id: 'p1', estado: 'EN_EJECUCION' as const };
    proyectos.findOne.mockResolvedValue(actual);
    proyectos.save.mockImplementation(async (p) => p);

    const resultado = await service.actualizarEstado('p1', { estado: 'PAUSADO' });
    expect(resultado.estado).toBe('PAUSADO');
  });

  it('rechaza con 422 una transición no permitida por el esquema (p. ej. PLANIFICACION→CERRADO)', async () => {
    proyectos.findOne.mockResolvedValue({ id: 'p1', estado: 'PLANIFICACION' });

    await expect(
      service.actualizarEstado('p1', { estado: 'CERRADO' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      service.actualizarEstado('p1', { estado: 'CERRADO' }),
    ).rejects.toThrow(/Transición de proyecto no permitida/);
  });
});