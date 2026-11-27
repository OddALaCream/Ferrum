import type { AvanceVista } from '../avances.types';
import { eventosDeAvance, type RegistroBitacora } from './historial';

const LUCIA = 'u-lucia';
const ADMIN = 'u-admin';
const nombres = new Map([[LUCIA, 'Lucía Condori'], [ADMIN, 'Andrea Quispe']]);

const avance = (cambios: Partial<AvanceVista> = {}): AvanceVista => ({
  id: 'av',
  proyecto: { id: 'p', codigo: 'PRY', nombre: 'Proyecto' },
  objetivo: { tipo: 'IOV', id: 'i', codigo: 'I.O.V. 1.2', nombre: 'Beneficiarios', unidad: 'beneficiarios' },
  autor: { id: LUCIA, nombre: 'Lucía Condori' },
  valorReportado: 42,
  fechaCorte: '2026-11-20',
  descripcion: null,
  estado: 'APROBADO',
  enviadoAt: '2026-11-21T10:00:00.000Z',
  observacion: 'Falta la firma.',
  revisadoPor: { id: ADMIN, nombre: 'Andrea Quispe' },
  revisadoAt: '2026-11-23T10:00:00.000Z',
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-23T10:00:00.000Z',
  evidencias: [],
  ...cambios,
});
const reg = (fecha: string, accion: string, usuarioId: string, nuevo: Record<string, unknown> | null, anterior: Record<string, unknown> | null = null): RegistroBitacora => ({
  accion, fecha, usuarioId, nuevo, anterior,
});

describe('eventosDeAvance (SGP-116)', () => {
  it('reconstruye la evolución completa: la observación se conserva aunque después lo aprueben', () => {
    const eventos = eventosDeAvance(
      avance(),
      [
        reg('2026-11-20T10:00:00Z', 'CREAR', LUCIA, { estado: 'BORRADOR', valor_reportado: 40 }),
        reg('2026-11-20T11:00:00Z', 'ACTUALIZAR', LUCIA, { valor_reportado: 42 }, { valor_reportado: 40 }),
        reg('2026-11-21T10:00:00Z', 'ACTUALIZAR', LUCIA, { estado: 'ENVIADO' }, { estado: 'BORRADOR' }),
        reg('2026-11-22T10:00:00Z', 'ACTUALIZAR', ADMIN, { estado: 'OBSERVADO', observacion: 'Falta la firma.' }),
        reg('2026-11-22T15:00:00Z', 'ACTUALIZAR', LUCIA, { estado: 'ENVIADO' }, { estado: 'OBSERVADO' }),
        reg('2026-11-23T10:00:00Z', 'ACTUALIZAR', ADMIN, { estado: 'APROBADO' }),
      ],
      nombres,
    );
    expect(eventos.map((e) => e.tipo)).toEqual(['REGISTRADO', 'CORREGIDO', 'ENVIADO', 'OBSERVADO', 'REENVIADO', 'APROBADO']);
    expect(eventos[0].detalle).toBe('40 beneficiarios');
    expect(eventos[1].detalle).toBe('valor: 40 → 42 beneficiarios');
    expect(eventos[3]).toEqual(expect.objectContaining({ detalle: 'Falta la firma.', usuario: { id: ADMIN, nombre: 'Andrea Quispe' } }));
  });

  it('incluye las evidencias: adjuntadas, versiones y anulaciones, en su lugar de la línea de tiempo', () => {
    const base = { mime: 'application/pdf', tamanoBytes: 10, sha256: 'a', subidoPorId: LUCIA, vigente: true };
    const eventos = eventosDeAvance(
      avance({
        estado: 'OBSERVADO',
        revisadoAt: '2026-11-22T10:00:00.000Z',
        evidencias: [
          { ...base, id: 'e1', version: 1, reemplazaA: null, nombreOriginal: 'acta.pdf', createdAt: '2026-11-20T10:05:00.000Z', vigente: false,
            anulacion: { at: '2026-11-22T09:00:00.000Z', por: { id: ADMIN, nombre: 'Andrea Quispe' }, motivo: 'Ilegible' } },
          { ...base, id: 'e2', version: 2, reemplazaA: 'e1', nombreOriginal: 'acta-legible.pdf', createdAt: '2026-11-22T12:00:00.000Z', anulacion: null },
        ],
      }),
      [],
      nombres,
    );
    expect(eventos.map((e) => e.tipo)).toEqual(['REGISTRADO', 'EVIDENCIA_ADJUNTADA', 'ENVIADO', 'EVIDENCIA_ANULADA', 'OBSERVADO', 'EVIDENCIA_VERSION']);
    expect(eventos.find((e) => e.tipo === 'EVIDENCIA_ANULADA')?.detalle).toBe('acta.pdf: Ilegible');
    expect(eventos.find((e) => e.tipo === 'EVIDENCIA_VERSION')?.detalle).toBe('acta-legible.pdf (v2)');
  });

  it('sin bitácora (datos cargados por SQL), usa lo que guarda el avance', () => {
    const eventos = eventosDeAvance(avance(), [], nombres);
    expect(eventos.map((e) => e.tipo)).toEqual(['REGISTRADO', 'ENVIADO', 'APROBADO']);
    expect(eventos[2].usuario?.nombre).toBe('Andrea Quispe');
  });
});