import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { ProyectoSupervisor } from './entities/proyecto-supervisor.entity';
import { Proyecto } from './entities/proyecto.entity';
import { RolUsuario, Usuario } from './entities/usuario.entity';
import { SupervisoresService } from './supervisores.service';

const PROYECTO = '33333333-3333-4333-8333-333333333333';
const SUPERVISOR = '22222222-2222-4222-8222-222222222224';
const ADMIN = '22222222-2222-4222-8222-222222222221';

const errorPg = (code: string, message = 'x') =>
  new QueryFailedError('INSERT', [], Object.assign(new Error(message), { code, message }));

describe('SupervisoresService', () => {
  let service: SupervisoresService;
  const supervisiones = { find: jest.fn(), findOne: jest.fn(), exists: jest.fn(), save: jest.fn(), create: jest.fn() };
  const proyectos = { exists: jest.fn() };
  const usuarios = { findOne: jest.fn(), createQueryBuilder: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    supervisiones.create.mockImplementation((x: object) => x);
    proyectos.exists.mockResolvedValue(true);
    const mod = await Test.createTestingModule({
      providers: [
        SupervisoresService,
        { provide: getRepositoryToken(ProyectoSupervisor), useValue: supervisiones },
        { provide: getRepositoryToken(Proyecto), useValue: proyectos },
        { provide: getRepositoryToken(Usuario), useValue: usuarios },
      ],
    }).compile();
    service = mod.get(SupervisoresService);
  });

  const usuario = (cambios: Partial<Usuario> = {}) =>
    Object.assign(new Usuario(), { id: SUPERVISOR, nombre: 'Rodrigo Mamani', email: 'supervisor@serfamilia.test', rol: RolUsuario.SUPERVISOR, activo: true, deletedAt: null, ...cambios });

  describe('asignar', () => {
    it('asigna a un supervisor activo y devuelve sus datos', async () => {
      usuarios.findOne.mockResolvedValue(usuario());
      supervisiones.exists.mockResolvedValue(false);
      supervisiones.save.mockResolvedValue({ id: 's-1' });
      supervisiones.findOne.mockResolvedValue({ usuarioId: SUPERVISOR, usuario: usuario(), asignadoAt: new Date('2026-11-13T12:00:00Z') });

      const r = await service.asignar(PROYECTO, SUPERVISOR, ADMIN);

      expect(r).toMatchObject({ id: SUPERVISOR, nombre: 'Rodrigo Mamani', email: 'supervisor@serfamilia.test' });
      expect(supervisiones.create).toHaveBeenCalledWith({ proyectoId: PROYECTO, usuarioId: SUPERVISOR, asignadoPorId: ADMIN });
    });

    it('un usuario que no es supervisor (o no está activo) responde 404', async () => {
      usuarios.findOne.mockResolvedValue(null);
      await expect(service.asignar(PROYECTO, SUPERVISOR, ADMIN)).rejects.toBeInstanceOf(NotFoundException);
      expect(usuarios.findOne).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: SUPERVISOR, rol: RolUsuario.SUPERVISOR, activo: true }),
      });
    });

    it('si ya supervisa el proyecto responde 409', async () => {
      usuarios.findOne.mockResolvedValue(usuario());
      supervisiones.exists.mockResolvedValue(true);
      await expect(service.asignar(PROYECTO, SUPERVISOR, ADMIN)).rejects.toBeInstanceOf(ConflictException);
    });

    it('la regla de la base (solo supervisores) se devuelve como 422 y no como un 500', async () => {
      usuarios.findOne.mockResolvedValue(usuario());
      supervisiones.exists.mockResolvedValue(false);
      supervisiones.save.mockRejectedValue(errorPg('23514', 'Solo los usuarios con rol SUPERVISOR pueden supervisar un proyecto'));
      await expect(service.asignar(PROYECTO, SUPERVISOR, ADMIN)).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('si el proyecto no existe responde 404 sin consultar al usuario', async () => {
      proyectos.exists.mockResolvedValue(false);
      await expect(service.asignar(PROYECTO, SUPERVISOR, ADMIN)).rejects.toBeInstanceOf(NotFoundException);
      expect(usuarios.findOne).not.toHaveBeenCalled();
    });
  });

  describe('retirar', () => {
    it('marca la fecha de retiro y conserva el historial', async () => {
      const activa = { id: 's-1', retiradoAt: null as Date | null };
      supervisiones.findOne.mockResolvedValue(activa);
      await service.retirar(PROYECTO, SUPERVISOR);
      expect(supervisiones.save).toHaveBeenCalledWith(expect.objectContaining({ id: 's-1', retiradoAt: expect.any(Date) }));
    });

    it('si no supervisa el proyecto responde 404', async () => {
      supervisiones.findOne.mockResolvedValue(null);
      await expect(service.retirar(PROYECTO, SUPERVISOR)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listar', () => {
    it('devuelve solo a los supervisores activos con asignación vigente', async () => {
      supervisiones.find.mockResolvedValue([
        { usuarioId: 'a', usuario: usuario({ id: 'a', nombre: 'Ana' }), asignadoAt: new Date('2026-10-01T00:00:00Z') },
        { usuarioId: 'b', usuario: usuario({ id: 'b', nombre: 'Baja', activo: false }), asignadoAt: new Date('2026-10-02T00:00:00Z') },
        { usuarioId: 'c', usuario: usuario({ id: 'c', nombre: 'Técnico', rol: RolUsuario.TECNICO }), asignadoAt: new Date('2026-10-03T00:00:00Z') },
      ]);
      const r = await service.listar(PROYECTO);
      expect(r.map((s) => s.nombre)).toEqual(['Ana']);
    });
  });
});