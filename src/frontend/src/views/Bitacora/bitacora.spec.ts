import { describe, expect, it } from 'vitest';
import type { RegistroAuditoria } from '@/api/auditoria';
import {
  aFechaIso,
  camposCambiados,
  etiquetaAccion,
  etiquetaEntidad,
  formatoFechaHora,
  formatoValor,
  quienRealizo,
} from './bitacora';

describe('bitacora', () => {
  it('muestra la fecha en la hora de La Paz (UTC−4)', () => {
    expect(formatoFechaHora('2026-10-23T04:17:16.000Z')).toMatch(/23\/10\/2026.*00:17:16/);
  });

  it('convierte una fecha local a YYYY-MM-DD sin pasar por UTC', () => {
    expect(aFechaIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('traduce entidades y acciones conocidas y deja las demás tal cual', () => {
    expect(etiquetaEntidad('proyecto_equipo')).toBe('Equipo del proyecto');
    expect(etiquetaEntidad('otra_tabla')).toBe('otra_tabla');
    expect(etiquetaAccion('ACTUALIZAR').label).toBe('Modificación');
    expect(etiquetaAccion('OTRA').label).toBe('OTRA');
  });

  it('identifica a quién hizo el cambio o indica que no había sesión', () => {
    const base = { usuarioNombre: null, usuarioEmail: null } as RegistroAuditoria;
    expect(quienRealizo({ ...base, usuarioNombre: 'Director Demo' })).toBe('Director Demo');
    expect(quienRealizo({ ...base, usuarioEmail: 'a@b.c' })).toBe('a@b.c');
    expect(quienRealizo(base)).toBe('Sin sesión');
  });

  it.each([
    [null, '—'],
    [true, 'Sí'],
    ['850000.50', '850000.50'],
    [{ a: 1 }, '{"a":1}'],
    [undefined, ''],
  ])('formatoValor(%p) → %p', (valor, esperado) => {
    expect(formatoValor(valor)).toBe(esperado);
  });

  it('une los campos de ambos valores y marca los que cambiaron', () => {
    expect(camposCambiados({ estado: 'PLANIFICACION' }, { estado: 'EN_EJECUCION' })).toEqual([
      { campo: 'estado', anterior: 'PLANIFICACION', nuevo: 'EN_EJECUCION', cambio: true },
    ]);
    expect(camposCambiados(null, { codigo: 'PRY-1', id: 'p1' }).map((c) => c.campo)).toEqual(['codigo', 'id']);
  });
});
