import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Proyecto, type EstadoProyecto } from './entities/proyecto.entity';
import { normalizarMonto } from './presupuesto';
import { ProyectosService } from './proyectos.service';

const ID = '33333333-3333-4333-8333-333333333333';

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
  let repo: { findOneBy: jest.Mock; save: jest.Mock };
  let service: ProyectosService;

  beforeEach(() => {
    repo = { findOneBy: jest.fn(), save: jest.fn((p: Proyecto) => Promise.resolve(p)) };
    service = new ProyectosService(repo as unknown as Repository<Proyecto>);
  });

  it('CP-02: guarda 850 000,50 BOB exacto, con dos decimales y su moneda', async () => {
    repo.findOneBy.mockResolvedValue(proyecto());

    const resultado = await service.registrarPresupuesto(ID, { monto: '850000.50', moneda: 'BOB' });

    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ presupuestoTotal: '850000.50', moneda: 'BOB' }));
    expect(resultado.presupuestoTotal).toBe('850000.50');
  });

  it('completa los decimales y cambia la moneda a EUR', async () => {
    repo.findOneBy.mockResolvedValue(proyecto());

    const resultado = await service.registrarPresupuesto(ID, { monto: '1250.5', moneda: 'EUR' });

    expect(resultado).toMatchObject({ presupuestoTotal: '1250.50', moneda: 'EUR' });
  });

  it('responde 404 si el proyecto no existe', async () => {
    repo.findOneBy.mockResolvedValue(null);

    await expect(service.registrarPresupuesto(ID, { monto: '1', moneda: 'BOB' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('responde 422 si el proyecto está cerrado (RN-09)', async () => {
    repo.findOneBy.mockResolvedValue(proyecto('CERRADO'));

    await expect(service.registrarPresupuesto(ID, { monto: '1', moneda: 'BOB' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(repo.save).not.toHaveBeenCalled();
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
