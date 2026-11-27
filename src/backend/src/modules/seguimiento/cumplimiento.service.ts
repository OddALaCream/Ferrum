import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { cumplimientoIov, promedioPonderado, valorActualIov } from './utils/cumplimiento';

/**
 * SGP-95: guarda el % de cumplimiento de indicadores, resultados y proyectos.
 * Se recalcula en cadena (indicador → resultado → proyecto) cuando se aprueba un avance o cuando cambian
 * la línea base, la meta o los pesos. Cada nivel bloquea su fila para que dos aprobaciones simultáneas
 * no se pisen.
 */
@Injectable()
export class CumplimientoService {
  constructor(private readonly ds: DataSource) {}

  async desdeIndicador(iovId: string, m?: EntityManager): Promise<void> {
    await this.en(m, async (q) => {
      const [i] = await q.query(
        `SELECT resultado_id, linea_base, meta FROM iov WHERE id = $1 FOR UPDATE`,
        [iovId],
      );
      if (!i) return;
      const [{ suma }] = await q.query(
        `SELECT COALESCE(SUM(valor_reportado), 0) AS suma FROM avances WHERE iov_id = $1 AND estado = 'APROBADO'`,
        [iovId],
      );
      const [base, meta, aprobado] = [Number(i.linea_base), Number(i.meta), Number(suma)];
      await q.query(`UPDATE iov SET valor_actual = $2, cumplimiento_pct = $3 WHERE id = $1`, [
        iovId,
        valorActualIov(base, meta, aprobado),
        cumplimientoIov(base, meta, aprobado),
      ]);
      await this.desdeResultado(String(i.resultado_id), q);
    });
  }

  async desdeResultado(resultadoId: string, m?: EntityManager): Promise<void> {
    await this.en(m, async (q) => {
      const [r] = await q.query(`SELECT proyecto_id FROM resultados WHERE id = $1 FOR UPDATE`, [resultadoId]);
      if (!r) return;
      const indicadores: Array<{ pct: string; peso: string }> = await q.query(
        `SELECT cumplimiento_pct AS pct, peso FROM iov WHERE resultado_id = $1`,
        [resultadoId],
      );
      await q.query(`UPDATE resultados SET cumplimiento_pct = $2 WHERE id = $1`, [resultadoId, promedioPonderado(indicadores.map(numeros))]);
      await this.desdeProyecto(String(r.proyecto_id), q);
    });
  }

  /** Solo cuentan los resultados que tienen indicadores: uno sin indicadores todavía no se puede medir. */
  async desdeProyecto(proyectoId: string, m?: EntityManager): Promise<void> {
    await this.en(m, async (q) => {
      const [p] = await q.query(`SELECT id FROM proyectos WHERE id = $1 FOR UPDATE`, [proyectoId]);
      if (!p) return;
      const resultados: Array<{ pct: string; peso: string }> = await q.query(
        `SELECT r.cumplimiento_pct AS pct, r.peso
           FROM resultados r
          WHERE r.proyecto_id = $1 AND EXISTS (SELECT 1 FROM iov i WHERE i.resultado_id = r.id)`,
        [proyectoId],
      );
      await q.query(`UPDATE proyectos SET cumplimiento_pct = $2 WHERE id = $1`, [proyectoId, promedioPonderado(resultados.map(numeros))]);
    });
  }

  private async en(m: EntityManager | undefined, trabajo: (q: EntityManager) => Promise<void>): Promise<void> {
    if (m) return trabajo(m);
    return this.ds.transaction(trabajo);
  }
}

const numeros = (f: { pct: string; peso: string }) => ({ pct: Number(f.pct), peso: Number(f.peso) });