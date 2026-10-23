import { MINUTOS_VIGENCIA_RESET } from '../constants/auth.constants';

export interface CorreoRestablecer {
  subject: string;
  html: string;
  text: string;
}

const escapar = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Correo de recuperación de contraseña con los colores de la fundación (morado, crema y rojo). */
export function correoRestablecer(nombre: string, enlace: string): CorreoRestablecer {
  const n = escapar(nombre);
  const e = escapar(enlace);
  const subject = 'Restablece tu contraseña · SGP Ser Familia';

  const text = [
    `Hola ${nombre},`,
    '',
    'Recibimos una solicitud para restablecer tu contraseña del sistema de Ser Familia.',
    `Abre este enlace para elegir una nueva (sirve una sola vez y vence en ${MINUTOS_VIGENCIA_RESET} minutos):`,
    enlace,
    '',
    'Si no la pediste, ignora este mensaje: tu contraseña actual sigue funcionando.',
    '',
    'Fundación Ser Familia',
  ].join('\n');

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#fbf6ec;font-family:Arial,Helvetica,sans-serif;color:#2b2140">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf6ec;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden">
        <tr><td style="background:#2a1458;color:#fbf6ec;padding:20px 28px;font-size:18px;font-weight:bold">
          Ser Familia <span style="font-weight:normal;color:#cdbdf5">Fundación</span>
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 12px;font-size:22px;color:#2a1458">Restablece tu contraseña</h1>
          <p style="margin:0 0 12px;line-height:1.5">Hola ${n},</p>
          <p style="margin:0 0 20px;line-height:1.5">Recibimos una solicitud para restablecer tu contraseña del sistema de gestión de proyectos. El enlace sirve una sola vez y vence en ${MINUTOS_VIGENCIA_RESET} minutos.</p>
          <p style="margin:0 0 24px"><a href="${e}" style="display:inline-block;background:#5b2ba8;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold">Elegir una nueva contraseña</a></p>
          <p style="margin:0 0 6px;font-size:13px;color:#6b6280">Si el botón no funciona, copia este enlace en tu navegador:</p>
          <p style="margin:0 0 20px;font-size:13px;word-break:break-all"><a href="${e}" style="color:#5b2ba8">${e}</a></p>
          <p style="margin:0;font-size:13px;color:#6b6280;border-top:3px solid #b3222b;padding-top:14px">Si no la pediste, ignora este mensaje: tu contraseña actual sigue funcionando.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}