import { BadRequestException, ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Proyecto } from '../../proyectos/entities/proyecto.entity';
import { CrearIndicadorDto, EditarIndicadorDto } from '../dto/indicador.dto';
import { CrearResultadoDto, EditarResultadoDto } from '../dto/resultado.dto';
import { Iov } from '../entities/iov.entity';
import { Resultado } from '../entities/resultado.entity';
import type { ArbolMarcoLogico, ResultadoVista } from '../types/marco-logico.types';
import { codigoPg, esViolacionFk } from '../utils/errores-pg';
import { compararCodigos, estadoEfectivo } from '../utils/estado-efectivo';

const MSG_RESULTADO_DUPLICADO = 'Ya existe un resultado con ese código en el proyecto.';
const MSG_INDICADOR_DUPLICADO = 'Ya existe un indicador con ese código en el resultado.';

/**
 * RF-05, RF-06 y RF-07: resultados esperados e indicadores (I.O.V.) de un proyecto.
 * Un proyecto Cerrado queda en solo lectura (RN-09).
 */
@Injectable()
export class MarcoLogicoService {
  constructor(
    @InjectRepository(Proyecto) private readonly proyectos: Repository<Proyecto>,
    @InjectRepository(Resultado) private readonly resultados: Repository<Resultado>,
    @InjectRepository(Iov) private readonly indicadores: Repository<Iov>,
  ) {}

  /** Marco lógico completo: resultados → indicadores y actividades (con sesiones y tareas). */
  async arbol(proyectoId: string): Promise<ArbolMarcoLogico> {
    const p = await this.proyecto(proyectoId);
    const resultados = await this.resultados.find({
      where: { proyectoId },
      relations: { indicadores: true, actividades: { sesiones: true, tareas: true } },
    });

    const vista: ResultadoVista[] = resultados
      .sort((a, b) => compararCodigos(a.codigo, b.codigo))
      .map((r) => ({
        ...r,
        indicadores: [...r.indicadores].sort((a, b) => compararCodigos(a.codigo, b.codigo)),
        actividades: [...r.actividades]
          .sort((a, b) => compararCodigos(a.codigo, b.codigo))
          .map((a) => ({
            ...a,
            estadoEfectivo: estadoEfectivo(a.estado, a.fechaFin),
            sesiones: [...a.sesiones].sort((x, y) => x.fecha.localeCompare(y.fecha)),
            tareas: [...a.tareas].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime()),
          })),
      }));

