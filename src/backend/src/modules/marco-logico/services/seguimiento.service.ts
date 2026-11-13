import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { UsuarioAutenticado } from '../../auth/types/auth.types';
import { RolUsuario } from '../../proyectos/entities/usuario.entity';
import type { ActividadPendiente, ActividadRetrasada, MiTrabajo, TareaPendiente } from '../types/seguimiento.types';

interface Alcance {
  /** Condición SQL sobre las tablas `p` (proyectos) y `a` (actividades). */
  sql: string;
  params: unknown[];
}

const EQUIPO_VIGENTE = `EXISTS (SELECT 1 FROM proyecto_equipo pe
                                WHERE pe.proyecto_id = p.id AND pe.usuario_id = $1 AND pe.retirado_at IS NULL)`;

/**
 * Seguimiento del trabajo: qué está retrasado y qué le toca a cada técnico.
 * Cada rol ve solo lo suyo: el Administrador todo, el Supervisor sus proyectos, el Técnico sus actividades.
 */
@Injectable()
export class SeguimientoService {
  constructor(private readonly ds: DataSource) {}

  /** Actividades vencidas y sin completar, de los proyectos que el usuario puede ver. */
  async retrasadas(usuario: UsuarioAutenticado): Promise<ActividadRetrasada[]> {
    const alcance = this.alcance(usuario);
    const filas: Array<Record<string, string | number | null>> = await this.ds.query(
      `SELECT a.id, a.codigo, a.nombre, r.codigo AS resultado_codigo,
              p.id AS proyecto_id, p.codigo AS proyecto_codigo, p.nombre AS proyecto_nombre,
              u.nombre AS responsable, to_char(a.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
              (CURRENT_DATE - a.fecha_fin) AS dias_atraso, a.cumplimiento_pct
         FROM actividades a
         JOIN resultados r ON r.id = a.resultado_id
         JOIN proyectos  p ON p.id = r.proyecto_id AND p.deleted_at IS NULL
         LEFT JOIN usuarios u ON u.id = a.responsable_id
        WHERE a.estado <> 'COMPLETADA' AND a.fecha_fin < CURRENT_DATE AND p.estado <> 'CERRADO'
          AND ${alcance.sql}
        ORDER BY dias_atraso DESC, p.codigo, a.codigo
        LIMIT 50`,
      alcance.params,
    );
    return filas.map((f) => ({
      id: String(f.id),
      codigo: String(f.codigo),
      nombre: String(f.nombre),
      resultadoCodigo: String(f.resultado_codigo),
      proyectoId: String(f.proyecto_id),
      proyectoCodigo: String(f.proyecto_codigo),
      proyectoNombre: String(f.proyecto_nombre),
      responsable: f.responsable === null ? null : String(f.responsable),
      fechaFin: String(f.fecha_fin),
      diasAtraso: Number(f.dias_atraso),
      cumplimientoPct: Number(f.cumplimiento_pct),
    }));
  }

