import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { CreateObjetivoEspecificoDto } from './dto/create-objetivo-especifico.dto';
import { ObjetivoEspecifico } from './entities/objetivo-especifico.entity';

/** Violación de unicidad en PostgreSQL (UNIQUE proyecto_id + codigo). */
const PG_UNIQUE_VIOLATION = '23505';

const MSG_CODIGO_DUPLICADO =
  'Ya existe un objetivo específico con ese código en el proyecto.';

/**
 * HU SGP-162: objetivos específicos vinculados a un proyecto.
 * Un proyecto Cerrado queda en solo lectura (RN-09).
 */
@Injectable()
export class ObjetivosEspecificosService {
  constructor(
    @InjectRepository(ObjetivoEspecifico)
    private readonly objetivos: Repository<ObjetivoEspecifico>,
    @InjectRepository(Proyecto)
    private readonly proyectos: Repository<Proyecto>,
  ) {}

  async crearObjetivo(proyectoId: string, dto: CreateObjetivoEspecificoDto): Promise<ObjetivoEspecifico> {
    await this.proyectoEditable(proyectoId);
    try {
      return await this.objetivos.save(
        this.objetivos.create({
          proyectoId,
          codigo: dto.codigo.trim(),
          descripcion: dto.descripcion.trim(),
        }),
      );
    } catch (e) {
      if (this.esCodigoDuplicado(e)) {
        throw new ConflictException(MSG_CODIGO_DUPLICADO);
      }
      throw e;
    }
  }

  async obtenerPorProyecto(proyectoId: string): Promise<ObjetivoEspecifico[]> {
    await this.proyecto(proyectoId);
    return this.objetivos.find({
      where: { proyectoId },
      order: { codigo: 'ASC' },
    });
  }

  private async proyecto(proyectoId: string): Promise<Proyecto> {
    const p = await this.proyectos.findOne({ where: { id: proyectoId } });
    if (!p) throw new NotFoundException('El proyecto no existe.');
    return p;
  }

  private async proyectoEditable(proyectoId: string): Promise<Proyecto> {
    const p = await this.proyecto(proyectoId);
    if (p.estado === 'CERRADO') {
      throw new UnprocessableEntityException(
        'Un proyecto cerrado no admite cambios en sus objetivos específicos (RN-09).',
      );
    }
    return p;
  }

  private esCodigoDuplicado(e: unknown): boolean {
    if (!(e instanceof QueryFailedError)) return false;
    const driver = e.driverError as { code?: string } | undefined;
    return driver?.code === PG_UNIQUE_VIOLATION;
  }
}
