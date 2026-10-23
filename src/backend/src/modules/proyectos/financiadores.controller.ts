import { Controller, Get } from '@nestjs/common';
import { FinanciadoresService } from './financiadores.service';

@Controller('financiadores')
export class FinanciadoresController {
  constructor(private readonly financiadoresService: FinanciadoresService) {}

  @Get()
  listar() {
    return this.financiadoresService.listarActivos();
  }
}