  /** Las actividades y tareas sin cerrar que tiene a su cargo un técnico, en sus proyectos vigentes. */
  async miTrabajo(usuario: UsuarioAutenticado): Promise<MiTrabajo> {
    const vigentes = `p.estado IN ('PLANIFICACION', 'EN_EJECUCION', 'PAUSADO')`;

    const actividadesFilas: Array<Record<string, string | number | boolean | null>> = await this.ds.query(
      `SELECT a.id, a.codigo, a.nombre, a.tipo_cronograma, a.estado,
              (a.fecha_fin < CURRENT_DATE) AS retrasada,
              to_char(a.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio, to_char(a.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
              a.cumplimiento_pct, r.codigo AS resultado_codigo,
              p.id AS proyecto_id, p.codigo AS proyecto_codigo, p.nombre AS proyecto_nombre,
              (SELECT to_char(MIN(s.fecha), 'YYYY-MM-DD') FROM actividad_sesiones s
                WHERE s.actividad_id = a.id AND NOT s.realizada AND s.fecha >= CURRENT_DATE) AS proxima_sesion,
              (SELECT COUNT(*) FROM actividad_sesiones s
                WHERE s.actividad_id = a.id AND NOT s.realizada AND s.fecha < CURRENT_DATE) AS sesiones_sin_marcar
         FROM actividades a
         JOIN resultados r ON r.id = a.resultado_id
         JOIN proyectos  p ON p.id = r.proyecto_id AND p.deleted_at IS NULL
        WHERE a.responsable_id = $1 AND a.estado <> 'COMPLETADA' AND ${vigentes} AND ${EQUIPO_VIGENTE}
        ORDER BY (a.fecha_fin < CURRENT_DATE) DESC, a.fecha_fin ASC, p.codigo, a.codigo`,
      [usuario.id],
    );

    const tareasFilas: Array<Record<string, string | boolean | null>> = await this.ds.query(
      `SELECT t.id, t.nombre, t.estado, to_char(t.fecha_limite, 'YYYY-MM-DD') AS fecha_limite,
              COALESCE(t.fecha_limite < CURRENT_DATE, false) AS vencida,
              a.id AS actividad_id, a.codigo AS actividad_codigo, p.id AS proyecto_id, p.codigo AS proyecto_codigo
         FROM tareas t
         JOIN actividades a ON a.id = t.actividad_id
         JOIN resultados  r ON r.id = a.resultado_id
         JOIN proyectos   p ON p.id = r.proyecto_id AND p.deleted_at IS NULL
        WHERE t.estado <> 'COMPLETADA' AND (t.responsable_id = $1 OR a.responsable_id = $1)
          AND ${vigentes} AND ${EQUIPO_VIGENTE}
        ORDER BY (t.fecha_limite IS NULL), t.fecha_limite ASC, p.codigo, a.codigo
        LIMIT 100`,
      [usuario.id],
    );

    const actividades: ActividadPendiente[] = actividadesFilas.map((f) => ({
      id: String(f.id),
      codigo: String(f.codigo),
      nombre: String(f.nombre),
      tipoCronograma: f.tipo_cronograma as ActividadPendiente['tipoCronograma'],
      estado: f.estado as ActividadPendiente['estado'],
      retrasada: Boolean(f.retrasada),
      fechaInicio: String(f.fecha_inicio),
      fechaFin: String(f.fecha_fin),
      cumplimientoPct: Number(f.cumplimiento_pct),
      resultadoCodigo: String(f.resultado_codigo),
      proyectoId: String(f.proyecto_id),
      proyectoCodigo: String(f.proyecto_codigo),
      proyectoNombre: String(f.proyecto_nombre),
      proximaSesion: f.proxima_sesion === null ? null : String(f.proxima_sesion),
      sesionesSinMarcar: Number(f.sesiones_sin_marcar),
    }));

    const tareas: TareaPendiente[] = tareasFilas.map((f) => ({
      id: String(f.id),
      nombre: String(f.nombre),
      estado: f.estado as TareaPendiente['estado'],
      fechaLimite: f.fecha_limite === null ? null : String(f.fecha_limite),
      vencida: Boolean(f.vencida),
      actividadId: String(f.actividad_id),
      actividadCodigo: String(f.actividad_codigo),
      proyectoId: String(f.proyecto_id),
      proyectoCodigo: String(f.proyecto_codigo),
    }));

    return {
      resumen: {
        actividadesActivas: actividades.length,
        actividadesRetrasadas: actividades.filter((a) => a.retrasada).length,
        tareasPendientes: tareas.length,
        tareasVencidas: tareas.filter((t) => t.vencida).length,
        sesionesSinMarcar: actividades.reduce((s, a) => s + a.sesionesSinMarcar, 0),
      },
      actividades,
      tareas,
    };
  }

  private alcance(usuario: UsuarioAutenticado): Alcance {
    if (usuario.rol === RolUsuario.SUPERVISOR) {
      return {
        sql: `EXISTS (SELECT 1 FROM proyecto_supervisores ps
                       WHERE ps.proyecto_id = p.id AND ps.usuario_id = $1 AND ps.retirado_at IS NULL)`,
        params: [usuario.id],
      };
    }
    if (usuario.rol === RolUsuario.TECNICO) {
      return { sql: `a.responsable_id = $1 AND ${EQUIPO_VIGENTE}`, params: [usuario.id] };
    }
    return { sql: 'TRUE', params: [] };
  }
}