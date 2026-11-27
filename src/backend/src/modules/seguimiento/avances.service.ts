import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { StorageAdapter } from '../../infrastructure/storage/storage.adapter';
import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { Actividad } from '../marco-logico/entities/actividad.entity';
import { Iov } from '../marco-logico/entities/iov.entity';
import { esFechaValida, hoyIso } from '../marco-logico/utils/estado-efectivo';
import { codigoPg } from '../marco-logico/utils/errores-pg';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { RolUsuario } from '../proyectos/entities/usuario.entity';
import type { AvanceVista, EvidenciaVista } from './avances.types';
import { CumplimientoService } from './cumplimiento.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AnularEvidenciaDto, CrearAvanceDto, EditarAvanceDto, ListarAvancesDto, ObservarAvanceDto } from './dto/avance.dto';
import { Avance, type EstadoAvance } from './entities/avance.entity';
import { Evidencia } from './entities/evidencia.entity';
import { detectarTipo, motivoRechazo, nombreLimpio, sha256, TIPOS_ADMITIDOS, type ArchivoSubido } from './utils/archivo';

/** Estados en que el autor todavía puede corregir su avance y sus evidencias. */
const EDITABLES: readonly EstadoAvance[] = ['BORRADOR', 'OBSERVADO'];
/** Evidencias por avance: suficiente para un informe con fotos y actas, sin volverlo un repositorio. */
export const MAX_EVIDENCIAS = 10;

interface Objetivo {
  tipo: 'IOV' | 'ACTIVIDAD';
  id: string;
  responsableId: string | null;
}

/**
 * SGP-82 (RF-11, RF-12, RN-02, RN-04, RN-10): el técnico responsable registra el avance de un indicador o
 * de una actividad, con su fecha de corte y sus evidencias. El avance nace en BORRADOR; para enviarlo a
 * revisión necesita al menos una evidencia (CP-12). Los borradores solo los ve su autor.
 */
@Injectable()
export class AvancesService {
  private readonly logger = new Logger(AvancesService.name);

  constructor(
    private readonly ds: DataSource,
    private readonly storage: StorageAdapter,
    private readonly cumplimiento: CumplimientoService,
    private readonly auditoria: AuditoriaService,
    @InjectRepository(Avance) private readonly avances: Repository<Avance>,
    @InjectRepository(Evidencia) private readonly evidencias: Repository<Evidencia>,
    @InjectRepository(Proyecto) private readonly proyectos: Repository<Proyecto>,
    @InjectRepository(Iov) private readonly indicadores: Repository<Iov>,
    @InjectRepository(Actividad) private readonly actividades: Repository<Actividad>,
  ) {}

  // ---------------------------------------------------------------- consulta

  /** Avances del proyecto. El Técnico ve los suyos (también borradores); los demás, solo los enviados en adelante. */
  async listar(proyectoId: string, filtros: ListarAvancesDto, usuario: UsuarioAutenticado): Promise<AvanceVista[]> {
    await this.proyecto(proyectoId);
    const condiciones = ['r.proyecto_id = $1'];
    const params: unknown[] = [proyectoId];
    const agregar = (sql: string, valor: unknown) => {
      params.push(valor);
      condiciones.push(sql.replace('?', `$${params.length}`));
    };
    if (filtros.iovId) agregar('a.iov_id = ?', filtros.iovId);
    if (filtros.actividadId) agregar('a.actividad_id = ?', filtros.actividadId);
    if (usuario.rol === RolUsuario.TECNICO) agregar('a.autor_id = ?', usuario.id);
    else condiciones.push(`a.estado <> 'BORRADOR'`);
    return this.consultar(condiciones, params, 'a.fecha_corte DESC, a.created_at DESC');
  }

  /**
   * SGP-96: bandeja del Administrador. Los avances enviados de todos los proyectos abiertos,
   * del más antiguo al más reciente, para revisarlos en orden de llegada.
   */
  async bandeja(): Promise<AvanceVista[]> {
    return this.consultar(
      [`a.estado = 'ENVIADO'`, 'p.deleted_at IS NULL', `p.estado <> 'CERRADO'`],
      [],
      'a.enviado_at ASC NULLS LAST, a.created_at ASC',
    );
  }

