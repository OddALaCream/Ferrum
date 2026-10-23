import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Financiador } from './entities/financiador.entity';

@Injectable()
export class FinanciadoresService {
  constructor(
    @InjectRepository(Financiador)
    private readonly financiadores: Repository<Financiador>,
  ) {}

  async listarActivos(): Promise<Pick<Financiador, 'id' | 'nombre'>[]> {
    return this.financiadores.find({
      where: { activo: true },
      select: { id: true, nombre: true },
      order: { nombre: 'ASC' },
    });
  }
}
