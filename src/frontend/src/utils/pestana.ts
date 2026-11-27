/**
 * Abre en otra pestaña un enlace que se pide al servidor (p. ej. el enlace temporal de una evidencia).
 * La pestaña se abre antes de pedir el enlace para que el navegador no la bloquee.
 */
export async function abrirEnPestanaNueva(obtenerUrl: () => Promise<string>): Promise<void> {
  const pestana = window.open('', '_blank');
  try {
    const url = await obtenerUrl();
    if (pestana) pestana.location.href = url;
    else window.location.href = url;
  } catch (e) {
    pestana?.close();
    throw e;
  }
}