    return {
      proyecto: { id: p.id, codigo: p.codigo, nombre: p.nombre, estado: p.estado, fechaInicio: p.fechaInicio, fechaFin: p.fechaFin },
      resultados: vista,
    };
  }

  async crearResultado(proyectoId: string, dto: CrearResultadoDto): Promise<Resultado> {
    await this.proyectoEditable(proyectoId);
    try {
      return await this.resultados.save(this.resultados.create({ ...dto, proyectoId }));
    } catch (e) {
      if (codigoPg(e) === '23505') throw new ConflictException(MSG_RESULTADO_DUPLICADO);
      throw e;
    }
  }

  async editarResultado(proyectoId: string, resultadoId: string, dto: EditarResultadoDto): Promise<Resultado> {
    await this.proyectoEditable(proyectoId);
    const r = await this.resultado(proyectoId, resultadoId);
    Object.assign(r, dto);
    try {
      return await this.resultados.save(r);
    } catch (e) {
      if (codigoPg(e) === '23505') throw new ConflictException(MSG_RESULTADO_DUPLICADO);
      throw e;
    }
  }

  async eliminarResultado(proyectoId: string, resultadoId: string): Promise<void> {
    await this.proyectoEditable(proyectoId);
    const r = await this.resultado(proyectoId, resultadoId);
    try {
      await this.resultados.delete(r.id);
    } catch (e) {
      if (esViolacionFk(e)) {
        throw new ConflictException('No se puede eliminar el resultado: todavía tiene indicadores o actividades.');
      }
      throw e;
    }
  }

  async crearIndicador(proyectoId: string, resultadoId: string, dto: CrearIndicadorDto): Promise<Iov> {
    await this.proyectoEditable(proyectoId);
    await this.resultado(proyectoId, resultadoId);
    const lineaBase = dto.lineaBase ?? 0;
    this.validarMeta(lineaBase, dto.meta);
    await this.validarPeso(resultadoId, dto.peso ?? 0);
    try {
      return await this.indicadores.save(this.indicadores.create({ ...dto, lineaBase, resultadoId }));
    } catch (e) {
      if (codigoPg(e) === '23505') throw new ConflictException(MSG_INDICADOR_DUPLICADO);
      throw e;
    }
  }

  async editarIndicador(proyectoId: string, resultadoId: string, indicadorId: string, dto: EditarIndicadorDto): Promise<Iov> {
    await this.proyectoEditable(proyectoId);
    await this.resultado(proyectoId, resultadoId);
    const i = await this.indicador(resultadoId, indicadorId);
    Object.assign(i, dto);
    this.validarMeta(i.lineaBase, i.meta);
    if (dto.peso !== undefined) await this.validarPeso(resultadoId, dto.peso, i.id);
    try {
      return await this.indicadores.save(i);
    } catch (e) {
      if (codigoPg(e) === '23505') throw new ConflictException(MSG_INDICADOR_DUPLICADO);
      throw e;
    }
  }

  async eliminarIndicador(proyectoId: string, resultadoId: string, indicadorId: string): Promise<void> {
    await this.proyectoEditable(proyectoId);
    await this.resultado(proyectoId, resultadoId);
    const i = await this.indicador(resultadoId, indicadorId);
    try {
      await this.indicadores.delete(i.id);
    } catch (e) {
      if (esViolacionFk(e)) {
        throw new ConflictException('No se puede eliminar el indicador: tiene actividades o avances asociados.');
      }
      throw e;
    }
  }

  /** CP-07: la línea base y la meta deben ser distintas para que el cumplimiento se pueda medir. */
  private validarMeta(lineaBase: number, meta: number): void {
    if (lineaBase === meta) {
      throw new BadRequestException('La meta debe ser distinta de la línea base para poder medir el cumplimiento.');
    }
  }

  /** La suma de los pesos de los indicadores de un resultado no puede superar el 100 %. */
  private async validarPeso(resultadoId: string, peso: number, exceptoId?: string): Promise<void> {
    const otros = await this.indicadores.find({ where: { resultadoId }, select: { id: true, peso: true } });
    const suma = otros.filter((o) => o.id !== exceptoId).reduce((s, o) => s + o.peso, 0) + peso;
    if (suma > 100.0001) {
      throw new UnprocessableEntityException(`La suma de pesos de los indicadores del resultado no puede superar 100 % (quedaría en ${suma}).`);
    }
  }

  private async proyecto(proyectoId: string): Promise<Proyecto> {
    const p = await this.proyectos.findOne({ where: { id: proyectoId } });
    if (!p) throw new NotFoundException('El proyecto no existe.');
    return p;
  }

  private async proyectoEditable(proyectoId: string): Promise<Proyecto> {
    const p = await this.proyecto(proyectoId);
    if (p.estado === 'CERRADO') {
      throw new UnprocessableEntityException('Un proyecto cerrado no admite cambios en su marco lógico (RN-09).');
    }
    return p;
  }

  private async resultado(proyectoId: string, resultadoId: string): Promise<Resultado> {
    const r = await this.resultados.findOne({ where: { id: resultadoId, proyectoId } });
    if (!r) throw new NotFoundException('El resultado no existe en este proyecto.');
    return r;
  }

  private async indicador(resultadoId: string, indicadorId: string): Promise<Iov> {
    const i = await this.indicadores.findOne({ where: { id: indicadorId, resultadoId } });
    if (!i) throw new NotFoundException('El indicador no existe en este resultado.');
    return i;
  }
}