  private async consultar(condiciones: string[], params: unknown[], orden: string): Promise<AvanceVista[]> {
    const filas: Array<Record<string, unknown>> = await this.ds.query(
      `SELECT a.id, a.iov_id, a.actividad_id, a.autor_id, u.nombre AS autor_nombre, a.valor_reportado,
              to_char(a.fecha_corte, 'YYYY-MM-DD') AS fecha_corte, a.descripcion, a.estado, a.enviado_at, a.observacion,
              a.revisado_por, rv.nombre AS revisor_nombre, a.revisado_at,
              a.created_at, a.updated_at,
              p.id AS proyecto_id, p.codigo AS proyecto_codigo, p.nombre AS proyecto_nombre,
              COALESCE(i.codigo, c.codigo) AS objetivo_codigo,
              COALESCE(i.descripcion, c.nombre) AS objetivo_nombre,
              i.unidad AS objetivo_unidad
         FROM avances a
         LEFT JOIN iov i         ON i.id = a.iov_id
         LEFT JOIN actividades c ON c.id = a.actividad_id
         JOIN resultados r       ON r.id = COALESCE(i.resultado_id, c.resultado_id)
         JOIN proyectos p        ON p.id = r.proyecto_id
         JOIN usuarios u         ON u.id = a.autor_id
         LEFT JOIN usuarios rv   ON rv.id = a.revisado_por
        WHERE ${condiciones.join(' AND ')}
        ORDER BY ${orden}`,
      params,
    );
    if (filas.length === 0) return [];

    const evidencias = await this.evidencias.find({
      where: { avanceId: In(filas.map((f) => String(f.id))) },
      order: { createdAt: 'ASC' },
    });
    const anuladores = await this.nombres(evidencias.map((e) => e.anuladaPorId));
    const reemplazadas = new Set(evidencias.map((e) => e.reemplazaA).filter((id): id is string => !!id));
    return filas.map((f) => ({
      id: String(f.id),
      proyecto: { id: String(f.proyecto_id), codigo: String(f.proyecto_codigo), nombre: String(f.proyecto_nombre) },
      objetivo: {
        tipo: f.iov_id ? 'IOV' : 'ACTIVIDAD',
        id: String(f.iov_id ?? f.actividad_id),
        codigo: String(f.objetivo_codigo),
        nombre: String(f.objetivo_nombre),
        unidad: f.objetivo_unidad === null ? null : String(f.objetivo_unidad),
      },
      autor: { id: String(f.autor_id), nombre: String(f.autor_nombre) },
      valorReportado: f.valor_reportado === null ? null : Number(f.valor_reportado),
      fechaCorte: String(f.fecha_corte),
      descripcion: f.descripcion === null ? null : String(f.descripcion),
      estado: f.estado as EstadoAvance,
      enviadoAt: f.enviado_at ? new Date(f.enviado_at as string).toISOString() : null,
      observacion: f.observacion === null ? null : String(f.observacion),
      revisadoPor: f.revisado_por ? { id: String(f.revisado_por), nombre: String(f.revisor_nombre) } : null,
      revisadoAt: f.revisado_at ? new Date(f.revisado_at as string).toISOString() : null,
      createdAt: new Date(f.created_at as string).toISOString(),
      updatedAt: new Date(f.updated_at as string).toISOString(),
      evidencias: evidencias.filter((e) => e.avanceId === f.id).map((e) => this.evidenciaVista(e, anuladores, reemplazadas)),
    }));
  }

  /** Nombre de cada usuario, para mostrar quién anuló una evidencia. */
  private async nombres(ids: Array<string | null>): Promise<Map<string, string>> {
    const unicos = [...new Set(ids.filter((id): id is string => !!id))];
    if (!unicos.length) return new Map();
    const filas: Array<{ id: string; nombre: string }> = await this.ds.query(`SELECT id, nombre FROM usuarios WHERE id = ANY($1)`, [unicos]);
    return new Map(filas.map((u) => [u.id, u.nombre]));
  }

