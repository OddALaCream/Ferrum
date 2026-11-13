import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { msHastaProximaEjecucion } from '../utils/estado-efectivo';

export interface ResultadoProcesoRetrasos {
  /** Actividades vencidas y sin completar que pasaron a RETRASADA. */
  marcadas: number;
  /** Actividades que estaban RETRASADA pero su plazo se amplió: vuelven a En curso o Pendiente. */
  reabiertas: number;
}

/**
 * SGP-113 / RN-11: proceso diario que deja guardado el estado RETRASADA de toda actividad vencida y no completada
 * (en proyectos no cerrados), y quita ese estado a las que tuvieron una ampliación de plazo.
 * Corre todos los días a las 00:05 (hora del servidor). El Administrador también puede lanzarlo a mano.
 * Sin dependencias externas: un temporizador que no impide apagar el servidor.
 */
@Injectable()
export class ProcesoRetrasosService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ProcesoRetrasosService.name);
  private temporizador?: NodeJS.Timeout;

  constructor(private readonly ds: DataSource) {}

  onApplicationBootstrap(): void {
    this.programar();
  }

  onApplicationShutdown(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
  }

  async ejecutar(): Promise<ResultadoProcesoRetrasos> {
    const [{ n: marcadas }] = await this.ds.query(`
      WITH m AS (
        UPDATE actividades a SET estado = 'RETRASADA'
          FROM resultados r JOIN proyectos p ON p.id = r.proyecto_id
         WHERE a.resultado_id = r.id
           AND a.estado IN ('PENDIENTE', 'EN_CURSO')
           AND a.fecha_fin < CURRENT_DATE
           AND p.deleted_at IS NULL AND p.estado <> 'CERRADO'
        RETURNING a.id)
      SELECT COUNT(*)::int AS n FROM m`);
    const [{ n: reabiertas }] = await this.ds.query(`
      WITH m AS (
        UPDATE actividades
           SET estado = (CASE WHEN cumplimiento_pct > 0 THEN 'EN_CURSO' ELSE 'PENDIENTE' END)::estado_actividad
         WHERE estado = 'RETRASADA' AND fecha_fin >= CURRENT_DATE
        RETURNING id)
      SELECT COUNT(*)::int AS n FROM m`);
    this.logger.log(`Revisión diaria: ${marcadas} actividades marcadas como retrasadas, ${reabiertas} reabiertas por ampliación de plazo.`);
    return { marcadas: Number(marcadas), reabiertas: Number(reabiertas) };
  }

  private programar(): void {
    this.temporizador = setTimeout(() => {
      this.ejecutar()
        .catch((e: unknown) => this.logger.error(`Falló la revisión diaria de retrasos: ${e instanceof Error ? e.message : String(e)}`))
        .finally(() => this.programar());
    }, msHastaProximaEjecucion());
    this.temporizador.unref();
  }
}