import type { DataSource } from 'typeorm';

/**
 * Borra los proyectos que crean las pruebas e2e (sus códigos empiezan con un prefijo propio, como "ML-")
 * y todo lo que cuelga de ellos, para que no se acumulen en la base de desarrollo ni aparezcan en el listado.
 * La bitácora no se toca: es de solo inserción.
 */
export async function borrarProyectosDePrueba(ds: DataSource, prefijo: string): Promise<void> {
  const filas: { id: string }[] = await ds.query(`SELECT id FROM proyectos WHERE codigo LIKE $1`, [`${prefijo}%`]);
  const ids = filas.map((f) => f.id);
  if (ids.length === 0) return;

  const deResultados = `SELECT id FROM resultados WHERE proyecto_id = ANY($1)`;
  if (!(await borrarAvances(ds, ids, deResultados))) return;
  await ds.query(`DELETE FROM tareas WHERE actividad_id IN (SELECT id FROM actividades WHERE resultado_id IN (${deResultados}))`, [ids]);
  await ds.query(`DELETE FROM actividades WHERE resultado_id IN (${deResultados})`, [ids]); // las sesiones se van en cascada
  await ds.query(`DELETE FROM iov WHERE resultado_id IN (${deResultados})`, [ids]);
  await ds.query(`DELETE FROM resultados WHERE proyecto_id = ANY($1)`, [ids]);
  await ds.query(`DELETE FROM proyecto_equipo WHERE proyecto_id = ANY($1)`, [ids]);
  await ds.query(`DELETE FROM proyecto_supervisores WHERE proyecto_id = ANY($1)`, [ids]);
  await ds.query(`DELETE FROM proyectos WHERE id = ANY($1)`, [ids]);
}

/**
 * Las evidencias y los avances enviados no se pueden borrar (triggers trg_evidencia_guard y trg_avance_borrado),
 * así que para limpiar se desactivan esos triggers solo dentro de la transacción. Si el usuario de la base no es dueño de la tabla y no
 * puede hacerlo, se dejan los proyectos de prueba como están (no afecta a las pruebas) y se avisa.
 */
async function borrarAvances(ds: DataSource, ids: string[], deResultados: string): Promise<boolean> {
  const deAvances = `SELECT a.id FROM avances a
      LEFT JOIN iov i ON i.id = a.iov_id LEFT JOIN actividades c ON c.id = a.actividad_id
     WHERE COALESCE(i.resultado_id, c.resultado_id) IN (${deResultados})`;
  try {
    await ds.transaction(async (m) => {
      await m.query(`ALTER TABLE evidencias DISABLE TRIGGER trg_evidencia_guard`);
      await m.query(`DELETE FROM evidencias WHERE avance_id IN (${deAvances})`, [ids]);
      await m.query(`ALTER TABLE evidencias ENABLE TRIGGER trg_evidencia_guard`);
      await m.query(`ALTER TABLE avances DISABLE TRIGGER trg_avance_borrado`);
      await m.query(`DELETE FROM avances WHERE id IN (${deAvances})`, [ids]);
      await m.query(`ALTER TABLE avances ENABLE TRIGGER trg_avance_borrado`);
    });
    return true;
  } catch (e) {
    console.warn(`No se pudieron borrar los avances de prueba (${e instanceof Error ? e.message : String(e)}); los proyectos de prueba quedan en la base.`);
    return false;
  }
}