  /** URL temporal (5 minutos) para descargar una evidencia. */
  async urlDescarga(proyectoId: string, avanceId: string, evidenciaId: string, usuario: UsuarioAutenticado) {
    const avance = await this.avance(proyectoId, avanceId);
    if (avance.estado === 'BORRADOR' && avance.autorId !== usuario.id) throw new NotFoundException('El avance no existe.');
    const evidencia = await this.evidencias.findOne({ where: { id: evidenciaId, avanceId } });
    if (!evidencia) throw new NotFoundException('La evidencia no existe.');
    return { url: await this.storage.presignedDownloadUrl(evidencia.storageKey), nombre: evidencia.nombreOriginal, venceEnSegundos: 300 };
  }

  // ---------------------------------------------------------------- registro

  /** CP-11: el técnico responsable registra un avance, que queda en BORRADOR. */
  async crear(proyectoId: string, dto: CrearAvanceDto, usuario: UsuarioAutenticado): Promise<AvanceVista> {
    const proyecto = await this.proyectoAbierto(proyectoId);
    if (Boolean(dto.iovId) === Boolean(dto.actividadId)) {
      throw new BadRequestException('Indica el indicador (iovId) o la actividad (actividadId) del avance, uno de los dos.');
    }
    const objetivo = await this.objetivo(proyectoId, dto);
    this.verificarResponsable(objetivo, usuario);
    if (objetivo.tipo === 'IOV' && dto.valorReportado === undefined) {
      throw new BadRequestException('Indica el valor alcanzado (valorReportado): un avance de indicador lo necesita.');
    }
    this.validarFechaCorte(dto.fechaCorte, proyecto);

    const avance = await this.avances.save(
      this.avances.create({
        iovId: dto.iovId ?? null,
        actividadId: dto.actividadId ?? null,
        autorId: usuario.id,
        valorReportado: dto.valorReportado ?? null,
        fechaCorte: dto.fechaCorte,
        descripcion: dto.descripcion ?? null,
        estado: 'BORRADOR',
      }),
    );
    return this.vista(proyectoId, avance.id, usuario);
  }

  async editar(proyectoId: string, avanceId: string, dto: EditarAvanceDto, usuario: UsuarioAutenticado): Promise<AvanceVista> {
    const proyecto = await this.proyectoAbierto(proyectoId);
    const avance = await this.avanceEditable(proyectoId, avanceId, usuario);
    if (dto.fechaCorte !== undefined) this.validarFechaCorte(dto.fechaCorte, proyecto);
    if (avance.iovId && dto.valorReportado === null) {
      throw new BadRequestException('Un avance de indicador necesita su valor alcanzado.');
    }
    if (dto.valorReportado !== undefined) avance.valorReportado = dto.valorReportado;
    if (dto.fechaCorte !== undefined) avance.fechaCorte = dto.fechaCorte;
    if (dto.descripcion !== undefined) avance.descripcion = dto.descripcion;
    await this.avances.save(avance);
    return this.vista(proyectoId, avance.id, usuario);
  }

  /** Solo un borrador se puede eliminar, con sus evidencias. */
  async eliminar(proyectoId: string, avanceId: string, usuario: UsuarioAutenticado): Promise<void> {
    await this.proyectoAbierto(proyectoId);
    const avance = await this.avanceEditable(proyectoId, avanceId, usuario);
    if (avance.estado !== 'BORRADOR') {
      throw new UnprocessableEntityException('Solo se puede eliminar un avance en borrador.');
    }
    const evidencias = await this.evidencias.find({ where: { avanceId } });
    await this.ds.transaction(async (m) => {
      if (evidencias.length) await m.delete(Evidencia, { avanceId });
      await m.delete(Avance, { id: avanceId });
    });
    await Promise.all(evidencias.map((e) => this.quitarArchivo(e.storageKey)));
  }

  // ---------------------------------------------------------------- evidencias

  /** RF-12 / RN-04: adjunta una evidencia (PDF, JPG, PNG o WEBP de hasta 25 MB). */
  async subirEvidencia(
    proyectoId: string,
    avanceId: string,
    archivo: ArchivoSubido | undefined,
    usuario: UsuarioAutenticado,
  ): Promise<EvidenciaVista> {
    await this.proyectoAbierto(proyectoId);
    await this.avanceEditable(proyectoId, avanceId, usuario);
    const motivo = motivoRechazo(archivo);
    if (motivo) throw new UnprocessableEntityException(motivo);
    // Las versiones anteriores quedan en el historial y no cuentan para el máximo
    if ((await this.evidenciasVigentes(avanceId)) >= MAX_EVIDENCIAS) {
      throw new UnprocessableEntityException(`Un avance admite como máximo ${MAX_EVIDENCIAS} evidencias.`);
    }
    return this.guardarArchivo(avanceId, archivo!, usuario, { version: 1, reemplazaA: null });
  }

