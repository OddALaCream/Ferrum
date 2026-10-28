import { QueryFailedError } from 'typeorm';
import { codigoPg, esViolacionFk } from './errores-pg';

const errorPg = (code?: string) => new QueryFailedError('DELETE', [], Object.assign(new Error('pg'), { code }));

describe('errores de PostgreSQL', () => {
  it('lee el código SQLSTATE del error del driver', () => {
    expect(codigoPg(errorPg('23505'))).toBe('23505');
    expect(codigoPg(new Error('otro'))).toBeUndefined();
  });

  it('reconoce el borrado bloqueado por una referencia, con cualquier versión de PostgreSQL', () => {
    expect(esViolacionFk(errorPg('23503'))).toBe(true); // foreign_key_violation
    expect(esViolacionFk(errorPg('23001'))).toBe(true); // restrict_violation (ON DELETE RESTRICT en versiones nuevas)
  });

  it('no confunde un duplicado ni un error cualquiera con una referencia', () => {
    expect(esViolacionFk(errorPg('23505'))).toBe(false);
    expect(esViolacionFk(errorPg(undefined))).toBe(false);
    expect(esViolacionFk(new Error('x'))).toBe(false);
  });
});