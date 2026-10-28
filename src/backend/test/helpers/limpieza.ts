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
  await ds.query(`DELETE FROM tareas WHERE actividad_id IN (SELECT id FROM actividades WHERE resultado_id IN (${deResultados}))`, [ids]);
  await ds.query(`DELETE FROM actividades WHERE resultado_id IN (${deResultados})`, [ids]); // las sesiones se van en cascada
  await ds.query(`DELETE FROM iov WHERE resultado_id IN (${deResultados})`, [ids]);
  await ds.query(`DELETE FROM resultados WHERE proyecto_id = ANY($1)`, [ids]);
  await ds.query(`DELETE FROM proyecto_equipo WHERE proyecto_id = ANY($1)`, [ids]);
  await ds.query(`DELETE FROM proyectos WHERE id = ANY($1)`, [ids]);
}