  /**
   * SGP-136: para corregir una evidencia ya enviada, el autor sube una nueva versión mientras el avance
   * está observado. La anterior no se toca: queda en el historial (y anulada, si el Administrador la anuló).
   */
  async subirVersion(
    proyectoId: string,
    avanceId: string,
    evidenciaId: string,
    archivo: ArchivoSubido | undefined,
    usuario: UsuarioAutenticado,
  ): Promise<EvidenciaVista> {
    await this.proyectoAbierto(proyectoId);
    const avance = await this.avanceEditable(proyectoId, avanceId, usuario);
    if (avance.estado !== 'OBSERVADO') {
      throw new UnprocessableEntityException(
        'Las versiones corrigen evidencias ya enviadas, con el avance observado. En un borrador, quita la evidencia y adjunta otra.',
      );
    }
    const anterior = await this.evidencias.findOne({ where: { id: evidenciaId, avanceId } });
    if (!anterior) throw new NotFoundException('La evidencia no existe.');
    if (await this.evidencias.exists({ where: { reemplazaA: anterior.id } })) {
      throw new ConflictException('Esta evidencia ya tiene una versión más nueva: corrige esa.');
    }
    const motivo = motivoRechazo(archivo);
    if (motivo) throw new UnprocessableEntityException(motivo);
    try {
      return await this.guardarArchivo(avanceId, archivo!, usuario, { version: anterior.version + 1, reemplazaA: anterior.id });
    } catch (e) {
      // Dos subidas a la vez: el índice único deja pasar solo una
      if (codigoPg(e) === '23505') throw new ConflictException('Esta evidencia ya tiene una versión más nueva: corrige esa.');
      throw e;
    }
  }

  /** Sube el archivo al almacenamiento y registra la evidencia; si la base la rechaza, borra el archivo. */
  private async guardarArchivo(
    avanceId: string,
    archivo: ArchivoSubido,
    usuario: UsuarioAutenticado,
    origen: { version: number; reemplazaA: string | null },
  ): Promise<EvidenciaVista> {
    const mime = detectarTipo(archivo.buffer)!;
    const storageKey = `avances/${avanceId}/${randomUUID()}.${TIPOS_ADMITIDOS[mime].extension}`;
    await this.storage.upload(storageKey, archivo.buffer, mime);
    try {
      const evidencia = await this.evidencias.save(
        this.evidencias.create({
          avanceId,
          ...origen,
          storageKey,
          nombreOriginal: nombreLimpio(archivo.originalname),
          mime,
          tamanoBytes: archivo.size,
          sha256: sha256(archivo.buffer),
          subidoPorId: usuario.id,
        }),
      );
      return this.evidenciaVista(evidencia);
    } catch (e) {
      // Si la base la rechaza, no se deja un archivo huérfano en el almacenamiento
      await this.quitarArchivo(storageKey);
      throw e;
    }
  }

  /**
   * Mientras el avance es un borrador, el autor puede quitar una evidencia equivocada.
   * RN-08 (SGP-134): una vez enviado, ninguna evidencia se borra ni se modifica, tampoco si lo observan.
   */
  async eliminarEvidencia(proyectoId: string, avanceId: string, evidenciaId: string, usuario: UsuarioAutenticado): Promise<void> {
    await this.proyectoAbierto(proyectoId);
    const avance = await this.avanceEditable(proyectoId, avanceId, usuario);
    if (avance.estado !== 'BORRADOR') {
      throw new UnprocessableEntityException(
        'Las evidencias de un avance ya enviado no se pueden borrar ni modificar (RN-08). Si alguna está mal, adjunta la corrección.',
      );
    }
    const evidencia = await this.evidencias.findOne({ where: { id: evidenciaId, avanceId } });
    if (!evidencia) throw new NotFoundException('La evidencia no existe.');
    await this.evidencias.delete(evidencia.id);
    await this.quitarArchivo(evidencia.storageKey);
  }

  // ---------------------------------------------------------------- envío

  /** CP-12: un avance sin evidencia válida (ni anulada ni reemplazada) no se puede enviar a revisión. */
  async enviar(proyectoId: string, avanceId: string, usuario: UsuarioAutenticado): Promise<AvanceVista> {
    await this.proyectoAbierto(proyectoId);
    const avance = await this.avanceEditable(proyectoId, avanceId, usuario);
    if ((await this.evidenciasValidas(avanceId)) === 0) {
      throw new UnprocessableEntityException(
        (await this.evidencias.count({ where: { avanceId } })) === 0
          ? 'Adjunta al menos una evidencia (fuente de verificación) antes de enviar el avance a revisión.'
          : 'Todas las evidencias de este avance están anuladas: adjunta una válida antes de reenviarlo.',
      );
    }
    avance.estado = 'ENVIADO';
    avance.enviadoAt = new Date();
    await this.avances.save(avance);
    return this.vista(proyectoId, avance.id, usuario);
  }

  // ---------------------------------------------------------------- revisión (SGP-94)

  /** El Administrador aprueba un avance enviado: desde ahí cuenta para el cumplimiento. */
  async aprobar(proyectoId: string, avanceId: string, usuario: UsuarioAutenticado): Promise<AvanceVista> {
    return this.revisar(proyectoId, avanceId, usuario, 'APROBADO', null);
  }

  /** CP-27: el Administrador observa un avance enviado con un comentario; vuelve al técnico para corregirlo. */
  async observar(proyectoId: string, avanceId: string, dto: ObservarAvanceDto, usuario: UsuarioAutenticado): Promise<AvanceVista> {
    return this.revisar(proyectoId, avanceId, usuario, 'OBSERVADO', dto.observacion);
  }

  private async revisar(
    proyectoId: string,
    avanceId: string,
    usuario: UsuarioAutenticado,
    estado: 'APROBADO' | 'OBSERVADO',
    observacion: string | null,
  ): Promise<AvanceVista> {
    await this.proyectoAbierto(proyectoId);
    const avance = await this.avance(proyectoId, avanceId);
    if (avance.estado === 'BORRADOR') throw new NotFoundException('El avance no existe.');
    if (avance.estado !== 'ENVIADO') {
      throw new UnprocessableEntityException(`Solo se revisa un avance enviado; este está ${avance.estado.toLowerCase()}.`);
    }
    if (estado === 'APROBADO' && (await this.evidenciasValidas(avance.id)) === 0) {
      throw new UnprocessableEntityException(
        'No se puede aprobar: todas sus evidencias están anuladas. Obsérvalo para que el técnico suba una válida.',
      );
    }
    const cambios: Partial<Avance> = { estado, revisadoPorId: usuario.id, revisadoAt: new Date() };
    if (observacion !== null) cambios.observacion = observacion;
    await this.ds.transaction(async (m) => {
      // Condición sobre el estado: si dos administradores revisan a la vez, solo uno gana.
      const r = await m.update(Avance, { id: avance.id, estado: 'ENVIADO' }, cambios);
      if (!r.affected) throw new ConflictException('El avance acaba de ser revisado por otra persona. Actualiza la lista.');
      // SGP-95: lo aprobado de un indicador mueve su cumplimiento, el de su resultado y el del proyecto.
      if (estado === 'APROBADO' && avance.iovId) await this.cumplimiento.desdeIndicador(avance.iovId, m);
    });
    return this.vista(proyectoId, avance.id, usuario);
  }

  // ---------------------------------------------------------------- anulación (SGP-135)

  /**
   * CP-19: el Administrador anula una evidencia de un avance ya enviado, con motivo. No se borra nada:
   * el archivo original se conserva y se sigue pudiendo abrir; la evidencia queda marcada como anulada
   * y la acción se registra en la bitácora como ANULAR.
   */
  async anularEvidencia(
    proyectoId: string,
    avanceId: string,
    evidenciaId: string,
    dto: AnularEvidenciaDto,
    usuario: UsuarioAutenticado,
  ): Promise<EvidenciaVista> {
    await this.proyectoAbierto(proyectoId);
    const avance = await this.avance(proyectoId, avanceId);
    if (avance.estado === 'BORRADOR') throw new NotFoundException('El avance no existe.');
    const evidencia = await this.evidencias.findOne({ where: { id: evidenciaId, avanceId } });
    if (!evidencia) throw new NotFoundException('La evidencia no existe.');
    if (evidencia.anuladaAt) throw new ConflictException('La evidencia ya está anulada.');

    const ahora = new Date();
    await this.ds.transaction(async (m) => {
      // Consulta directa: así la bitácora anota ANULAR (con el motivo) y no una modificación genérica.
      const [, filas] = await m.query(
        `UPDATE evidencias SET anulada_at = $2, anulada_por = $3, motivo_anulacion = $4
          WHERE id = $1 AND anulada_at IS NULL`,
        [evidencia.id, ahora, usuario.id, dto.motivo],
      );
      if (!filas) throw new ConflictException('La evidencia acaba de ser anulada por otra persona.');
      await this.auditoria.registrar(m, {
        accion: 'ANULAR',
        entidad: 'evidencias',
        entidadId: evidencia.id,
        proyectoId,
        valorAnterior: { anulada_at: null, anulada_por: null, motivo_anulacion: null },
        valorNuevo: {
          avance_id: avance.id,
          nombre_original: evidencia.nombreOriginal,
          sha256: evidencia.sha256,
          anulada_at: ahora.toISOString(),
          anulada_por: usuario.id,
          motivo_anulacion: dto.motivo,
        },
      });
    });

    const anulada = await this.evidencias.findOneOrFail({ where: { id: evidencia.id } });
    const reemplazada = await this.evidencias.exists({ where: { reemplazaA: anulada.id } });
    return this.evidenciaVista(anulada, await this.nombres([anulada.anuladaPorId]), new Set(reemplazada ? [anulada.id] : []));
  }

  /** Evidencias sin una versión más nueva (anuladas o no). */
  private async evidenciasVigentes(avanceId: string): Promise<number> {
    const [{ n }] = await this.ds.query(
      `SELECT COUNT(*)::int AS n FROM evidencias e
        WHERE e.avance_id = $1 AND NOT EXISTS (SELECT 1 FROM evidencias r WHERE r.reemplaza_a = e.id)`,
      [avanceId],
    );
    return n;
  }

  /** Evidencias que todavía sirven de prueba: ni anuladas ni reemplazadas por una versión más nueva. */
  private async evidenciasValidas(avanceId: string): Promise<number> {
    const [{ n }] = await this.ds.query(
      `SELECT COUNT(*)::int AS n FROM evidencias e
        WHERE e.avance_id = $1 AND e.anulada_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM evidencias r WHERE r.reemplaza_a = e.id)`,
      [avanceId],
    );
    return n;
  }

  // ---------------------------------------------------------------- reglas

  private async proyecto(proyectoId: string): Promise<Proyecto> {
    const p = await this.proyectos.findOne({ where: { id: proyectoId, deletedAt: IsNull() } });
    if (!p) throw new NotFoundException('El proyecto no existe.');
    return p;
  }

  private async proyectoAbierto(proyectoId: string): Promise<Proyecto> {
    const p = await this.proyecto(proyectoId);
    if (p.estado === 'CERRADO') {
      throw new UnprocessableEntityException('El proyecto está cerrado: no admite avances nuevos ni cambios (RN-09).');
    }
    return p;
  }

  /** El indicador o la actividad, siempre que pertenezca a este proyecto. */
  private async objetivo(proyectoId: string, dto: CrearAvanceDto): Promise<Objetivo> {
    if (dto.iovId) {
      const iov = await this.indicadores.findOne({ where: { id: dto.iovId, resultado: { proyectoId } }, relations: { resultado: true } });
      if (!iov) throw new NotFoundException('El indicador no existe en este proyecto.');
      return { tipo: 'IOV', id: iov.id, responsableId: iov.responsableId };
    }
    const a = await this.actividades.findOne({ where: { id: dto.actividadId, resultado: { proyectoId } }, relations: { resultado: true } });
    if (!a) throw new NotFoundException('La actividad no existe en este proyecto.');
    return { tipo: 'ACTIVIDAD', id: a.id, responsableId: a.responsableId };
  }

  /** RN-10: solo el técnico responsable del indicador o de la actividad registra sus avances. */
  private verificarResponsable(objetivo: Objetivo, usuario: UsuarioAutenticado): void {
    if (usuario.rol !== RolUsuario.TECNICO || objetivo.responsableId !== usuario.id) {
      const que = objetivo.tipo === 'IOV' ? 'del indicador' : 'de la actividad';
      throw new ForbiddenException(`Solo el técnico responsable ${que} puede registrar sus avances.`);
    }
  }

  private validarFechaCorte(fecha: string, proyecto: Proyecto): void {
    if (!esFechaValida(fecha)) throw new UnprocessableEntityException('La fecha de corte no es una fecha válida.');
    if (fecha > hoyIso()) throw new UnprocessableEntityException('La fecha de corte no puede ser posterior a hoy.');
    if (fecha < proyecto.fechaInicio) {
      throw new UnprocessableEntityException(`La fecha de corte no puede ser anterior al inicio del proyecto (${proyecto.fechaInicio}).`);
    }
  }

  /** Avance del proyecto, sin importar quién lo pide (los permisos se revisan aparte). */
  private async avance(proyectoId: string, avanceId: string): Promise<Avance> {
    const avance = await this.avances
      .createQueryBuilder('a')
      .leftJoin(Iov, 'i', 'i.id = a.iov_id')
      .leftJoin(Actividad, 'c', 'c.id = a.actividad_id')
      .innerJoin('resultados', 'r', 'r.id = COALESCE(i.resultado_id, c.resultado_id)')
      .where('a.id = :avanceId AND r.proyecto_id = :proyectoId', { avanceId, proyectoId })
      .getOne();
    if (!avance) throw new NotFoundException('El avance no existe.');
    return avance;
  }

  /** Solo el autor corrige su avance, y solo mientras es borrador o fue observado. */
  private async avanceEditable(proyectoId: string, avanceId: string, usuario: UsuarioAutenticado): Promise<Avance> {
    const avance = await this.avance(proyectoId, avanceId);
    if (avance.autorId !== usuario.id) {
      if (avance.estado === 'BORRADOR') throw new NotFoundException('El avance no existe.');
      throw new ForbiddenException('Solo el técnico que registró el avance puede modificarlo.');
    }
    if (!EDITABLES.includes(avance.estado)) {
      throw new UnprocessableEntityException(
        avance.estado === 'ENVIADO'
          ? 'El avance ya se envió a revisión: no se puede modificar hasta que el Administrador lo revise.'
          : `Un avance ${avance.estado.toLowerCase()} no se puede modificar.`,
      );
    }
    return avance;
  }

  private async vista(proyectoId: string, avanceId: string, usuario: UsuarioAutenticado): Promise<AvanceVista> {
    const lista = await this.listar(proyectoId, {}, usuario);
    const encontrado = lista.find((a) => a.id === avanceId);
    if (!encontrado) throw new NotFoundException('El avance no existe.');
    return encontrado;
  }

  private evidenciaVista(e: Evidencia, nombres: Map<string, string> = new Map(), reemplazadas: Set<string> = new Set()): EvidenciaVista {
    return {
      id: e.id,
      version: e.version,
      reemplazaA: e.reemplazaA,
      vigente: !reemplazadas.has(e.id),
      nombreOriginal: e.nombreOriginal,
      mime: e.mime,
      tamanoBytes: Number(e.tamanoBytes),
      sha256: e.sha256,
      subidoPorId: e.subidoPorId,
      createdAt: e.createdAt.toISOString(),
      anulacion:
        e.anuladaAt && e.anuladaPorId
          ? { at: e.anuladaAt.toISOString(), por: { id: e.anuladaPorId, nombre: nombres.get(e.anuladaPorId) ?? '' }, motivo: e.motivoAnulacion ?? '' }
          : null,
    };
  }

  private async quitarArchivo(storageKey: string): Promise<void> {
    try {
      await this.storage.remove(storageKey);
    } catch (e) {
      this.logger.warn(`No se pudo borrar ${storageKey} del almacenamiento: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}